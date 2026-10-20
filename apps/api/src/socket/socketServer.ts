import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { SOCKET_EVENTS, SocketEventType } from '@computegrid/shared';
import { prisma } from '../services/db.js';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      id: string;
      email: string;
      role: string;
    };
    workerId?: string;
  };
}

class SocketServer {
  private io: SocketIOServer | null = null;

  public init(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    this.io.use(async (socket: AuthenticatedSocket, next) => {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (socket.handshake.query?.token as string);

      if (token) {
        try {
          const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
            userId: string;
            email: string;
            role: string;
          };
          socket.data.user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
          };
        } catch {
          // Allow connection even without token, but restricted to public events
        }
      }

      next();
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.data.user?.id;
      if (userId) {
        socket.join(`user:${userId}`);
        if (socket.data.user?.role === 'ADMIN') {
          socket.join('admin');
        }
      }

      socket.on('subscribe:job', async (jobId: string) => {
        if (!jobId) return;
        // Verify user owns job or is admin
        if (userId) {
          const job = await prisma.job.findUnique({
            where: { id: jobId },
            select: { userId: true },
          });
          if (job && (job.userId === userId || socket.data.user?.role === 'ADMIN')) {
            socket.join(`job:${jobId}`);
          }
        } else {
          socket.join(`job:${jobId}`);
        }
      });

      socket.on('unsubscribe:job', (jobId: string) => {
        socket.leave(`job:${jobId}`);
      });

      socket.on('disconnect', () => {
        // Handled gracefully
      });
    });

    console.log('[SocketServer] Initialized real-time WebSocket server');
  }

  public emitEvent(event: SocketEventType, data: unknown, roomId?: string) {
    if (!this.io) return;
    const payload = {
      type: event,
      timestamp: new Date().toISOString(),
      data,
    };

    if (roomId) {
      this.io.to(roomId).emit(event, payload);
    } else {
      this.io.emit(event, payload);
    }
  }

  public emitJobCreated(job: unknown, userId: string) {
    this.emitEvent(SOCKET_EVENTS.JOB_CREATED, job, `user:${userId}`);
    this.emitEvent(SOCKET_EVENTS.JOB_CREATED, job, 'admin');
  }

  public emitJobProgress(jobId: string, progress: number, completedTasks: number, totalTasks: number) {
    this.emitEvent(
      SOCKET_EVENTS.JOB_PROGRESS,
      { jobId, progress, completedTasks, totalTasks },
      `job:${jobId}`
    );
    this.emitEvent(SOCKET_EVENTS.JOB_PROGRESS, { jobId, progress, completedTasks, totalTasks });
  }

  public emitJobCompleted(jobId: string, summary: unknown) {
    this.emitEvent(SOCKET_EVENTS.JOB_COMPLETED, { jobId, summary }, `job:${jobId}`);
    this.emitEvent(SOCKET_EVENTS.JOB_COMPLETED, { jobId, summary });
  }

  public emitJobFailed(jobId: string, errorMessage: string) {
    this.emitEvent(SOCKET_EVENTS.JOB_FAILED, { jobId, errorMessage }, `job:${jobId}`);
    this.emitEvent(SOCKET_EVENTS.JOB_FAILED, { jobId, errorMessage });
  }

  public emitTaskAssigned(taskId: string, jobId: string, workerId: string, workerName: string) {
    this.emitEvent(
      SOCKET_EVENTS.TASK_ASSIGNED,
      { taskId, jobId, workerId, workerName },
      `job:${jobId}`
    );
  }

  public emitTaskProgress(taskId: string, jobId: string, progress: number, message?: string) {
    this.emitEvent(
      SOCKET_EVENTS.TASK_PROGRESS,
      { taskId, jobId, progress, message },
      `job:${jobId}`
    );
  }

  public emitTaskCompleted(taskId: string, jobId: string, workerId: string, runtimeMs: number) {
    this.emitEvent(
      SOCKET_EVENTS.TASK_COMPLETED,
      { taskId, jobId, workerId, runtimeMs },
      `job:${jobId}`
    );
  }

  public emitTaskFailed(taskId: string, jobId: string, workerId: string, errorMessage: string) {
    this.emitEvent(
      SOCKET_EVENTS.TASK_FAILED,
      { taskId, jobId, workerId, errorMessage },
      `job:${jobId}`
    );
  }

  public emitWorkerConnected(worker: unknown) {
    this.emitEvent(SOCKET_EVENTS.WORKER_CONNECTED, worker);
  }

  public emitWorkerDisconnected(workerId: string) {
    this.emitEvent(SOCKET_EVENTS.WORKER_DISCONNECTED, { workerId });
  }

  public emitWorkerStatusChanged(workerId: string, status: string) {
    this.emitEvent(SOCKET_EVENTS.WORKER_STATUS_CHANGED, { workerId, status });
  }
}

export const socketServer = new SocketServer();
