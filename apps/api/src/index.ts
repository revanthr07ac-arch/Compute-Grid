import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { ENV } from './config/env.js';
import { connectDatabase, prisma } from './services/db.js';
import { initQueueService } from './services/queueService.js';
import { taskScheduler } from './scheduler/taskScheduler.js';
import { socketServer } from './socket/socketServer.js';
import { apiRouter } from './routes/apiRouter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { swaggerDocument } from './docs/swagger.js';

const app = express();
const server = http.createServer(app);

// Security & Parsing Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g., workers, curl, mobile agents)
      if (!origin) return callback(null, true);
      // In development / test, allow localhost and dev origins
      if (ENV.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      // In production, validate strictly against configured CORS_ORIGIN
      const allowedOrigins = ENV.CORS_ORIGIN.split(',').map(s => s.trim());
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocked access from origin: ${origin}`), false);
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Swagger Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Mount REST API
app.use(ENV.API_PREFIX, apiRouter);

// Centralized Error Handling
app.use(errorHandler);

// Initialize Services and Start Server
async function bootstrap() {
  try {
    await connectDatabase();
    await initQueueService();

    // Start background lease and worker heartbeat recovery daemon
    taskScheduler.startLeaseRecoveryDaemon();

    // Initialize Socket.IO
    socketServer.init(server);

    const port = ENV.PORT;
    server.listen(port, () => {
      console.log(`====================================================`);
      console.log(`⚡ ComputeGrid API Server running on port ${port}`);
      console.log(`📖 Swagger API Docs: http://localhost:${port}/api/docs`);
      console.log(`🌐 REST API Prefix:  http://localhost:${port}${ENV.API_PREFIX}`);
      console.log(`🔌 WebSocket Server: ws://localhost:${port}`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

// Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  taskScheduler.stopLeaseRecoveryDaemon();
  server.close(async () => {
    await prisma.$disconnect();
    console.log('ComputeGrid API server stopped cleanly.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export { app, server };
