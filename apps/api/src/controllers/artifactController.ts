import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/db.js';
import { storageService } from '../services/storageService.js';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export class ArtifactController {
  public static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, error: 'File is required' });
        return;
      }

      const userId = req.user?.id || req.worker?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { jobId, taskId } = req.body;

      const artifact = await storageService.saveArtifact({
        userId,
        jobId: jobId || null,
        taskId: taskId || null,
        filename: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      });

      res.status(201).json({
        success: true,
        data: {
          id: artifact.id,
          filename: artifact.filename,
          sizeBytes: artifact.sizeBytes,
          checksumSha256: artifact.checksumSha256,
          createdAt: artifact.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const artifactId = req.params.artifactId as string;
      const artifact = await prisma.artifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        res.status(404).json({ success: false, error: 'Artifact not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: artifact.id,
          filename: artifact.filename,
          mimeType: artifact.mimeType,
          sizeBytes: artifact.sizeBytes,
          checksumSha256: artifact.checksumSha256,
          downloadUrl: `/api/v1/artifacts/${artifact.id}/download`,
          createdAt: artifact.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const artifactId = req.params.artifactId as string;
      const token = req.query.token as string;

      let userId = req.user?.id;

      // Allow download with short-lived token in query param
      if (!userId && token) {
        try {
          const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string };
          userId = decoded.userId;
        } catch {
          res.status(401).json({ success: false, error: 'Invalid or expired download token' });
          return;
        }
      }

      const artifact = await prisma.artifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        res.status(404).json({ success: false, error: 'Artifact not found' });
        return;
      }

      // Check access permission (owner or admin or worker)
      if (userId && req.user?.role !== 'ADMIN' && artifact.userId !== userId) {
        res.status(403).json({ success: false, error: 'Access forbidden to this artifact' });
        return;
      }

      const { buffer, filename } = await storageService.getArtifactFile(artifact.storageKey);

      res.setHeader('Content-Type', artifact.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(artifact.filename || filename)}"`
      );
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('X-Checksum-SHA256', artifact.checksumSha256);

      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
}
