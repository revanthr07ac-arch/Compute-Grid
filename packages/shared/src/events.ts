export const SOCKET_EVENTS = {
  JOB_CREATED: 'job.created',
  JOB_QUEUED: 'job.queued',
  JOB_STARTED: 'job.started',
  JOB_PROGRESS: 'job.progress',
  JOB_COMPLETED: 'job.completed',
  JOB_FAILED: 'job.failed',
  JOB_CANCELLED: 'job.cancelled',

  TASK_ASSIGNED: 'task.assigned',
  TASK_STARTED: 'task.started',
  TASK_PROGRESS: 'task.progress',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',

  WORKER_CONNECTED: 'worker.connected',
  WORKER_DISCONNECTED: 'worker.disconnected',
  WORKER_STATUS_CHANGED: 'worker.status_changed',
  WORKER_HEARTBEAT: 'worker.heartbeat',

  METRICS_UPDATE: 'metrics.update',
} as const;

export type SocketEventType = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

export interface SocketEventPayload<T = unknown> {
  type: SocketEventType;
  timestamp: string;
  data: T;
}
