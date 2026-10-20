import {
  MathParallelParams,
  MathChunkInput,
  FileChunkParams,
  FileChunkInput,
} from './workloads.js';

export interface PartitionedTask {
  jobId: string;
  chunkIndex: number;
  totalChunks: number;
  status: string;
  maxAttempts: number;
  inputPayload: string;
}

export function partitionMathWorkload(
  jobId: string,
  params: MathParallelParams,
  maxRetries = 2
): PartitionedTask[] {
  const { rangeStart, rangeEnd, chunkCount, algorithm, integrationFunction, totalSteps } = params;
  const tasks: PartitionedTask[] = [];

  const totalSpan = rangeEnd - rangeStart;
  const stepSize = Math.floor(totalSpan / chunkCount);

  for (let i = 0; i < chunkCount; i++) {
    const chunkStart = rangeStart + i * stepSize;
    const chunkEnd = i === chunkCount - 1 ? rangeEnd : chunkStart + stepSize - 1;

    const input: MathChunkInput = {
      chunkIndex: i,
      totalChunks: chunkCount,
      algorithm,
      rangeStart: chunkStart,
      rangeEnd: chunkEnd,
      integrationFunction,
      steps: totalSteps ? Math.floor(totalSteps / chunkCount) : undefined,
    };

    tasks.push({
      jobId,
      chunkIndex: i,
      totalChunks: chunkCount,
      status: 'QUEUED',
      maxAttempts: maxRetries + 1,
      inputPayload: JSON.stringify(input),
    });
  }

  return tasks;
}

export function partitionFileWorkload(
  jobId: string,
  params: FileChunkParams,
  maxRetries = 2
): PartitionedTask[] {
  const { filename, chunkCount, operation, filterPattern, content } = params;
  const tasks: PartitionedTask[] = [];

  const lines = (content || 'Distributed Compute Grid Node Dataset\n'.repeat(100)).split('\n');
  const linesPerChunk = Math.max(1, Math.ceil(lines.length / chunkCount));

  for (let i = 0; i < chunkCount; i++) {
    const startLine = i * linesPerChunk;
    const endLine = Math.min(lines.length, (i + 1) * linesPerChunk);
    const chunkLines = lines.slice(startLine, endLine).join('\n');

    const input: FileChunkInput = {
      chunkIndex: i,
      totalChunks: chunkCount,
      operation,
      contentChunk: chunkLines,
      startLine: startLine + 1,
      endLine,
      filterPattern,
    };

    tasks.push({
      jobId,
      chunkIndex: i,
      totalChunks: chunkCount,
      status: 'QUEUED',
      maxAttempts: maxRetries + 1,
      inputPayload: JSON.stringify(input),
    });
  }

  return tasks;
}
