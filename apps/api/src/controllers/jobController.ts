import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/db.js';
import { taskScheduler } from '../scheduler/taskScheduler.js';
import { socketServer } from '../socket/socketServer.js';
import {
  CreateJobSchema,
  MathWorkloadParamsSchema,
  FileWorkloadParamsSchema,
} from '@computegrid/shared';

export class JobController {
  public static async createJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const body = CreateJobSchema.parse(req.body);

      // Validate parameters against specific workload schemas
      if (body.workloadType === 'MATH_PARALLEL') {
        MathWorkloadParamsSchema.parse(body.parameters);
      } else if (body.workloadType === 'FILE_CHUNK_PROCESSING') {
        FileWorkloadParamsSchema.parse(body.parameters);
      }

      const job = await prisma.job.create({
        data: {
          userId: req.user.id,
          name: body.name,
          description: body.description || null,
          workloadType: body.workloadType,
          priority: body.priority,
          maxRetriesPerTask: body.maxRetriesPerTask,
          parameters: JSON.stringify(body.parameters),
          status: 'CREATED',
        },
      });

      await prisma.jobEvent.create({
        data: {
          jobId: job.id,
          type: 'JOB_CREATED',
          severity: 'INFO',
          message: `Job '${job.name}' created by user ${req.user.username}`,
        },
      });

      socketServer.emitJobCreated(job, req.user.id);

      // Trigger partitioning and scheduling asynchronously
      taskScheduler.partitionAndScheduleJob(job.id).catch(err => {
        console.error(`[Scheduler] Failed to partition job ${job.id}:`, err);
      });

      res.status(201).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }

  public static async listJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { status, workloadType, search, page = '1', limit = '20' } = req.query;
      const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
      const take = parseInt(limit as string, 10);

      const where: any = {};
      if (req.user.role !== 'ADMIN') {
        where.userId = req.user.id;
      }
      if (status) {
        where.status = status as string;
      }
      if (workloadType) {
        where.workloadType = workloadType as string;
      }
      if (search) {
        where.name = { contains: search as string };
      }

      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: {
            user: { select: { id: true, username: true } },
            tasks: {
              orderBy: { chunkIndex: 'asc' },
              include: { worker: { select: { id: true, name: true, os: true } } },
            },
            artifacts: true,
            events: {
              orderBy: { timestamp: 'desc' },
              take: 20,
            },
          },
        }),
        prisma.job.count({ where }),
      ]);

      const formattedJobs = jobs.map(j => ({
        ...j,
        parameters: JSON.parse(j.parameters),
        outputSummary: j.outputSummary ? JSON.parse(j.outputSummary) : null,
        tasks: j.tasks?.map(t => ({
          ...t,
          inputPayload: t.inputPayload ? JSON.parse(t.inputPayload) : null,
          outputPayload: t.outputPayload ? JSON.parse(t.outputPayload) : null,
        })),
      }));

      res.json({
        success: true,
        data: formattedJobs,
        meta: {
          page: parseInt(page as string, 10),
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const jobId = req.params.jobId as string;
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          tasks: {
            orderBy: { chunkIndex: 'asc' },
            include: { worker: { select: { id: true, name: true } } },
          },
          events: {
            orderBy: { timestamp: 'desc' },
            take: 50,
          },
          artifacts: true,
          user: { select: { id: true, username: true } },
        },
      });

      if (!job) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      if (req.user.role !== 'ADMIN' && job.userId !== req.user.id) {
        res.status(403).json({ success: false, error: 'Access forbidden to this job' });
        return;
      }

      const formatted = {
        ...job,
        parameters: JSON.parse(job.parameters),
        outputSummary: job.outputSummary ? JSON.parse(job.outputSummary) : null,
        tasks: job.tasks.map(t => ({
          ...t,
          inputPayload: JSON.parse(t.inputPayload),
          outputPayload: t.outputPayload ? JSON.parse(t.outputPayload) : null,
        })),
      };

      res.json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }

  public static async cancelJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const jobId = req.params.jobId as string;
      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      if (req.user.role !== 'ADMIN' && job.userId !== req.user.id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
        res.status(400).json({
          success: false,
          error: `Cannot cancel job in ${job.status} state`,
        });
        return;
      }

      await prisma.$transaction(async tx => {
        await tx.job.update({
          where: { id: jobId },
          data: { status: 'CANCELLED', completedAt: new Date() },
        });

        await tx.task.updateMany({
          where: {
            jobId,
            status: { in: ['PENDING', 'QUEUED', 'LEASED', 'RUNNING', 'RETRYING'] },
          },
          data: { status: 'CANCELLED' },
        });

        await tx.jobEvent.create({
          data: {
            jobId,
            type: 'JOB_CANCELLED',
            severity: 'WARN',
            message: `Job was cancelled by ${req.user!.username}`,
          },
        });
      });

      socketServer.emitEvent('job.cancelled' as any, { jobId });

      res.json({ success: true, message: 'Job cancelled successfully' });
    } catch (err) {
      next(err);
    }
  }

  public static async retryJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const jobId = req.params.jobId as string;
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { tasks: true },
      });

      if (!job) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      if (req.user.role !== 'ADMIN' && job.userId !== req.user.id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      if (job.status !== 'FAILED') {
        res.status(400).json({
          success: false,
          error: 'Only failed jobs can be retried',
        });
        return;
      }

      await prisma.$transaction(async tx => {
        // Reset failed tasks
        await tx.task.updateMany({
          where: { jobId, status: 'FAILED' },
          data: {
            status: 'QUEUED',
            workerId: null,
            attempts: 0,
            errorMessage: null,
            progress: 0,
          },
        });

        await tx.job.update({
          where: { id: jobId },
          data: {
            status: 'QUEUED',
            errorMessage: null,
            completedAt: null,
          },
        });

        await tx.jobEvent.create({
          data: {
            jobId,
            type: 'JOB_RETRIED',
            severity: 'INFO',
            message: `Job retry initiated by ${req.user!.username}`,
          },
        });
      });

      socketServer.emitJobProgress(jobId, job.progress, job.completedTasks, job.totalTasks);

      res.json({ success: true, message: 'Job retried and re-enqueued successfully' });
    } catch (err) {
      next(err);
    }
  }

  public static async getJobTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params.jobId as string;

      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true, userId: true },
      });

      if (!job) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      if (req.user?.role !== 'ADMIN' && job.userId !== req.user?.id) {
        res.status(403).json({ success: false, error: 'Access forbidden to this job' });
        return;
      }

      const tasks = await prisma.task.findMany({
        where: { jobId },
        orderBy: { chunkIndex: 'asc' },
        include: {
          worker: { select: { id: true, name: true, os: true } },
          attemptsList: { orderBy: { attemptNumber: 'desc' } },
        },
      });

      const formatted = tasks.map(t => ({
        ...t,
        inputPayload: JSON.parse(t.inputPayload),
        outputPayload: t.outputPayload ? JSON.parse(t.outputPayload) : null,
      }));

      res.json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }

  public static async getJobLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params.jobId as string;

      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true, userId: true },
      });

      if (!job) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      if (req.user?.role !== 'ADMIN' && job.userId !== req.user?.id) {
        res.status(403).json({ success: false, error: 'Access forbidden to this job' });
        return;
      }

      const logs = await prisma.jobEvent.findMany({
        where: { jobId },
        orderBy: { timestamp: 'desc' },
      });
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }

  public static async getJobResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params.jobId as string;
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          userId: true,
          status: true,
          outputSummary: true,
          outputArtifactId: true,
          durationMs: true,
          completedAt: true,
        },
      });

      if (!job) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      if (req.user?.role !== 'ADMIN' && job.userId !== req.user?.id) {
        res.status(403).json({ success: false, error: 'Access forbidden to this job' });
        return;
      }

      res.json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          outputSummary: job.outputSummary ? JSON.parse(job.outputSummary) : null,
          outputArtifactId: job.outputArtifactId,
          downloadUrl: job.outputArtifactId
            ? `/api/v1/artifacts/${job.outputArtifactId}/download`
            : null,
          durationMs: job.durationMs,
          completedAt: job.completedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
