import { Queue, Worker as BullWorker, Job as BullJob } from 'bullmq';
import Redis from 'ioredis';
import { ENV } from '../config/env.js';

export interface TaskJobData {
  taskId: string;
  jobId: string;
  chunkIndex: number;
  priority: number;
}

export type TaskHandler = (data: TaskJobData) => Promise<void>;

export interface IQueueService {
  enqueueTask(data: TaskJobData): Promise<void>;
  registerProcessor(handler: TaskHandler): void;
  close(): Promise<void>;
  isRedisConnected(): boolean;
}

// In-Memory Fallback Queue for zero-dependency local execution
class LocalMemoryQueueService implements IQueueService {
  private queue: TaskJobData[] = [];
  private handler: TaskHandler | null = null;
  private isProcessing = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.intervalTimer = setInterval(() => this.processNext(), 200);
  }

  public async enqueueTask(data: TaskJobData): Promise<void> {
    this.queue.push(data);
    // Sort by priority descending (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  public registerProcessor(handler: TaskHandler): void {
    this.handler = handler;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || !this.handler) return;
    this.isProcessing = true;
    const item = this.queue.shift();
    if (item) {
      try {
        await this.handler(item);
      } catch (err) {
        console.error('[LocalQueue] Task processing error:', err);
      }
    }
    this.isProcessing = false;
  }

  public async close(): Promise<void> {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.queue = [];
  }

  public isRedisConnected(): boolean {
    return false;
  }
}

// BullMQ Queue Service with Redis
class BullQueueService implements IQueueService {
  private bullQueue: Queue<TaskJobData>;
  private bullWorker: BullWorker<TaskJobData> | null = null;
  private redisClient: Redis;
  private connected = true;

  constructor(redisClient: Redis) {
    this.redisClient = redisClient;
    this.bullQueue = new Queue<TaskJobData>('computegrid_tasks', {
      connection: this.redisClient,
    });
  }

  public async enqueueTask(data: TaskJobData): Promise<void> {
    await this.bullQueue.add(`task_${data.taskId}`, data, {
      priority: data.priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  public registerProcessor(handler: TaskHandler): void {
    this.bullWorker = new BullWorker<TaskJobData>(
      'computegrid_tasks',
      async (job: BullJob<TaskJobData>) => {
        await handler(job.data);
      },
      {
        connection: this.redisClient,
        concurrency: 5,
      }
    );

    this.bullWorker.on('failed', (job, err) => {
      console.warn(`[BullMQ] Task ${job?.data.taskId} failed:`, err.message);
    });
  }

  public async close(): Promise<void> {
    if (this.bullWorker) {
      await this.bullWorker.close();
    }
    await this.bullQueue.close();
    await this.redisClient.quit();
  }

  public isRedisConnected(): boolean {
    return this.connected;
  }
}

let activeQueueService: IQueueService = new LocalMemoryQueueService();

export async function initQueueService(): Promise<IQueueService> {
  try {
    const redis = new Redis(ENV.REDIS_URL, {
      maxRetriesPerRequest: null,
      connectTimeout: 1000,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    redis.on('error', () => {
      // Suppress unhandled error log when redis is offline
    });

    await redis.connect();
    console.log('[Queue] Connected to Redis. Using BullMQ queue engine.');
    activeQueueService = new BullQueueService(redis);
  } catch {
    console.log('[Queue] Redis not reachable on ' + ENV.REDIS_URL + '. Running with resilient LocalQueueProvider.');
    activeQueueService = new LocalMemoryQueueService();
  }

  return activeQueueService;
}

export function getQueueService(): IQueueService {
  return activeQueueService;
}
