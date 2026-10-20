import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../services/db.js';
import bcrypt from 'bcryptjs';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'ADMIN';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      worker?: {
        id: string;
        userId: string;
        name: string;
      };
    }
  }
}

export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.cookies?.token;

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
      userId: string;
      email: string;
      username: string;
      role: 'USER' | 'ADMIN';
    };

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'Administrator access required' });
    return;
  }
  next();
}

export async function authenticateWorker(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const workerId = (req.headers['x-worker-id'] as string) || req.body?.workerId;
  const workerSecret = req.headers['x-worker-secret'] as string;

  if (!workerId || !workerSecret) {
    res.status(401).json({ success: false, error: 'Worker credentials required (x-worker-id and x-worker-secret)' });
    return;
  }

  const credential = await prisma.workerCredential.findUnique({
    where: { workerId },
    include: { worker: true },
  });

  if (!credential || credential.revokedAt || !credential.worker) {
    res.status(401).json({ success: false, error: 'Worker credentials revoked or invalid' });
    return;
  }

  if (credential.worker.status === 'REVOKED') {
    res.status(403).json({ success: false, error: 'Worker node has been revoked' });
    return;
  }

  const match = await bcrypt.compare(workerSecret, credential.secretHash);
  if (!match) {
    res.status(401).json({ success: false, error: 'Invalid worker secret credential' });
    return;
  }

  req.worker = {
    id: credential.worker.id,
    userId: credential.worker.userId,
    name: credential.worker.name,
  };

  next();
}
