import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../services/db.js';
import { taskScheduler } from '../scheduler/taskScheduler.js';
import { storageService } from '../services/storageService.js';
import { FileWorkloadParamsSchema } from '@computegrid/shared';
import { TaskExecutor } from '@computegrid/compute';

describe('Security, IDOR, Concurrency & Defect Regression Suite', () => {
  let userAToken = '';
  let userAId = '';
  let userBToken = '';
  let userBId = '';

  let userAJobId = '';
  let userATaskId = '';
  let userAArtifactId = '';

  let worker1Id = '';
  let worker2Id = '';

  beforeAll(async () => {
    await prisma.$connect();

    // 1. Create User A (victim / primary user)
    const emailA = `usera_${Date.now()}@example.com`;
    const resA = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: emailA, username: `usera_${Date.now()}`, password: 'Password123!' });
    expect(resA.status).toBe(201);
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user.id;

    // 2. Create User B (attacker / separate tenant)
    const emailB = `userb_${Date.now()}@example.com`;
    const resB = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: emailB, username: `userb_${Date.now()}`, password: 'Password123!' });
    expect(resB.status).toBe(201);
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user.id;

    // 3. Create a Job owned by User A
    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'User A Confidential Job',
        workloadType: 'MATH_PARALLEL',
        priority: 5,
        parameters: {
          algorithm: 'prime-count',
          rangeStart: 100,
          rangeEnd: 500,
          chunkCount: 2,
        },
      });
    expect(jobRes.status).toBe(201);
    userAJobId = jobRes.body.data.id;

    // Fetch created task for User A Job (await async partitioning)
    let task = null;
    for (let i = 0; i < 30; i++) {
      task = await prisma.task.findFirst({ where: { jobId: userAJobId } });
      if (task) break;
      await new Promise(r => setTimeout(r, 100));
    }
    expect(task).not.toBeNull();
    userATaskId = task!.id;

    // 4. Create an Artifact owned by User A
    const savedArtifact = await storageService.saveArtifact({
      userId: userAId,
      jobId: userAJobId,
      taskId: userATaskId,
      filename: 'confidential_results.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('id,secret_data\n1,classified_computegrid_value'),
    });
    userAArtifactId = savedArtifact.id;

    // 5. Create Worker 1 and Worker 2 records for concurrency testing
    const w1 = await prisma.worker.create({
      data: {
        userId: userAId,
        name: 'Test-Worker-1',
        hostname: 'node-1',
        os: 'linux',
        arch: 'x64',
        agentVersion: '1.0.0',
        status: 'ONLINE',
        capabilities: JSON.stringify({
          supportedWorkloads: ['MATH_PARALLEL', 'FILE_CHUNK_PROCESSING'],
          maxConcurrency: 1,
        }),
      },
    });
    worker1Id = w1.id;

    const w2 = await prisma.worker.create({
      data: {
        userId: userAId,
        name: 'Test-Worker-2',
        hostname: 'node-2',
        os: 'linux',
        arch: 'x64',
        agentVersion: '1.0.0',
        status: 'ONLINE',
        capabilities: JSON.stringify({
          supportedWorkloads: ['MATH_PARALLEL', 'FILE_CHUNK_PROCESSING'],
          maxConcurrency: 1,
        }),
      },
    });
    worker2Id = w2.id;
  });

  afterAll(async () => {
    // Cleanup test records
    if (userAJobId) {
      await prisma.jobEvent.deleteMany({ where: { jobId: userAJobId } });
      await prisma.taskAttempt.deleteMany({ where: { task: { jobId: userAJobId } } });
      await prisma.task.deleteMany({ where: { jobId: userAJobId } });
      await prisma.job.deleteMany({ where: { id: userAJobId } });
    }
    if (userAArtifactId) {
      const art = await prisma.artifact.findUnique({ where: { id: userAArtifactId } });
      if (art) {
        await storageService.deleteArtifactFile(art.storageKey).catch(() => {});
        await prisma.artifact.deleteMany({ where: { id: userAArtifactId } });
      }
    }
    if (worker1Id) {
      await prisma.workerMetrics.deleteMany({ where: { workerId: worker1Id } });
      await prisma.worker.deleteMany({ where: { id: worker1Id } });
    }
    if (worker2Id) {
      await prisma.workerMetrics.deleteMany({ where: { workerId: worker2Id } });
      await prisma.worker.deleteMany({ where: { id: worker2Id } });
    }
    if (userAId) {
      await prisma.user.deleteMany({ where: { id: userAId } });
    }
    if (userBId) {
      await prisma.user.deleteMany({ where: { id: userBId } });
    }
    await prisma.$disconnect();
  });

  describe('Defect 1: Artifact Security & Cross-Tenant Access Control', () => {
    it('rejects unauthenticated requests to GET /artifacts/:id/download with 401', async () => {
      const res = await request(app).get(`/api/v1/artifacts/${userAArtifactId}/download`);
      expect(res.status).toBe(401);
    });

    it('rejects cross-tenant access to GET /artifacts/:id/download by User B with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${userAArtifactId}/download`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.toLowerCase()).toContain('forbidden');
    });

    it('allows legitimate owner User A to download artifact with 200 OK', async () => {
      const res = await request(app)
        .get(`/api/v1/artifacts/${userAArtifactId}/download`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('classified_computegrid_value');
    });

    it('GET /artifacts returns only artifacts owned by the requesting user', async () => {
      const resA = await request(app)
        .get('/api/v1/artifacts')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resA.status).toBe(200);
      expect(resA.body.data.some((a: any) => a.id === userAArtifactId)).toBe(true);

      const resB = await request(app)
        .get('/api/v1/artifacts')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(resB.status).toBe(200);
      expect(resB.body.data.some((a: any) => a.id === userAArtifactId)).toBe(false);
    });
  });

  describe('Defect 2: IDOR Prevention on Job Tasks, Logs, and Results', () => {
    it('prevents User B from viewing User A job tasks via GET /jobs/:id/tasks (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${userAJobId}/tasks`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.toLowerCase()).toContain('forbidden');
    });

    it('prevents User B from viewing User A job logs via GET /jobs/:id/logs (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${userAJobId}/logs`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.toLowerCase()).toContain('forbidden');
    });

    it('prevents User B from viewing User A job results via GET /jobs/:id/results (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${userAJobId}/results`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.toLowerCase()).toContain('forbidden');
    });

    it('allows owner User A to query their own job tasks, logs, and results (200)', async () => {
      const tasksRes = await request(app)
        .get(`/api/v1/jobs/${userAJobId}/tasks`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(tasksRes.status).toBe(200);
      expect(Array.isArray(tasksRes.body.data)).toBe(true);

      const logsRes = await request(app)
        .get(`/api/v1/jobs/${userAJobId}/logs`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(logsRes.status).toBe(200);
      expect(Array.isArray(logsRes.body.data)).toBe(true);
    });
  });

  describe('Defect 3: Stale Worker Assignments & Duplicate Task Completion Guard', () => {
    it('rejects completion from a stale worker when task is leased to another worker', async () => {
      // Set task leased to Worker 1
      await prisma.task.update({
        where: { id: userATaskId },
        data: {
          status: 'LEASED',
          workerId: worker1Id,
          leaseExpiresAt: new Date(Date.now() + 60000),
        },
      });

      // Worker 2 attempts to complete Worker 1's task
      await taskScheduler.completeTask(
        userATaskId,
        worker2Id, // Stale / unauthorized worker
        { count: 999, sum: 9999 },
        150
      );

      // Verify task status was NOT overwritten by Worker 2
      const taskAfter = await prisma.task.findUnique({ where: { id: userATaskId } });
      expect(taskAfter?.workerId).toBe(worker1Id);
      expect(taskAfter?.status).toBe('LEASED'); // Still leased to Worker 1
    });

    it('rejects failTask from a stale worker when task is leased to another worker', async () => {
      // Set task leased to Worker 1
      await prisma.task.update({
        where: { id: userATaskId },
        data: {
          status: 'LEASED',
          workerId: worker1Id,
          leaseExpiresAt: new Date(Date.now() + 60000),
        },
      });

      // Worker 2 attempts to fail Worker 1's task
      await taskScheduler.failTask(
        userATaskId,
        worker2Id, // Stale worker
        'Stale worker fake error message',
        true
      );

      // Verify task was NOT requeued or failed by Worker 2
      const taskAfter = await prisma.task.findUnique({ where: { id: userATaskId } });
      expect(taskAfter?.workerId).toBe(worker1Id);
      expect(taskAfter?.status).toBe('LEASED');
    });

    it('successfully accepts completion when submitted by the active lease owner', async () => {
      await taskScheduler.completeTask(
        userATaskId,
        worker1Id, // Active lease holder
        { count: 25, sum: 1060 },
        250
      );

      const taskAfter = await prisma.task.findUnique({ where: { id: userATaskId } });
      expect(taskAfter?.status).toBe('COMPLETED');
      expect(taskAfter?.workerId).toBe(worker1Id);
    });
  });

  describe('Defect 4: Concurrency & Optimistic Task Claim Race Elimination', () => {
    it('prevents double-claiming under simultaneous worker contention', async () => {
      // Create a fresh task in QUEUED state
      const newTask = await prisma.task.create({
        data: {
          jobId: userAJobId,
          chunkIndex: 99,
          totalChunks: 100,
          status: 'QUEUED',
          inputPayload: JSON.stringify({ rangeStart: 1000, rangeEnd: 1100 }),
        },
      });

      // Both Worker 1 and Worker 2 try to claim concurrently
      const [claim1, claim2] = await Promise.all([
        taskScheduler.claimTask(worker1Id, ['MATH_PARALLEL']),
        taskScheduler.claimTask(worker2Id, ['MATH_PARALLEL']),
      ]);

      // Exactly one worker must have claimed newTask, and the other must not have claimed the same task
      const claim1Id = claim1?.taskId;
      const claim2Id = claim2?.taskId;

      // Both should not claim the same task
      if (claim1Id && claim2Id) {
        expect(claim1Id).not.toBe(claim2Id);
      }

      // Cleanup
      await prisma.taskAttempt.deleteMany({ where: { taskId: newTask.id } });
      await prisma.task.deleteMany({ where: { id: newTask.id } });
    });
  });

  describe('Defect 5: ReDoS and Unsafe Regex Filtering Defenses', () => {
    it('FileWorkloadParamsSchema rejects syntactically invalid regex patterns', () => {
      const invalidRegexParams = {
        operation: 'regex-filter',
        filename: 'access.log',
        chunkCount: 2,
        filterPattern: '[unclosed-bracket(regex',
      };
      const result = FileWorkloadParamsSchema.safeParse(invalidRegexParams);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid regular expression syntax');
      }
    });

    it('FileWorkloadParamsSchema rejects regex patterns exceeding maximum character length', () => {
      const overlyLongPattern = 'a'.repeat(250);
      const result = FileWorkloadParamsSchema.safeParse({
        operation: 'regex-filter',
        filename: 'access.log',
        chunkCount: 2,
        filterPattern: overlyLongPattern,
      });
      expect(result.success).toBe(false);
    });

    it('TaskExecutor safely handles malformed regex patterns without crashing the worker', async () => {
      const input = {
        chunkIndex: 0,
        totalChunks: 1,
        startLine: 1,
        endLine: 3,
        contentChunk: 'line 1: error in system\nline 2: normal status\nline 3: [unclosed warning',
        operation: 'regex-filter' as const,
        filterPattern: '[unclosed-pattern(',
      };

      // Must execute gracefully without throwing an unhandled exception
      const output = await TaskExecutor.executeFileTask(input);
      expect(output).toBeDefined();
      expect(output.chunkIndex).toBe(0);
      expect(Array.isArray(output.matchedLines)).toBe(true);
    });
  });
});
