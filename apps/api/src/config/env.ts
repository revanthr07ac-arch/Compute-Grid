import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform(val => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().default('computegrid_dev_jwt_secret_key_super_secure_9921'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.string().default('7').transform(val => parseInt(val, 10)),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./data/storage'),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default('computegrid-artifacts'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  WORKER_HEARTBEAT_TIMEOUT_SEC: z.string().default('30').transform(val => parseInt(val, 10)),
  TASK_LEASE_TIMEOUT_SEC: z.string().default('60').transform(val => parseInt(val, 10)),
  MAX_TASK_RETRIES: z.string().default('3').transform(val => parseInt(val, 10)),
}).refine(
  data => {
    if (
      data.NODE_ENV === 'production' &&
      data.JWT_SECRET === 'computegrid_dev_jwt_secret_key_super_secure_9921'
    ) {
      return false;
    }
    return true;
  },
  {
    message:
      'CRITICAL SECURITY CONFIGURATION: JWT_SECRET must be set to a secure, unique secret when running in production (NODE_ENV=production).',
    path: ['JWT_SECRET'],
  }
);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const ENV = parsed.data;
