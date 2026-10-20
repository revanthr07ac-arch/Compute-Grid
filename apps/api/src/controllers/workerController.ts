import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/db.js';
import { socketServer } from '../socket/socketServer.js';
import { WorkerEnrollSchema, WorkerHeartbeatSchema } from '@computegrid/shared';

export class WorkerController {
  public static async createEnrollmentToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const tokenString = `cg_enroll_${crypto.randomBytes(24).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const token = await prisma.workerEnrollmentToken.create({
        data: {
          userId: req.user.id,
          token: tokenString,
          expiresAt,
          maxUses: 1,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          token: token.token,
          expiresAt: token.expiresAt,
          installCommand: `npx @computegrid/worker start --server http://localhost:4000 --token ${token.token}`,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async registerWorker(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = WorkerEnrollSchema.parse(req.body);

      // Verify enrollment token
      const enrollment = await prisma.workerEnrollmentToken.findUnique({
        where: { token: data.enrollmentToken },
      });

      if (!enrollment || enrollment.revoked || enrollment.expiresAt < new Date()) {
        res.status(401).json({
          success: false,
          error: 'Enrollment token is invalid, expired, or revoked',
        });
        return;
      }

      if (enrollment.usesCount >= enrollment.maxUses) {
        res.status(401).json({
          success: false,
          error: 'Enrollment token has already been used',
        });
        return;
      }

      // Generate secret credential
      const rawSecret = crypto.randomBytes(32).toString('hex');
      const secretHash = await bcrypt.hash(rawSecret, 10);

      // Create worker in transaction
      const result = await prisma.$transaction(async tx => {
        await tx.workerEnrollmentToken.update({
          where: { id: enrollment.id },
          data: {
            usesCount: { increment: 1 },
            revoked: true, // single-use token revoked immediately
          },
        });

        const worker = await tx.worker.create({
          data: {
            userId: enrollment.userId,
            name: data.name,
            hostname: data.hostname,
            os: data.os,
            arch: data.arch,
            agentVersion: data.agentVersion,
            status: 'ONLINE',
            capabilities: JSON.stringify(data.capabilities),
            lastHeartbeatAt: new Date(),
          },
        });

        await tx.workerCredential.create({
          data: {
            workerId: worker.id,
            secretHash,
          },
        });

        return worker;
      });

      socketServer.emitWorkerConnected({
        id: result.id,
        name: result.name,
        hostname: result.hostname,
        os: result.os,
        status: 'ONLINE',
      });

      // Return unhashed secret once to the worker
      res.status(201).json({
        success: true,
        data: {
          workerId: result.id,
          workerSecret: rawSecret,
          name: result.name,
          message: 'Worker registered successfully. Keep your workerSecret secure.',
        },
      });
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

      const metrics = WorkerHeartbeatSchema.parse(req.body);
      const now = new Date();

      await prisma.worker.update({
        where: { id: req.worker.id },
        data: {
          lastHeartbeatAt: now,
          status: metrics.tasksActive > 0 ? 'BUSY' : 'ONLINE',
        },
      });

      await prisma.workerMetrics.create({
        data: {
          workerId: req.worker.id,
          cpuUsagePercent: metrics.cpuUsagePercent,
          memoryUsedMb: metrics.memoryUsedMb,
          memoryTotalMb: metrics.memoryTotalMb,
          tasksActive: metrics.tasksActive,
          tasksCompleted: metrics.tasksCompleted,
          uptimeSeconds: 0,
        },
      });

      res.json({
        success: true,
        data: {
          serverTime: now.toISOString(),
          status: 'ACKNOWLEDGED',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listWorkers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const where: any = {};
      if (req.user.role !== 'ADMIN') {
        where.userId = req.user.id;
      }

      const workers = await prisma.worker.findMany({
        where,
        orderBy: { lastHeartbeatAt: 'desc' },
        include: {
          user: { select: { id: true, username: true } },
          metrics: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      const formatted = workers.map(w => ({
        ...w,
        capabilities: JSON.parse(w.capabilities),
        latestMetrics: w.metrics[0] || null,
      }));

      res.json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }

  public static async getWorker(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const workerId = req.params.workerId as string;
      const worker = await prisma.worker.findUnique({
        where: { id: workerId },
        include: {
          metrics: {
            orderBy: { timestamp: 'desc' },
            take: 20,
          },
          taskAttempts: {
            orderBy: { startedAt: 'desc' },
            take: 10,
          },
          user: { select: { id: true, username: true } },
        },
      });

      if (!worker) {
        res.status(404).json({ success: false, error: 'Worker not found' });
        return;
      }

      if (req.user.role !== 'ADMIN' && worker.userId !== req.user.id) {
        res.status(403).json({ success: false, error: 'Access forbidden' });
        return;
      }

      res.json({
        success: true,
        data: {
          ...worker,
          capabilities: JSON.parse(worker.capabilities),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async pauseWorker(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const workerId = req.params.workerId as string;
      const worker = await prisma.worker.findUnique({ where: { id: workerId } });

      if (!worker) {
        res.status(404).json({ success: false, error: 'Worker not found' });
        return;
      }

      if (req.user.role !== 'ADMIN' && worker.userId !== req.user.id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      await prisma.worker.update({
        where: { id: workerId },
        data: { status: 'PAUSED' },
      });

      socketServer.emitWorkerStatusChanged(workerId, 'PAUSED');

      res.json({ success: true, message: 'Worker paused successfully' });
    } catch (err) {
      next(err);
    }
  }

  public static async resumeWorker(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const workerId = req.params.workerId as string;
      const worker = await prisma.worker.findUnique({ where: { id: workerId } });

      if (!worker) {
        res.status(404).json({ success: false, error: 'Worker not found' });
        return;
      }

      if (req.user.role !== 'ADMIN' && worker.userId !== req.user.id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      await prisma.worker.update({
        where: { id: workerId },
        data: { status: 'ONLINE' },
      });

      socketServer.emitWorkerStatusChanged(workerId, 'ONLINE');

      res.json({ success: true, message: 'Worker resumed successfully' });
    } catch (err) {
      next(err);
    }
  }

  public static async revokeWorker(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const workerId = req.params.workerId as string;
      const worker = await prisma.worker.findUnique({ where: { id: workerId } });

      if (!worker) {
        res.status(404).json({ success: false, error: 'Worker not found' });
        return;
      }

      if (req.user.role !== 'ADMIN' && worker.userId !== req.user.id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      await prisma.$transaction(async tx => {
        await tx.worker.update({
          where: { id: workerId },
          data: { status: 'REVOKED' },
        });

        await tx.workerCredential.updateMany({
          where: { workerId },
          data: { revokedAt: new Date() },
        });

        // Reclaim currently leased task if any
        await tx.task.updateMany({
          where: { workerId, status: { in: ['LEASED', 'RUNNING'] } },
          data: { status: 'QUEUED', workerId: null, leaseExpiresAt: null },
        });
      });

      socketServer.emitWorkerStatusChanged(workerId, 'REVOKED');

      res.json({ success: true, message: 'Worker revoked successfully' });
    } catch (err) {
      next(err);
    }
  }
}
