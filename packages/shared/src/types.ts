export type UserRole = 'USER' | 'ADMIN';

export type JobStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLING'
  | 'CANCELLED';

export type TaskStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'LEASED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED';

export type WorkerStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'BUSY'
  | 'IDLE'
  | 'PAUSED'
  | 'REVOKED'
  | 'UNHEALTHY';

export type WorkloadType = 'MATH_PARALLEL' | 'FILE_CHUNK_PROCESSING';

export interface UserDTO {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  createdAt: string;
}

export interface WorkerCapabilities {
  supportedWorkloads: WorkloadType[];
  maxConcurrency: number;
  cpuCores: number;
  totalMemoryMb: number;
  tags?: string[];
  dockerSupported?: boolean;
}

export interface WorkerDTO {
  id: string;
  name: string;
  hostname: string;
  os: string;
  arch: string;
  agentVersion: string;
  status: WorkerStatus;
  capabilities: WorkerCapabilities;
  lastHeartbeatAt: string;
  tasksCompleted: number;
  tasksFailed: number;
  currentTaskId?: string | null;
  userId: string;
  createdAt: string;
}

export interface JobDTO {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  workloadType: WorkloadType;
  status: JobStatus;
  priority: number;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  maxRetriesPerTask: number;
  parameters: Record<string, unknown>;
  outputSummary?: Record<string, unknown> | null;
  outputArtifactId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
}

export interface TaskDTO {
  id: string;
  jobId: string;
  chunkIndex: number;
  totalChunks: number;
  status: TaskStatus;
  workerId?: string | null;
  workerName?: string | null;
  attempts: number;
  maxAttempts: number;
  leaseExpiresAt?: string | null;
  progress: number;
  inputPayload: Record<string, unknown>;
  outputPayload?: Record<string, unknown> | null;
  outputArtifactId?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  runtimeMs?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAttemptDTO {
  id: string;
  taskId: string;
  workerId: string;
  attemptNumber: number;
  status: TaskStatus;
  startedAt: string;
  completedAt?: string | null;
  runtimeMs?: number | null;
  errorMessage?: string | null;
  logs?: string | null;
}

export interface ArtifactDTO {
  id: string;
  userId: string;
  jobId?: string | null;
  taskId?: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKey: string;
  createdAt: string;
  downloadUrl?: string;
}

export interface JobEventDTO {
  id: string;
  jobId: string;
  taskId?: string | null;
  type: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  details?: Record<string, unknown> | null;
  timestamp: string;
}

export interface WorkerMetricsDTO {
  workerId: string;
  cpuUsagePercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  tasksCompleted: number;
  tasksActive: number;
  uptimeSeconds: number;
  timestamp: string;
}

export interface SystemStatsDTO {
  totalJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeWorkers: number;
  totalWorkers: number;
  totalTasksExecuted: number;
  computeUsageHistory: Array<{
    timestamp: string;
    completedTasks: number;
    activeWorkers: number;
  }>;
}
