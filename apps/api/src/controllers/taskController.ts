import { Request, Response, NextFunction } from 'express';
import { taskScheduler } from '../scheduler/taskScheduler.js';
import { prisma } from '../services/db.js';
import {
  TaskProgressSchema,
  TaskCompleteSchema,
  TaskFailSchema,
  WorkloadType,
} from '@computegrid/shared';

export class TaskController {
  public static async claim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.worker) {
        res.status(401).json({ success: false, error: 'Unauthorized worker' });
        return;
      }

      const worker = await prisma.worker.findUnique({
        where: { id: req.worker.id },
      });

      if (!worker || worker.status === 'PAUSED' || worker.status === 'REVOKED') {
        res.status(403).json({ success: false, error: 'Worker is paused or revoked' });
        return;
      }

      const capabilities = JSON.parse(worker.capabilities);
      const supportedWorkloads: WorkloadType[] = capabilities.supportedWorkloads || [
        'MATH_PARALLEL',
        'FILE_CHUNK_PROCESSING',
      ];

      const claimed = await taskScheduler.claimTask(req.worker.id, supportedWorkloads);

      if (!claimed) {
        res.status(204).send(); // No task currently available
        return;
      }

      res.json({ success: true, data: claimed });
    } catch (err) {
      next(err);
    }
  }

  public static async heartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.worker) {
        res.status(401).json({ success: false, error: 'Unauthorized worker' });
        return;
      }

      const taskId = req.params.taskId as string;
      const renewed = await taskScheduler.renewTaskLease(taskId, req.worker.id);

      if (!renewed) {
        res.status(404).json({ success: false, error: 'Task not found or not assigned to this worker' });
        return;
      }

      res.json({ success: true, message: 'Task lease renewed' });
    } catch (err) {
      next(err);
    }
  }

  public static async progress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.worker) {
        res.status(401).json({ success: false, error: 'Unauthorized worker' });
        return;
      }

      const taskId = req.params.taskId as string;
      const body = TaskProgressSchema.parse(req.body);

      await taskScheduler.updateTaskProgress(taskId, req.worker.id, body.progress, body.message);

      res.json({ success: true, message: 'Progress updated' });
    } catch (err) {
      next(err);
    }
  }

  public static async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.worker) {
        res.status(401).json({ success: false, error: 'Unauthorized worker' });
        return;
      }

      const taskId = req.params.taskId as string;
      const body = TaskCompleteSchema.parse({
        workerId: req.worker.id,
        ...req.body,
      });

      await taskScheduler.completeTask(
        taskId,
        req.worker.id,
        body.outputPayload,
        body.runtimeMs,
        body.outputArtifactId
      );

      res.json({ success: true, message: 'Task marked as completed' });
    } catch (err) {
      next(err);
    }
  }

  public static async fail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.worker) {
        res.status(401).json({ success: false, error: 'Unauthorized worker' });
        return;
      }

      const taskId = req.params.taskId as string;
      const body = TaskFailSchema.parse({
        workerId: req.worker.id,
        ...req.body,
      });

      await taskScheduler.failTask(taskId, req.worker.id, body.errorMessage, body.canRetry);

      res.json({ success: true, message: 'Task failure recorded' });
    } catch (err) {
      next(err);
    }
  }
}
