import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const WorkerEnrollSchema = z.object({
  name: z.string().min(2).max(50),
  enrollmentToken: z.string().min(10, 'Valid enrollment token required'),
  hostname: z.string().default('unknown-host'),
  os: z.string().default('unknown-os'),
  arch: z.string().default('x64'),
  agentVersion: z.string().default('1.0.0'),
  capabilities: z.object({
    supportedWorkloads: z.array(z.enum(['MATH_PARALLEL', 'FILE_CHUNK_PROCESSING'])),
    maxConcurrency: z.number().int().min(1).max(32).default(1),
    cpuCores: z.number().int().min(1).default(1),
    totalMemoryMb: z.number().int().min(128).default(1024),
    tags: z.array(z.string()).optional(),
    dockerSupported: z.boolean().optional(),
  }),
});

export const WorkerHeartbeatSchema = z.object({
  cpuUsagePercent: z.number().min(0).max(100).default(0),
  memoryUsedMb: z.number().min(0).default(0),
  memoryTotalMb: z.number().min(0).default(1024),
  tasksActive: z.number().int().min(0).default(0),
  tasksCompleted: z.number().int().min(0).default(0),
});

export const CreateJobSchema = z.object({
  name: z.string().min(3, 'Job name must be at least 3 characters').max(100),
  description: z.string().max(500).optional(),
  workloadType: z.enum(['MATH_PARALLEL', 'FILE_CHUNK_PROCESSING']),
  priority: z.number().int().min(1).max(10).default(5),
  maxRetriesPerTask: z.number().int().min(0).max(5).default(2),
  parameters: z.record(z.any()),
});

export const MathWorkloadParamsSchema = z.object({
  algorithm: z.enum(['prime-count', 'numerical-integration']),
  rangeStart: z.number().int().min(0),
  rangeEnd: z.number().int().min(1),
  chunkCount: z.number().int().min(1).max(1000).default(4),
  integrationFunction: z.enum(['polynomial', 'sinusoid', 'gaussian']).optional(),
  totalSteps: z.number().int().min(100).max(10000000).optional(),
}).refine(data => data.rangeEnd > data.rangeStart, {
  message: 'rangeEnd must be strictly greater than rangeStart',
  path: ['rangeEnd'],
});

export const FileWorkloadParamsSchema = z.object({
  operation: z.enum(['word-count', 'regex-filter', 'line-stats']),
  filename: z.string().min(1),
  content: z.string().optional(),
  chunkCount: z.number().int().min(1).max(500).default(4),
  filterPattern: z.string().optional(),
});

export const TaskClaimSchema = z.object({
  workerId: z.string().uuid(),
  supportedWorkloads: z.array(z.enum(['MATH_PARALLEL', 'FILE_CHUNK_PROCESSING'])),
});

export const TaskProgressSchema = z.object({
  progress: z.number().min(0).max(100),
  message: z.string().max(250).optional(),
});

export const TaskCompleteSchema = z.object({
  workerId: z.string().uuid(),
  outputPayload: z.record(z.any()),
  outputArtifactId: z.string().uuid().optional(),
  runtimeMs: z.number().min(0),
});

export const TaskFailSchema = z.object({
  workerId: z.string().uuid(),
  errorMessage: z.string().min(1).max(2000),
  canRetry: z.boolean().default(true),
});
