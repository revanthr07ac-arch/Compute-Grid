import { Request, Response } from 'express';
import { prisma } from '../services/db.js';
import { getQueueService } from '../services/queueService.js';

export class HealthController {
  public static async live(req: Request, res: Response): Promise<void> {
    res.json({ status: 'UP', timestamp: new Date().toISOString() });
  }

  public static async ready(req: Request, res: Response): Promise<void> {
    try {
      // Check database connectivity
      await prisma.$queryRaw`SELECT 1`;

      const queue = getQueueService();

      res.json({
        status: 'READY',
        database: 'CONNECTED',
        queue: queue.isRedisConnected() ? 'BULLMQ_REDIS' : 'LOCAL_EMBEDDED',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'NOT_READY',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public static async metrics(req: Request, res: Response): Promise<void> {
    try {
      const [
        totalJobs,
        queuedJobs,
        runningJobs,
        completedJobs,
        failedJobs,
        totalWorkers,
        activeWorkers,
        totalTasksExecuted,
      ] = await Promise.all([
        prisma.job.count(),
        prisma.job.count({ where: { status: 'QUEUED' } }),
        prisma.job.count({ where: { status: 'RUNNING' } }),
        prisma.job.count({ where: { status: 'COMPLETED' } }),
        prisma.job.count({ where: { status: 'FAILED' } }),
        prisma.worker.count(),
        prisma.worker.count({ where: { status: { in: ['ONLINE', 'BUSY'] } } }),
        prisma.task.count({ where: { status: 'COMPLETED' } }),
      ]);

      // Last 7 days job history aggregate
      const recentEvents = await prisma.jobEvent.findMany({
        where: { type: 'JOB_COMPLETED' },
        orderBy: { timestamp: 'desc' },
        take: 30,
      });

      res.json({
        success: true,
        data: {
          totalJobs,
          queuedJobs,
          runningJobs,
          completedJobs,
          failedJobs,
          totalWorkers,
          activeWorkers,
          totalTasksExecuted,
          computeUsageHistory: recentEvents.map(e => ({
            timestamp: e.timestamp.toISOString(),
            completedTasks: 1,
            activeWorkers,
          })),
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
