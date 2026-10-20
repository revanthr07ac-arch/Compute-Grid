import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

export interface WorkerConfigFile {
  workerId?: string;
  workerSecret?: string;
  workerName?: string;
  serverUrl?: string;
}

export class WorkerConfig {
  public serverUrl: string;
  public enrollmentToken: string;
  public workerId: string;
  public workerSecret: string;
  public workerName: string;
  public pollIntervalMs: number;
  public heartbeatIntervalMs: number;
  public maxConcurrency: number;
  private configFilePath: string;

  constructor(cliOptions: {
    server?: string;
    token?: string;
    name?: string;
    concurrency?: number;
    configFile?: string;
  } = {}) {
    this.configFilePath = path.resolve(
      cliOptions.configFile || process.env.WORKER_CONFIG_FILE || '.computegrid_worker.json'
    );

    const savedConfig = this.loadConfigFile();

    this.serverUrl =
      cliOptions.server ||
      process.env.COMPUTEGRID_SERVER_URL ||
      savedConfig.serverUrl ||
      'http://localhost:4000';

    this.enrollmentToken =
      cliOptions.token ||
      process.env.COMPUTEGRID_ENROLLMENT_TOKEN ||
      '';

    this.workerId = savedConfig.workerId || process.env.WORKER_ID || '';
    this.workerSecret = savedConfig.workerSecret || process.env.WORKER_SECRET || '';
    this.workerName =
      cliOptions.name ||
      savedConfig.workerName ||
      process.env.WORKER_NAME ||
      `Worker-${os.hostname()}-${Math.floor(Math.random() * 1000)}`;

    this.pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || '2000', 10);
    this.heartbeatIntervalMs = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '8000', 10);
    this.maxConcurrency = cliOptions.concurrency || parseInt(process.env.MAX_CONCURRENCY || '2', 10);
  }

  private loadConfigFile(): WorkerConfigFile {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {
      // Ignore config read error
    }
    return {};
  }

  public saveCredentials(workerId: string, workerSecret: string, workerName: string): void {
    this.workerId = workerId;
    this.workerSecret = workerSecret;
    this.workerName = workerName;

    try {
      const data: WorkerConfigFile = {
        workerId,
        workerSecret,
        workerName,
        serverUrl: this.serverUrl,
      };
      fs.writeFileSync(this.configFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[Config] Failed to save credentials to config file:', err);
    }
  }
}
