import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/authController.js';
import { JobController } from '../controllers/jobController.js';
import { WorkerController } from '../controllers/workerController.js';
import { TaskController } from '../controllers/taskController.js';
import { ArtifactController } from '../controllers/artifactController.js';
import { HealthController } from '../controllers/healthController.js';
import { authenticateUser, authenticateWorker } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
});

export const apiRouter = Router();

// 1. Auth Endpoints
const authRoutes = Router();
authRoutes.post('/register', authLimiter, AuthController.register);
authRoutes.post('/login', authLimiter, AuthController.login);
authRoutes.post('/logout', AuthController.logout);
authRoutes.get('/me', authenticateUser, AuthController.getMe);
apiRouter.use('/auth', authRoutes);

// 2. Job Endpoints
const jobRoutes = Router();
jobRoutes.use(authenticateUser);
jobRoutes.post('/', JobController.createJob);
jobRoutes.get('/', JobController.listJobs);
jobRoutes.get('/:jobId', JobController.getJob);
jobRoutes.post('/:jobId/cancel', JobController.cancelJob);
jobRoutes.post('/:jobId/retry', JobController.retryJob);
jobRoutes.get('/:jobId/tasks', JobController.getJobTasks);
jobRoutes.get('/:jobId/logs', JobController.getJobLogs);
jobRoutes.get('/:jobId/results', JobController.getJobResults);
apiRouter.use('/jobs', jobRoutes);

// 3. Worker Management Endpoints
const workerRoutes = Router();
workerRoutes.post('/enroll', authenticateUser, WorkerController.createEnrollmentToken);
workerRoutes.post('/register', WorkerController.registerWorker);
workerRoutes.post('/heartbeat', authenticateWorker, WorkerController.heartbeat);
workerRoutes.get('/', authenticateUser, WorkerController.listWorkers);
workerRoutes.get('/:workerId', authenticateUser, WorkerController.getWorker);
workerRoutes.post('/:workerId/pause', authenticateUser, WorkerController.pauseWorker);
workerRoutes.post('/:workerId/resume', authenticateUser, WorkerController.resumeWorker);
workerRoutes.post('/:workerId/revoke', authenticateUser, WorkerController.revokeWorker);
apiRouter.use('/workers', workerRoutes);

// 4. Worker Task Execution Endpoints
const workerTaskRoutes = Router();
workerTaskRoutes.use(authenticateWorker);
workerTaskRoutes.get('/claim', TaskController.claim);
workerTaskRoutes.post('/:taskId/heartbeat', TaskController.heartbeat);
workerTaskRoutes.post('/:taskId/progress', TaskController.progress);
workerTaskRoutes.post('/:taskId/complete', TaskController.complete);
workerTaskRoutes.post('/:taskId/fail', TaskController.fail);
apiRouter.use('/worker/tasks', workerTaskRoutes);

// 5. Artifact Endpoints
const artifactRoutes = Router();
artifactRoutes.post('/upload', upload.single('file'), ArtifactController.upload);
artifactRoutes.get('/:artifactId', ArtifactController.getMetadata);
artifactRoutes.get('/:artifactId/download', ArtifactController.download);
apiRouter.use('/artifacts', artifactRoutes);

// 6. Health & Metrics
apiRouter.get('/health/live', HealthController.live);
apiRouter.get('/health/ready', HealthController.ready);
apiRouter.get('/metrics', HealthController.metrics);
