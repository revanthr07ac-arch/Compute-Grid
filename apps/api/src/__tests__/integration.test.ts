import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../services/db.js';

describe('Integration Tests: ComputeGrid API & Lifecycle', () => {
  let authToken = '';
  let userId = '';
  let workerEnrollmentToken = '';
  let workerId = '';
  let workerSecret = '';
  let createdJobId = '';

  const testEmail = `testuser_${Date.now()}@computegrid.io`;
  const testPassword = 'Password123!Safe';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup created test records
    if (createdJobId) {
      await prisma.job.deleteMany({ where: { id: createdJobId } });
    }
    if (workerId) {
      await prisma.worker.deleteMany({ where: { id: workerId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  describe('1. Health Endpoints', () => {
    it('GET /api/v1/health/live returns UP', async () => {
      const res = await request(app).get('/api/v1/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });

    it('GET /api/v1/health/ready returns database connection status', async () => {
      const res = await request(app).get('/api/v1/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('READY');
      expect(res.body.database).toBe('CONNECTED');
    });
  });

  describe('2. Authentication Flow', () => {
    it('POST /api/v1/auth/register creates user account and returns token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          username: `user_${Date.now()}`,
          password: testPassword,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      authToken = res.body.data.token;
      userId = res.body.data.user.id;
    });

    it('POST /api/v1/auth/login authenticates registered user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('GET /api/v1/auth/me returns profile of logged in user', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(testEmail);
    });

    it('rejects unauthenticated request to protected endpoint', async () => {
      const res = await request(app).get('/api/v1/jobs');
      expect(res.status).toBe(401);
    });
  });

  describe('3. Worker Management & Enrollment', () => {
    it('POST /api/v1/workers/enroll generates a worker enrollment token', async () => {
      const res = await request(app)
        .post('/api/v1/workers/enroll')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(201);
      expect(res.body.data.token).toBeDefined();
      workerEnrollmentToken = res.body.data.token;
    });

    it('POST /api/v1/workers/register registers worker and returns secret credential', async () => {
      const res = await request(app)
        .post('/api/v1/workers/register')
        .send({
          name: 'Integration-Test-Node-01',
          enrollmentToken: workerEnrollmentToken,
          hostname: 'node-test-host',
          os: 'win32',
          arch: 'x64',
          agentVersion: '1.0.0',
          capabilities: {
            supportedWorkloads: ['MATH_PARALLEL', 'FILE_CHUNK_PROCESSING'],
            maxConcurrency: 2,
            cpuCores: 4,
            totalMemoryMb: 8192,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.workerId).toBeDefined();
      expect(res.body.data.workerSecret).toBeDefined();
      workerId = res.body.data.workerId;
      workerSecret = res.body.data.workerSecret;
    });

    it('POST /api/v1/workers/heartbeat records worker metrics', async () => {
      const res = await request(app)
        .post('/api/v1/workers/heartbeat')
        .set('x-worker-id', workerId)
        .set('x-worker-secret', workerSecret)
        .send({
          cpuUsagePercent: 15.5,
          memoryUsedMb: 1200,
          memoryTotalMb: 8192,
          tasksActive: 0,
          tasksCompleted: 0,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACKNOWLEDGED');
    });
  });

  describe('4. Distributed Job Submission & Execution Lifecycle', () => {
    it('POST /api/v1/jobs creates a parallel mathematical computation job', async () => {
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Prime Counting Test Job',
          workloadType: 'MATH_PARALLEL',
          priority: 8,
          parameters: {
            algorithm: 'prime-count',
            rangeStart: 2,
            rangeEnd: 100,
            chunkCount: 2,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('CREATED');
      createdJobId = res.body.data.id;
    });

    it('worker claims, executes, and completes task chunks', async () => {
      // Allow scheduler async partition step to persist
      await new Promise(r => setTimeout(r, 600));

      // Worker claims first chunk
      const claim1 = await request(app)
        .get('/api/v1/worker/tasks/claim')
        .set('x-worker-id', workerId)
        .set('x-worker-secret', workerSecret);

      expect(claim1.status).toBe(200);
      expect(claim1.body.data.taskId).toBeDefined();
      const task1Id = claim1.body.data.taskId;

      // Report progress
      await request(app)
        .post(`/api/v1/worker/tasks/${task1Id}/progress`)
        .set('x-worker-id', workerId)
        .set('x-worker-secret', workerSecret)
        .send({ progress: 50, message: 'Processing sub-range...' });

      // Worker computes result for chunk 1: range [2, 51]
      const { referencePrimeCompute } = await import('@computegrid/shared');
      const input1 = claim1.body.data.inputPayload;
      const calc1 = referencePrimeCompute(input1.rangeStart, input1.rangeEnd);

      // Complete chunk 1
      const comp1 = await request(app)
        .post(`/api/v1/worker/tasks/${task1Id}/complete`)
        .set('x-worker-id', workerId)
        .set('x-worker-secret', workerSecret)
        .send({
          outputPayload: {
            chunkIndex: input1.chunkIndex,
            rangeStart: input1.rangeStart,
            rangeEnd: input1.rangeEnd,
            algorithm: 'prime-count',
            count: calc1.count,
            sum: calc1.sum,
            maxPrime: calc1.maxPrime,
            executionTimeMs: 12,
            checksum: 'test-chk-1',
          },
          runtimeMs: 12,
        });

      expect(comp1.status).toBe(200);

      // Worker claims second chunk
      const claim2 = await request(app)
        .get('/api/v1/worker/tasks/claim')
        .set('x-worker-id', workerId)
        .set('x-worker-secret', workerSecret);

      expect(claim2.status).toBe(200);
      const task2Id = claim2.body.data.taskId;
      const input2 = claim2.body.data.inputPayload;
      const calc2 = referencePrimeCompute(input2.rangeStart, input2.rangeEnd);

      // Complete chunk 2
      const comp2 = await request(app)
        .post(`/api/v1/worker/tasks/${task2Id}/complete`)
        .set('x-worker-id', workerId)
        .set('x-worker-secret', workerSecret)
        .send({
          outputPayload: {
            chunkIndex: input2.chunkIndex,
            rangeStart: input2.rangeStart,
            rangeEnd: input2.rangeEnd,
            algorithm: 'prime-count',
            count: calc2.count,
            sum: calc2.sum,
            maxPrime: calc2.maxPrime,
            executionTimeMs: 15,
            checksum: 'test-chk-2',
          },
          runtimeMs: 15,
        });

      expect(comp2.status).toBe(200);

      // Verify Job is now COMPLETED and verified
      const jobRes = await request(app)
        .get(`/api/v1/jobs/${createdJobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(jobRes.status).toBe(200);
      expect(jobRes.body.data.status).toBe('COMPLETED');
      expect(jobRes.body.data.outputSummary.totalPrimesCount).toBe(25);
      expect(jobRes.body.data.outputSummary.totalPrimesSum).toBe(1060);
      expect(jobRes.body.data.outputSummary.highestPrime).toBe(97);
      expect(jobRes.body.data.outputSummary.verifiedAgainstReference).toBe(true);
    });

    it('GET /api/v1/jobs/:jobId/results returns output summary and download URL', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${createdJobId}/results`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.downloadUrl).toBeDefined();
    });
  });
});
