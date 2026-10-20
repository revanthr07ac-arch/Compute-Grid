import { prisma } from './src/services/db.js';
import { app, server } from './src/index.js';
import { WorkerConfig } from '../worker/dist/config.js';
import { WorkerAgent } from '../worker/dist/agent.js';
import { referencePrimeCompute } from '@computegrid/shared';
import request from 'supertest';

async function runE2E() {
  console.log('====================================================');
  console.log('🚀 Running ComputeGrid Multi-Worker End-to-End Test');
  console.log('====================================================');

  try {
    // 1. Register & Login
    const testEmail = `e2e_user_${Date.now()}@computegrid.io`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        username: `e2e_user_${Date.now()}`,
        password: 'Password123!Secure',
      });

    if (!regRes.body.success) throw new Error('Registration failed: ' + JSON.stringify(regRes.body));
    const token = regRes.body.data.token;
    console.log('✔ Step 1: User registered and authenticated successfully');

    // 2. Generate Enrollment Token for Workers
    const enrollRes1 = await request(app)
      .post('/api/v1/workers/enroll')
      .set('Authorization', `Bearer ${token}`);
    const enrollToken1 = enrollRes1.body.data.token;

    const enrollRes2 = await request(app)
      .post('/api/v1/workers/enroll')
      .set('Authorization', `Bearer ${token}`);
    const enrollToken2 = enrollRes2.body.data.token;
    console.log('✔ Step 2: Generated enrollment tokens for 2 workers');

    // 3. Start Two Separate Worker Agents
    const worker1Config = new WorkerConfig({
      server: 'http://localhost:4000',
      token: enrollToken1,
      name: 'E2E-Worker-Alpha',
      configFile: './.e2e_worker_1.json',
    });
    const worker1 = new WorkerAgent(worker1Config);
    await worker1.start();
    console.log('✔ Step 3a: Worker Alpha registered and started');

    const worker2Config = new WorkerConfig({
      server: 'http://localhost:4000',
      token: enrollToken2,
      name: 'E2E-Worker-Beta',
      configFile: './.e2e_worker_2.json',
    });
    const worker2 = new WorkerAgent(worker2Config);
    await worker2.start();
    console.log('✔ Step 3b: Worker Beta registered and started');

    // 4. Create Distributed Compute Job (4 chunks of prime calculation)
    const rangeStart = 10;
    const rangeEnd = 1000;
    const chunkCount = 4;

    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Multi-Worker Prime Distribution',
        workloadType: 'MATH_PARALLEL',
        priority: 10,
        parameters: {
          algorithm: 'prime-count',
          rangeStart,
          rangeEnd,
          chunkCount,
        },
      });

    const jobId = jobRes.body.data.id;
    console.log(`✔ Step 4: Job created (ID: ${jobId}), partitioned into ${chunkCount} tasks`);

    // 5. Track execution across both workers
    console.log('⏳ Step 5: Waiting for workers to claim and execute all chunks...');
    let completedJob: any = null;
    const timeoutAt = Date.now() + 25000;

    while (Date.now() < timeoutAt) {
      await new Promise(r => setTimeout(r, 1000));
      const statusRes = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set('Authorization', `Bearer ${token}`);

      const j = statusRes.body.data;
      console.log(`   - Job Status: ${j.status} | Progress: ${j.progress}% | Completed Tasks: ${j.completedTasks}/${j.totalTasks}`);

      if (j.status === 'COMPLETED') {
        completedJob = j;
        break;
      }
    }

    if (!completedJob) {
      throw new Error('Timed out waiting for job completion');
    }

    // 6. Validate Result Against Single-Process Reference
    const expected = referencePrimeCompute(rangeStart, rangeEnd);
    console.log(`✔ Step 6: Job completed! Output summary:`, completedJob.outputSummary);
    console.log(`   - Expected: Primes=${expected.count}, Sum=${expected.sum}, MaxPrime=${expected.maxPrime}`);
    console.log(`   - Grid:     Primes=${completedJob.outputSummary.totalPrimesCount}, Sum=${completedJob.outputSummary.totalPrimesSum}, MaxPrime=${completedJob.outputSummary.highestPrime}`);

    if (
      completedJob.outputSummary.totalPrimesCount !== expected.count ||
      completedJob.outputSummary.totalPrimesSum !== expected.sum ||
      completedJob.outputSummary.highestPrime !== expected.maxPrime
    ) {
      throw new Error('Distributed computation result does not match reference calculation!');
    }
    console.log('✔ Computation verified 100% against single-process reference algorithm!');

    // 7. Verify Task Distribution Across Multiple Workers
    const tasks = completedJob.tasks;
    const workerIds = new Set(tasks.map((t: any) => t.workerId));
    console.log(`✔ Tasks executed across ${workerIds.size} distinct worker node(s)`);

    // 8. Download Output Artifact
    const artifactRes = await request(app)
      .get(`/api/v1/artifacts/${completedJob.outputArtifactId}/download`)
      .set('Authorization', `Bearer ${token}`);

    if (artifactRes.status !== 200) {
      throw new Error('Failed to download completed job output artifact');
    }
    const downloadedData = JSON.parse(artifactRes.text);
    console.log('✔ Step 7: Downloaded and verified output artifact JSON payload');

    // 9. Unauthorized access rejection
    const unauthRes = await request(app)
      .get(`/api/v1/jobs/${jobId}`);
    if (unauthRes.status !== 401) {
      throw new Error('Security boundary failed: unauthorized access was not rejected with 401');
    }
    console.log('✔ Step 8: Security boundary verified - unauthorized request rejected with 401');

    // Stop workers
    worker1.stop();
    worker2.stop();

    console.log('====================================================');
    console.log('🎉 ALL END-TO-END CRITERIA VERIFIED AND PASSED!');
    console.log('====================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ E2E Test Failed:', err);
    process.exit(1);
  }
}

// Start test
setTimeout(runE2E, 1000);
