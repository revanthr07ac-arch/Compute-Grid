import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ENV } from '../config/env.js';
import { prisma } from './db.js';

export interface SavedArtifact {
  id: string;
  userId: string;
  jobId?: string | null;
  taskId?: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKey: string;
  createdAt: Date;
}

export class StorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), ENV.STORAGE_LOCAL_DIR);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public calculateSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  public sanitizeFilename(filename: string): string {
    return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  public async saveArtifact(options: {
    userId: string;
    jobId?: string | null;
    taskId?: string | null;
    filename: string;
    mimeType?: string;
    buffer: Buffer;
  }): Promise<SavedArtifact> {
    const { userId, jobId, taskId, filename, mimeType, buffer } = options;
    const sanitizedName = this.sanitizeFilename(filename);
    const checksum = this.calculateSha256(buffer);
    const storageKey = `${Date.now()}-${crypto.randomUUID()}-${sanitizedName}`;

    // Security check: ensure resolved path is inside baseDir
    const targetPath = path.resolve(this.baseDir, storageKey);
    if (!targetPath.startsWith(this.baseDir)) {
      throw new Error('Path traversal detected');
    }

    await fs.promises.writeFile(targetPath, buffer);

    const artifact = await prisma.artifact.create({
      data: {
        userId,
        jobId: jobId || null,
        taskId: taskId || null,
        filename: sanitizedName,
        mimeType: mimeType || 'application/octet-stream',
        sizeBytes: buffer.length,
        checksumSha256: checksum,
        storageKey,
      },
    });

    return artifact;
  }

  public async getArtifactFile(storageKey: string): Promise<{ buffer: Buffer; filename: string }> {
    const sanitizedKey = path.basename(storageKey);
    const targetPath = path.resolve(this.baseDir, sanitizedKey);

    if (!targetPath.startsWith(this.baseDir) || !fs.existsSync(targetPath)) {
      throw new Error('Artifact file not found or invalid path');
    }

    const buffer = await fs.promises.readFile(targetPath);
    return { buffer, filename: sanitizedKey };
  }

  public async deleteArtifactFile(storageKey: string): Promise<void> {
    const sanitizedKey = path.basename(storageKey);
    const targetPath = path.resolve(this.baseDir, sanitizedKey);

    if (targetPath.startsWith(this.baseDir) && fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  }
}

export const storageService = new StorageService();
