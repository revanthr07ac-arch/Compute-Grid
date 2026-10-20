import crypto from 'crypto';
import {
  isPrime,
  evaluateFunction,
  MathChunkInput,
  MathChunkOutput,
  FileChunkInput,
  FileChunkOutput,
} from './workloads.js';

export type ProgressCallback = (progressPercent: number, message?: string) => Promise<void>;

export class TaskExecutor {
  public static async executeMathTask(
    input: MathChunkInput,
    onProgress?: ProgressCallback
  ): Promise<MathChunkOutput> {
    const startTime = Date.now();
    const { rangeStart, rangeEnd, algorithm, chunkIndex } = input;

    if (algorithm === 'prime-count') {
      let count = 0;
      let sum = 0;
      let maxPrime = 0;
      const totalSpan = rangeEnd - rangeStart + 1;
      let lastReport = 0;

      for (let i = rangeStart; i <= rangeEnd; i++) {
        if (isPrime(i)) {
          count++;
          sum += i;
          if (i > maxPrime) maxPrime = i;
        }

        if (onProgress && totalSpan > 100) {
          const currentProgress = Math.floor(((i - rangeStart) / totalSpan) * 100);
          if (currentProgress - lastReport >= 20) {
            lastReport = currentProgress;
            await onProgress(currentProgress, `Evaluated up to ${i}`);
          }
        }
      }

      const executionTimeMs = Date.now() - startTime;
      const checksum = crypto
        .createHash('sha256')
        .update(`${chunkIndex}:${count}:${sum}:${maxPrime}`)
        .digest('hex');

      return {
        chunkIndex,
        rangeStart,
        rangeEnd,
        algorithm,
        count,
        sum,
        maxPrime,
        executionTimeMs,
        checksum,
      };
    } else if (algorithm === 'numerical-integration') {
      const steps = input.steps || 1000;
      const fnName = input.integrationFunction || 'polynomial';
      const dx = (rangeEnd - rangeStart) / steps;

      let sum =
        0.5 *
        (evaluateFunction(fnName, rangeStart) + evaluateFunction(fnName, rangeEnd));

      for (let i = 1; i < steps; i++) {
        const x = rangeStart + i * dx;
        sum += evaluateFunction(fnName, x);
      }

      const integralValue = sum * dx;
      const executionTimeMs = Date.now() - startTime;
      const checksum = crypto
        .createHash('sha256')
        .update(`${chunkIndex}:${integralValue}`)
        .digest('hex');

      return {
        chunkIndex,
        rangeStart,
        rangeEnd,
        algorithm,
        integralValue,
        executionTimeMs,
        checksum,
      };
    } else {
      throw new Error(`Unsupported math algorithm: ${algorithm}`);
    }
  }

  public static async executeFileTask(
    input: FileChunkInput,
    onProgress?: ProgressCallback
  ): Promise<FileChunkOutput> {
    const startTime = Date.now();
    const { chunkIndex, startLine, endLine, contentChunk, operation, filterPattern } = input;
    const lines = contentChunk.split('\n');
    const linesProcessed = lines.length;

    let wordFrequencies: Record<string, number> | undefined;
    let matchedLines: string[] | undefined;
    let lineStats: { totalChars: number; totalWords: number; blankLines: number } | undefined;

    if (operation === 'word-count') {
      wordFrequencies = {};
      for (let i = 0; i < lines.length; i++) {
        const words = lines[i]
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(Boolean);

        for (const w of words) {
          wordFrequencies[w] = (wordFrequencies[w] || 0) + 1;
        }

        if (onProgress && i % 500 === 0 && i > 0) {
          await onProgress(Math.floor((i / lines.length) * 100), `Processed ${i} lines`);
        }
      }
    } else if (operation === 'regex-filter') {
      matchedLines = [];
      let regex: RegExp;
      try {
        regex = new RegExp(filterPattern || '.*', 'i');
      } catch {
        const escaped = (filterPattern || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, 'i');
      }
      for (const line of lines) {
        if (regex.test(line)) {
          matchedLines.push(line);
        }
      }
    } else if (operation === 'line-stats') {
      let totalChars = 0;
      let totalWords = 0;
      let blankLines = 0;

      for (const line of lines) {
        totalChars += line.length;
        if (!line.trim()) {
          blankLines++;
        } else {
          totalWords += line.trim().split(/\s+/).length;
        }
      }

      lineStats = { totalChars, totalWords, blankLines };
    }

    const executionTimeMs = Date.now() - startTime;
    const checksum = crypto
      .createHash('sha256')
      .update(`${chunkIndex}:${linesProcessed}:${operation}`)
      .digest('hex');

    return {
      chunkIndex,
      startLine,
      endLine,
      linesProcessed,
      operation,
      wordFrequencies,
      matchedLines,
      lineStats,
      checksumSha256: checksum,
      executionTimeMs,
    };
  }
}
