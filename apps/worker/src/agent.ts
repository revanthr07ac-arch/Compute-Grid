import os from 'os';
import { WorkerConfig } from './config.js';
import { TaskExecutor } from './executor.js';

export class WorkerAgent {
  private config: WorkerConfig;
  private isRunning = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private activeTasksCount = 0;
  private tasksCompletedCount = 0;
  private isPaused = false;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  public async start(): Promise<void> {
    console.log(`[Worker] Starting agent '${this.config.workerName}'...`);
    console.log(`[Worker] Target Server: ${this.config.serverUrl}`);

    // Check if registration / enrollment needed
    if (!this.config.workerId || !this.config.workerSecret) {
      if (!this.config.enrollmentToken) {
        throw new Error(
          'Missing worker credentials and no enrollment token provided. Pass --token <token>'
        );
      }
      await this.enroll(this.config.enrollmentToken);
    }

    console.log(`[Worker] Authenticated as Worker ID: ${this.config.workerId}`);
    this.isRunning = true;

    // Start periodic heartbeats
    this.startHeartbeatLoop();

    // Start task claim and execution loop
    this.startPollingLoop();
  }

  public async enroll(token: string): Promise<void> {
    console.log('[Worker] Enrolling with token...');
    const payload = {
      name: this.config.workerName,
      enrollmentToken: token,
      hostname: os.hostname(),
      os: os.platform(),
      arch: os.arch(),
      agentVersion: '1.0.0',
      capabilities: {
        supportedWorkloads: ['MATH_PARALLEL', 'FILE_CHUNK_PROCESSING'],
        maxConcurrency: this.config.maxConcurrency,
        cpuCores: os.cpus().length,
        totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
      },
    };

    const res = await fetch(`${this.config.serverUrl}/api/v1/workers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`Enrollment failed (${res.status}): ${JSON.stringify(err)}`);
    }

    const data = (await res.json()) as any;
    const { workerId, workerSecret, name } = data.data;

    this.config.saveCredentials(workerId, workerSecret, name);
    console.log('[Worker] Enrollment successful. Credentials saved.');
  }

  private startHeartbeatLoop(): void {
    const sendHeartbeat = async () => {
      if (!this.isRunning) return;

      try {
        const memFree = os.freemem();
        const memTotal = os.totalmem();
        const memoryUsedMb = Math.round((memTotal - memFree) / (1024 * 1024));
        const memoryTotalMb = Math.round(memTotal / (1024 * 1024));

        const res = await fetch(`${this.config.serverUrl}/api/v1/workers/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-id': this.config.workerId,
            'x-worker-secret': this.config.workerSecret,
          },
          body: JSON.stringify({
            cpuUsagePercent: 10,
            memoryUsedMb,
            memoryTotalMb,
            tasksActive: this.activeTasksCount,
            tasksCompleted: this.tasksCompletedCount,
          }),
        });

        if (res.status === 403) {
          if (!this.isPaused) {
            console.warn('[Worker] Worker has been paused or revoked by grid administrator.');
            this.isPaused = true;
          }
        } else if (res.ok) {
          this.isPaused = false;
        }
      } catch (err: any) {
        console.warn('[Worker] Heartbeat warning (will retry):', err.message);
      }
    };

    sendHeartbeat();
    this.heartbeatTimer = setInterval(sendHeartbeat, this.config.heartbeatIntervalMs);
  }

  private startPollingLoop(): void {
    const pollAndRun = async () => {
      if (!this.isRunning) return;

      if (!this.isPaused && this.activeTasksCount < this.config.maxConcurrency) {
        try {
          await this.claimAndExecuteTask();
        } catch (err: any) {
          console.error('[Worker] Task poll error:', err.message);
        }
      }

      if (this.isRunning) {
        this.pollTimer = setTimeout(pollAndRun, this.config.pollIntervalMs);
      }
    };

    pollAndRun();
  }

  private async claimAndExecuteTask(): Promise<void> {
    const res = await fetch(`${this.config.serverUrl}/api/v1/worker/tasks/claim`, {
      headers: {
        'x-worker-id': this.config.workerId,
        'x-worker-secret': this.config.workerSecret,
      },
    });

    if (res.status === 204 || res.status === 404) {
      return; // No tasks available right now
    }

    if (!res.ok) {
      if (res.status === 403) {
        this.isPaused = true;
      }
      return;
    }

    const json = (await res.json()) as any;
    const task = json.data;

    if (!task) return;

    this.activeTasksCount++;
    console.log(
      `[Worker] Claimed task ${task.taskId} (Job ${task.jobId}, Chunk ${task.chunkIndex + 1}/${task.totalChunks}) [${task.workloadType}]`
    );

    // Heartbeat lease renewal for this task
    const leaseTimer = setInterval(async () => {
      try {
        await fetch(
          `${this.config.serverUrl}/api/v1/worker/tasks/${task.taskId}/heartbeat`,
          {
            method: 'POST',
            headers: {
              'x-worker-id': this.config.workerId,
              'x-worker-secret': this.config.workerSecret,
            },
          }
        );
      } catch {
        // Suppress lease renewal network error
      }
    }, 15000);

    const onProgress = async (pct: number, message?: string) => {
      try {
        await fetch(
          `${this.config.serverUrl}/api/v1/worker/tasks/${task.taskId}/progress`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-worker-id': this.config.workerId,
              'x-worker-secret': this.config.workerSecret,
            },
            body: JSON.stringify({ progress: pct, message }),
          }
        );
      } catch {
        // Suppress progress network error
      }
    };

    try {
      let outputPayload: any;
      const startTime = Date.now();

      if (task.workloadType === 'MATH_PARALLEL') {
        outputPayload = await TaskExecutor.executeMathTask(task.inputPayload, onProgress);
      } else if (task.workloadType === 'FILE_CHUNK_PROCESSING') {
        outputPayload = await TaskExecutor.executeFileTask(task.inputPayload, onProgress);
      } else {
        throw new Error(`Unsupported workload type: ${task.workloadType}`);
      }

      const runtimeMs = Date.now() - startTime;

      // Submit completed task
      const compRes = await fetch(
        `${this.config.serverUrl}/api/v1/worker/tasks/${task.taskId}/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-id': this.config.workerId,
            'x-worker-secret': this.config.workerSecret,
          },
          body: JSON.stringify({
            outputPayload,
            runtimeMs,
          }),
        }
      );

      if (compRes.ok) {
        this.tasksCompletedCount++;
        console.log(`[Worker] Task ${task.taskId} completed successfully in ${runtimeMs}ms`);
      } else {
        console.error(`[Worker] Failed to complete task on server: ${compRes.statusText}`);
      }
    } catch (err: any) {
      console.error(`[Worker] Task execution failed:`, err.message);
      try {
        await fetch(
          `${this.config.serverUrl}/api/v1/worker/tasks/${task.taskId}/fail`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-worker-id': this.config.workerId,
              'x-worker-secret': this.config.workerSecret,
            },
            body: JSON.stringify({
              errorMessage: err.message,
              canRetry: true,
            }),
          }
        );
      } catch {
        // Suppress fail report error
      }
    } finally {
      clearInterval(leaseTimer);
      this.activeTasksCount--;
    }
  }

  public stop(): void {
    console.log('[Worker] Shutting down worker agent...');
    this.isRunning = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollTimer) clearTimeout(this.pollTimer);
    console.log('[Worker] Worker agent stopped cleanly.');
  }
}
