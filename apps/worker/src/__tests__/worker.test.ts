import { describe, it, expect } from 'vitest';
import { TaskExecutor } from '../executor.js';
import { WorkerConfig } from '../config.js';

describe('Worker Package Tests', () => {
  it('TaskExecutor accurately computes prime numbers for a chunk', async () => {
    const input = {
      chunkIndex: 0,
      totalChunks: 1,
      algorithm: 'prime-count' as const,
      rangeStart: 10,
      rangeEnd: 50,
    };

    const output = await TaskExecutor.executeMathTask(input);
    expect(output.count).toBe(11); // Primes: 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47
    expect(output.maxPrime).toBe(47);
    expect(output.checksum).toBeDefined();
    expect(output.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('TaskExecutor accurately counts words in a text chunk', async () => {
    const input = {
      chunkIndex: 0,
      totalChunks: 1,
      operation: 'word-count' as const,
      contentChunk: 'hello grid world hello compute world hello',
      startLine: 1,
      endLine: 1,
    };

    const output = await TaskExecutor.executeFileTask(input);
    expect(output.linesProcessed).toBe(1);
    expect(output.wordFrequencies?.['hello']).toBe(3);
    expect(output.wordFrequencies?.['world']).toBe(2);
    expect(output.wordFrequencies?.['grid']).toBe(1);
    expect(output.checksumSha256).toBeDefined();
  });

  it('WorkerConfig parses default options correctly', () => {
    const config = new WorkerConfig({
      server: 'http://custom-grid:5000',
      name: 'Custom-Node-77',
      concurrency: 4,
    });

    expect(config.serverUrl).toBe('http://custom-grid:5000');
    expect(config.workerName).toBe('Custom-Node-77');
    expect(config.maxConcurrency).toBe(4);
  });
});
