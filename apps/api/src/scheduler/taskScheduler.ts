import { prisma } from '../services/db.js';
import { socketServer } from '../socket/socketServer.js';
import { storageService } from '../services/storageService.js';
import { getQueueService } from '../services/queueService.js';
import { ENV } from '../config/env.js';
import {
  WorkloadType,
  MathParallelParams,
  MathChunkInput,
  MathChunkOutput,
  MathAggregatedResult,
  FileChunkParams,
  FileChunkInput,
  FileChunkOutput,
  FileAggregatedResult,
  referencePrimeCompute,
  referenceIntegrationCompute,
} from '@computegrid/shared';

export class TaskScheduler {
  private recoveryInterval: NodeJS.Timeout | null = null;

  public async partitionAndScheduleJob(jobId: string): Promise<void> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const params = JSON.parse(job.parameters);
    const tasksToCreate: Array<{
      jobId: string;
      chunkIndex: number;
      totalChunks: number;
      status: string;
      maxAttempts: number;
      inputPayload: string;
    }> = [];

    if (job.workloadType === 'MATH_PARALLEL') {
      const mathParams = params as MathParallelParams;
      const { rangeStart, rangeEnd, chunkCount, algorithm, integrationFunction, totalSteps } =
        mathParams;

      const totalSpan = rangeEnd - rangeStart;
      const stepSize = Math.floor(totalSpan / chunkCount);

      for (let i = 0; i < chunkCount; i++) {
        const chunkStart = rangeStart + i * stepSize;
        const chunkEnd = i === chunkCount - 1 ? rangeEnd : chunkStart + stepSize - 1;

        const input: MathChunkInput = {
          chunkIndex: i,
          totalChunks: chunkCount,
          algorithm,
          rangeStart: chunkStart,
          rangeEnd: chunkEnd,
          integrationFunction,
          steps: totalSteps ? Math.floor(totalSteps / chunkCount) : undefined,
        };

        tasksToCreate.push({
          jobId,
          chunkIndex: i,
          totalChunks: chunkCount,
          status: 'QUEUED',
          maxAttempts: job.maxRetriesPerTask + 1,
          inputPayload: JSON.stringify(input),
        });
      }
    } else if (job.workloadType === 'FILE_CHUNK_PROCESSING') {
      const fileParams = params as FileChunkParams & { content?: string };
      const { filename, chunkCount, operation, filterPattern, content } = fileParams;

      const lines = (content || 'Sample compute grid line\n'.repeat(100)).split('\n');
      const linesPerChunk = Math.max(1, Math.ceil(lines.length / chunkCount));

      for (let i = 0; i < chunkCount; i++) {
        const startLine = i * linesPerChunk;
        const endLine = Math.min(lines.length, (i + 1) * linesPerChunk);
        const chunkLines = lines.slice(startLine, endLine).join('\n');

        const input: FileChunkInput = {
          chunkIndex: i,
          totalChunks: chunkCount,
          operation,
          contentChunk: chunkLines,
          startLine: startLine + 1,
          endLine,
          filterPattern,
        };

        tasksToCreate.push({
          jobId,
          chunkIndex: i,
          totalChunks: chunkCount,
          status: 'QUEUED',
          maxAttempts: job.maxRetriesPerTask + 1,
          inputPayload: JSON.stringify(input),
        });
      }
    } else {
      throw new Error(`Unsupported workload type: ${job.workloadType}`);
    }

    // Persist tasks in database
    await prisma.$transaction(async tx => {
      for (const t of tasksToCreate) {
        await tx.task.create({ data: t });
      }

      await tx.job.update({
        where: { id: jobId },
        data: {
          totalTasks: tasksToCreate.length,
          status: 'QUEUED',
        },
      });

      await tx.jobEvent.create({
        data: {
          jobId,
          type: 'JOB_QUEUED',
          severity: 'INFO',
          message: `Job partitioned into ${tasksToCreate.length} tasks and queued.`,
        },
      });
    });

    // Enqueue tasks in QueueService
    const createdTasks = await prisma.task.findMany({
      where: { jobId },
      select: { id: true, chunkIndex: true },
    });

    const queue = getQueueService();
    for (const task of createdTasks) {
      await queue.enqueueTask({
        taskId: task.id,
        jobId,
        chunkIndex: task.chunkIndex,
        priority: job.priority,
      });
    }

    socketServer.emitJobProgress(jobId, 0, 0, tasksToCreate.length);
  }

  public async claimTask(
    workerId: string,
    supportedWorkloads: WorkloadType[]
  ): Promise<any | null> {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
    });

    if (!worker || worker.status === 'PAUSED' || worker.status === 'REVOKED') {
      return null;
    }

    const now = new Date();
    const leaseDurationMs = ENV.TASK_LEASE_TIMEOUT_SEC * 1000;
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

    // Atomic assignment using transaction
    const claimedTask = await prisma.$transaction(async tx => {
      // Find candidate task
      const candidate = await tx.task.findFirst({
        where: {
          job: {
            status: { in: ['QUEUED', 'RUNNING'] },
            workloadType: { in: supportedWorkloads },
          },
          OR: [
            { status: 'QUEUED' },
            {
              status: { in: ['LEASED', 'RUNNING'] },
              leaseExpiresAt: { lt: now },
            },
          ],
        },
        include: { job: true },
        orderBy: [{ job: { priority: 'desc' } }, { createdAt: 'asc' }],
      });

      if (!candidate) return null;

      const updatedTask = await tx.task.update({
        where: { id: candidate.id },
        data: {
          status: 'LEASED',
          workerId,
          leaseExpiresAt,
          attempts: { increment: 1 },
          startedAt: candidate.startedAt || now,
        },
        include: { job: true },
      });

      await tx.taskAttempt.create({
        data: {
          taskId: candidate.id,
          workerId,
          attemptNumber: updatedTask.attempts,
          status: 'RUNNING',
          startedAt: now,
        },
      });

      // Update worker and job state
      await tx.worker.update({
        where: { id: workerId },
        data: {
          status: 'BUSY',
          currentTaskId: candidate.id,
          lastHeartbeatAt: now,
        },
      });

      if (candidate.job.status === 'QUEUED') {
        await tx.job.update({
          where: { id: candidate.jobId },
          data: { status: 'RUNNING', startedAt: now },
        });
      }

      return updatedTask;
    });

    if (claimedTask) {
      socketServer.emitTaskAssigned(
        claimedTask.id,
        claimedTask.jobId,
        workerId,
        worker.name
      );
      return {
        taskId: claimedTask.id,
        jobId: claimedTask.jobId,
        chunkIndex: claimedTask.chunkIndex,
        totalChunks: claimedTask.totalChunks,
        workloadType: claimedTask.job.workloadType,
        inputPayload: JSON.parse(claimedTask.inputPayload),
        leaseExpiresAt: claimedTask.leaseExpiresAt,
      };
    }

    return null;
  }

  public async renewTaskLease(taskId: string, workerId: string): Promise<boolean> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + ENV.TASK_LEASE_TIMEOUT_SEC * 1000);

    const task = await prisma.task.findFirst({
      where: { id: taskId, workerId },
    });

    if (!task) return false;

    await prisma.task.update({
      where: { id: taskId },
      data: { leaseExpiresAt, status: 'RUNNING' },
    });

    await prisma.worker.update({
      where: { id: workerId },
      data: { lastHeartbeatAt: now },
    });

    return true;
  }

  public async updateTaskProgress(
    taskId: string,
    workerId: string,
    progress: number,
    message?: string
  ): Promise<void> {
    const task = await prisma.task.findFirst({
      where: { id: taskId, workerId },
    });

    if (!task) return;

    await prisma.task.update({
      where: { id: taskId },
      data: {
        progress,
        status: 'RUNNING',
        leaseExpiresAt: new Date(Date.now() + ENV.TASK_LEASE_TIMEOUT_SEC * 1000),
      },
    });

    socketServer.emitTaskProgress(taskId, task.jobId, progress, message);
  }

  public async completeTask(
    taskId: string,
    workerId: string,
    outputPayload: any,
    runtimeMs: number,
    outputArtifactId?: string
  ): Promise<void> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { job: true },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Idempotency check: if already completed, ignore duplicate submission
    if (task.status === 'COMPLETED') {
      return;
    }

    const now = new Date();

    await prisma.$transaction(async tx => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          outputPayload: JSON.stringify(outputPayload),
          outputArtifactId: outputArtifactId || null,
          runtimeMs,
          completedAt: now,
        },
      });

      // Update attempt record
      const latestAttempt = await tx.taskAttempt.findFirst({
        where: { taskId, workerId },
        orderBy: { attemptNumber: 'desc' },
      });

      if (latestAttempt) {
        await tx.taskAttempt.update({
          where: { id: latestAttempt.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            runtimeMs,
          },
        });
      }

      // Update worker stats
      await tx.worker.update({
        where: { id: workerId },
        data: {
          tasksCompleted: { increment: 1 },
          status: 'ONLINE',
          currentTaskId: null,
          lastHeartbeatAt: now,
        },
      });

      // Update Job progress
      const completedCount = await tx.task.count({
        where: { jobId: task.jobId, status: 'COMPLETED' },
      });

      const progress = Math.round((completedCount / task.job.totalTasks) * 100);

      await tx.job.update({
        where: { id: task.jobId },
        data: {
          completedTasks: completedCount,
          progress,
        },
      });
    });

    socketServer.emitTaskCompleted(taskId, task.jobId, workerId, runtimeMs);

    const updatedJob = await prisma.job.findUnique({
      where: { id: task.jobId },
      include: { tasks: true },
    });

    if (updatedJob && updatedJob.completedTasks >= updatedJob.totalTasks) {
      await this.aggregateAndFinalizeJob(task.jobId);
    } else if (updatedJob) {
      socketServer.emitJobProgress(
        task.jobId,
        updatedJob.progress,
        updatedJob.completedTasks,
        updatedJob.totalTasks
      );
    }
  }

  public async failTask(
    taskId: string,
    workerId: string,
    errorMessage: string,
    canRetry = true
  ): Promise<void> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { job: true },
    });

    if (!task) return;

    const now = new Date();
    const shouldRetry = canRetry && task.attempts < task.maxAttempts;

    await prisma.$transaction(async tx => {
      await tx.worker.update({
        where: { id: workerId },
        data: {
          tasksFailed: { increment: 1 },
          status: 'ONLINE',
          currentTaskId: null,
          lastHeartbeatAt: now,
        },
      });

      if (shouldRetry) {
        await tx.task.update({
          where: { id: taskId },
          data: {
            status: 'QUEUED',
            workerId: null,
            leaseExpiresAt: null,
            errorMessage,
          },
        });

        await tx.jobEvent.create({
          data: {
            jobId: task.jobId,
            taskId,
            type: 'TASK_RETRY',
            severity: 'WARN',
            message: `Task chunk ${task.chunkIndex} failed (Attempt ${task.attempts}/${task.maxAttempts}). Re-queuing. Reason: ${errorMessage}`,
          },
        });
      } else {
        await tx.task.update({
          where: { id: taskId },
          data: {
            status: 'FAILED',
            errorMessage,
            completedAt: now,
          },
        });

        await tx.job.update({
          where: { id: task.jobId },
          data: {
            status: 'FAILED',
            errorMessage: `Job failed because task chunk ${task.chunkIndex} exceeded retry limits: ${errorMessage}`,
            failedTasks: { increment: 1 },
            completedAt: now,
          },
        });

        await tx.jobEvent.create({
          data: {
            jobId: task.jobId,
            taskId,
            type: 'JOB_FAILED',
            severity: 'ERROR',
            message: `Job failed: task chunk ${task.chunkIndex} failed permanently.`,
          },
        });
      }
    });

    socketServer.emitTaskFailed(taskId, task.jobId, workerId, errorMessage);

    if (shouldRetry) {
      const queue = getQueueService();
      await queue.enqueueTask({
        taskId: task.id,
        jobId: task.jobId,
        chunkIndex: task.chunkIndex,
        priority: task.job.priority,
      });
    } else {
      socketServer.emitJobFailed(task.jobId, errorMessage);
    }
  }

  public async aggregateAndFinalizeJob(jobId: string): Promise<void> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        tasks: { orderBy: { chunkIndex: 'asc' } },
      },
    });

    if (!job) return;

    const params = JSON.parse(job.parameters);
    const now = new Date();
    const durationMs = job.startedAt ? now.getTime() - job.startedAt.getTime() : 0;

    if (job.workloadType === 'MATH_PARALLEL') {
      const mathParams = params as MathParallelParams;
      let totalPrimesCount = 0;
      let totalPrimesSum = 0;
      let highestPrime = 0;
      let totalIntegral = 0;
      let totalExecutionTimeMs = 0;

      for (const t of job.tasks) {
        if (!t.outputPayload) continue;
        const out = JSON.parse(t.outputPayload) as MathChunkOutput;
        totalExecutionTimeMs += out.executionTimeMs || 0;

        if (mathParams.algorithm === 'prime-count') {
          totalPrimesCount += out.count || 0;
          totalPrimesSum += out.sum || 0;
          if (out.maxPrime && out.maxPrime > highestPrime) {
            highestPrime = out.maxPrime;
          }
        } else if (mathParams.algorithm === 'numerical-integration') {
          totalIntegral += out.integralValue || 0;
        }
      }

      // Verify against single-process reference implementation
      let verified = false;
      if (mathParams.algorithm === 'prime-count') {
        const ref = referencePrimeCompute(mathParams.rangeStart, mathParams.rangeEnd);
        verified =
          ref.count === totalPrimesCount &&
          ref.sum === totalPrimesSum &&
          ref.maxPrime === highestPrime;
      } else if (mathParams.algorithm === 'numerical-integration') {
        const ref = referenceIntegrationCompute(
          mathParams.rangeStart,
          mathParams.rangeEnd,
          mathParams.totalSteps || 1000,
          mathParams.integrationFunction || 'polynomial'
        );
        verified = Math.abs(ref - totalIntegral) < 0.0001;
      }

      const summary: MathAggregatedResult = {
        algorithm: mathParams.algorithm,
        rangeStart: mathParams.rangeStart,
        rangeEnd: mathParams.rangeEnd,
        totalChunks: job.tasks.length,
        totalPrimesCount:
          mathParams.algorithm === 'prime-count' ? totalPrimesCount : undefined,
        totalPrimesSum:
          mathParams.algorithm === 'prime-count' ? totalPrimesSum : undefined,
        highestPrime:
          mathParams.algorithm === 'prime-count' ? highestPrime : undefined,
        totalIntegral:
          mathParams.algorithm === 'numerical-integration' ? totalIntegral : undefined,
        verifiedAgainstReference: verified,
        totalExecutionTimeMs,
        completedAt: now.toISOString(),
      };

      // Create downloadable artifact for aggregated results
      const artifactBuffer = Buffer.from(JSON.stringify(summary, null, 2), 'utf-8');
      const artifact = await storageService.saveArtifact({
        userId: job.userId,
        jobId: job.id,
        filename: `${job.name.replace(/\s+/g, '_')}_math_result.json`,
        mimeType: 'application/json',
        buffer: artifactBuffer,
      });

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          outputSummary: JSON.stringify(summary),
          outputArtifactId: artifact.id,
          durationMs,
          completedAt: now,
        },
      });

      await prisma.jobEvent.create({
        data: {
          jobId,
          type: 'JOB_COMPLETED',
          severity: 'INFO',
          message: `Job completed successfully. Result verified against reference: ${verified}`,
        },
      });

      socketServer.emitJobCompleted(jobId, summary);
    } else if (job.workloadType === 'FILE_CHUNK_PROCESSING') {
      const fileParams = params as FileChunkParams;
      const combinedFrequencies: Record<string, number> = {};
      let totalLines = 0;
      let totalWords = 0;
      let totalChars = 0;
      let blankLines = 0;
      const matchedLines: string[] = [];

      for (const t of job.tasks) {
        if (!t.outputPayload) continue;
        const out = JSON.parse(t.outputPayload) as FileChunkOutput;
        totalLines += out.linesProcessed || 0;

        if (out.wordFrequencies) {
          for (const [word, count] of Object.entries(out.wordFrequencies)) {
            combinedFrequencies[word] = (combinedFrequencies[word] || 0) + count;
            totalWords += count;
          }
        }

        if (out.lineStats) {
          totalChars += out.lineStats.totalChars || 0;
          blankLines += out.lineStats.blankLines || 0;
        }

        if (out.matchedLines) {
          matchedLines.push(...out.matchedLines);
        }
      }

      // Top words sorted
      const topWords = Object.entries(combinedFrequencies)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);

      const summary: FileAggregatedResult = {
        operation: fileParams.operation,
        filename: fileParams.filename,
        totalChunks: job.tasks.length,
        totalLinesProcessed: totalLines,
        totalWords,
        totalChars,
        blankLines,
        topWords: fileParams.operation === 'word-count' ? topWords : undefined,
        matchedLineCount:
          fileParams.operation === 'regex-filter' ? matchedLines.length : undefined,
        matchedLinesSample:
          fileParams.operation === 'regex-filter' ? matchedLines.slice(0, 100) : undefined,
        completedAt: now.toISOString(),
      };

      const artifactBuffer = Buffer.from(JSON.stringify(summary, null, 2), 'utf-8');
      const artifact = await storageService.saveArtifact({
        userId: job.userId,
        jobId: job.id,
        filename: `${job.name.replace(/\s+/g, '_')}_file_result.json`,
        mimeType: 'application/json',
        buffer: artifactBuffer,
      });

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          outputSummary: JSON.stringify(summary),
          outputArtifactId: artifact.id,
          durationMs,
          completedAt: now,
        },
      });

      await prisma.jobEvent.create({
        data: {
          jobId,
          type: 'JOB_COMPLETED',
          severity: 'INFO',
          message: `File processing completed across ${job.tasks.length} chunks.`,
        },
      });

      socketServer.emitJobCompleted(jobId, summary);
    }
  }

  public startLeaseRecoveryDaemon(): void {
    if (this.recoveryInterval) return;

    this.recoveryInterval = setInterval(async () => {
      try {
        const now = new Date();
        const heartbeatThreshold = new Date(
          now.getTime() - ENV.WORKER_HEARTBEAT_TIMEOUT_SEC * 1000
        );

        // 1. Mark stale workers as OFFLINE
        const staleWorkers = await prisma.worker.findMany({
          where: {
            status: { in: ['ONLINE', 'BUSY'] },
            lastHeartbeatAt: { lt: heartbeatThreshold },
          },
        });

        for (const w of staleWorkers) {
          await prisma.worker.update({
            where: { id: w.id },
            data: { status: 'OFFLINE' },
          });
          socketServer.emitWorkerStatusChanged(w.id, 'OFFLINE');
        }

        // 2. Recover expired tasks
        const expiredTasks = await prisma.task.findMany({
          where: {
            status: { in: ['LEASED', 'RUNNING'] },
            leaseExpiresAt: { lt: now },
          },
          include: { job: true },
        });

        for (const t of expiredTasks) {
          if (t.attempts < t.maxAttempts) {
            console.log(
              `[Scheduler] Recovering expired task ${t.id} (chunk ${t.chunkIndex}) from worker ${t.workerId}`
            );
            await prisma.task.update({
              where: { id: t.id },
              data: {
                status: 'QUEUED',
                workerId: null,
                leaseExpiresAt: null,
              },
            });

            await prisma.jobEvent.create({
              data: {
                jobId: t.jobId,
                taskId: t.id,
                type: 'LEASE_EXPIRED',
                severity: 'WARN',
                message: `Task chunk ${t.chunkIndex} lease expired. Re-enqueuing.`,
              },
            });

            const queue = getQueueService();
            await queue.enqueueTask({
              taskId: t.id,
              jobId: t.jobId,
              chunkIndex: t.chunkIndex,
              priority: t.job.priority,
            });
          } else {
            await prisma.task.update({
              where: { id: t.id },
              data: {
                status: 'FAILED',
                errorMessage: 'Task lease expired and max retries exceeded',
                completedAt: now,
              },
            });

            await prisma.job.update({
              where: { id: t.jobId },
              data: {
                status: 'FAILED',
                errorMessage: `Task ${t.chunkIndex} abandoned by worker and retries exhausted`,
                completedAt: now,
              },
            });

            socketServer.emitJobFailed(
              t.jobId,
              `Task ${t.chunkIndex} abandoned by worker and retries exhausted`
            );
          }
        }
      } catch (err) {
        console.error('[Scheduler] Recovery daemon error:', err);
      }
    }, 5000);

    console.log('[Scheduler] Background lease recovery daemon running');
  }

  public stopLeaseRecoveryDaemon(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
  }
}

export const taskScheduler = new TaskScheduler();
