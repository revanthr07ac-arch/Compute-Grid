#!/usr/bin/env node
import { Command } from 'commander';
import { WorkerConfig } from './config.js';
import { WorkerAgent } from './agent.js';

const program = new Command();

program
  .name('computegrid-worker')
  .description('ComputeGrid Decentralized Compute Grid Worker Agent')
  .version('1.0.0');

program
  .command('start')
  .description('Start the worker agent daemon')
  .option('-s, --server <url>', 'Backend API server URL')
  .option('-t, --token <token>', 'Worker enrollment token')
  .option('-n, --name <name>', 'Custom worker name')
  .option('-c, --concurrency <number>', 'Maximum concurrent tasks', val => parseInt(val, 10))
  .option('-f, --config-file <path>', 'Path to worker credentials config file')
  .action(async options => {
    try {
      const config = new WorkerConfig(options);
      const agent = new WorkerAgent(config);

      const handleExit = () => {
        agent.stop();
        process.exit(0);
      };

      process.on('SIGINT', handleExit);
      process.on('SIGTERM', handleExit);

      await agent.start();
    } catch (err: any) {
      console.error('Fatal worker error:', err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  // Default to start command
  const config = new WorkerConfig();
  const agent = new WorkerAgent(config);
  agent.start().catch(err => {
    console.error('Fatal worker error:', err.message);
    process.exit(1);
  });
}
