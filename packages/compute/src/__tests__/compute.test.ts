import { describe, it, expect } from 'vitest';
import {
  partitionMathWorkload,
  partitionFileWorkload,
  aggregateMathWorkload,
  aggregateFileWorkload,
  referencePrimeCompute,
  referenceIntegrationCompute,
  TaskExecutor,
} from '../index.js';

describe('Compute Package Tests', () => {
  it('partitions math workload into exact non-overlapping intervals', () => {
    const tasks = partitionMathWorkload('test-job-1', {
      algorithm: 'prime-count',
      rangeStart: 10,
      rangeEnd: 100,
      chunkCount: 3,
    });

    expect(tasks.length).toBe(3);
    const chunk0 = JSON.parse(tasks[0].inputPayload);
    const chunk1 = JSON.parse(tasks[1].inputPayload);
    const chunk2 = JSON.parse(tasks[2].inputPayload);

    expect(chunk0.rangeStart).toBe(10);
    expect(chunk0.rangeEnd).toBe(39);
    expect(chunk1.rangeStart).toBe(40);
    expect(chunk1.rangeEnd).toBe(69);
    expect(chunk2.rangeStart).toBe(70);
    expect(chunk2.rangeEnd).toBe(100);
  });

  it('executes and aggregates math chunks with reference validation', async () => {
    const params = {
      algorithm: 'prime-count' as const,
      rangeStart: 2,
      rangeEnd: 100,
      chunkCount: 2,
    };
    const tasks = partitionMathWorkload('test-job-2', params);

    const out0 = await TaskExecutor.executeMathTask(JSON.parse(tasks[0].inputPayload));
    const out1 = await TaskExecutor.executeMathTask(JSON.parse(tasks[1].inputPayload));

    const aggregated = aggregateMathWorkload(params, [out0, out1]);
    expect(aggregated.totalPrimesCount).toBe(25);
    expect(aggregated.totalPrimesSum).toBe(1060);
    expect(aggregated.highestPrime).toBe(97);
    expect(aggregated.verifiedAgainstReference).toBe(true);
  });

  it('partitions and aggregates file chunk processing', async () => {
    const params = {
      filename: 'sample.txt',
      chunkCount: 2,
      operation: 'word-count' as const,
      content: 'grid compute decentralized node\ngrid compute\n',
    };
    const tasks = partitionFileWorkload('test-job-3', params);
    expect(tasks.length).toBe(2);

    const out0 = await TaskExecutor.executeFileTask(JSON.parse(tasks[0].inputPayload));
    const out1 = await TaskExecutor.executeFileTask(JSON.parse(tasks[1].inputPayload));

    const aggregated = aggregateFileWorkload(params, [out0, out1]);
    expect(aggregated.totalWords).toBeGreaterThan(0);
    expect(aggregated.topWords?.find(w => w.word === 'grid')?.count).toBe(2);
  });
});
