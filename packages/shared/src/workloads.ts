export interface MathParallelParams {
  algorithm: 'prime-count' | 'numerical-integration';
  rangeStart: number;
  rangeEnd: number;
  chunkCount: number;
  // For numerical integration: e.g. f(x) = x^2 or sin(x)
  integrationFunction?: 'polynomial' | 'sinusoid' | 'gaussian';
  totalSteps?: number;
}

export interface MathChunkInput {
  chunkIndex: number;
  totalChunks: number;
  algorithm: 'prime-count' | 'numerical-integration';
  rangeStart: number;
  rangeEnd: number;
  integrationFunction?: 'polynomial' | 'sinusoid' | 'gaussian';
  steps?: number;
}

export interface MathChunkOutput {
  chunkIndex: number;
  rangeStart: number;
  rangeEnd: number;
  algorithm: string;
  count?: number;
  sum?: number;
  maxPrime?: number;
  integralValue?: number;
  executionTimeMs: number;
  checksum: string;
}

export interface MathAggregatedResult {
  algorithm: string;
  rangeStart: number;
  rangeEnd: number;
  totalChunks: number;
  totalPrimesCount?: number;
  totalPrimesSum?: number;
  highestPrime?: number;
  totalIntegral?: number;
  verifiedAgainstReference: boolean;
  totalExecutionTimeMs: number;
  completedAt: string;
}

export interface FileChunkParams {
  operation: 'word-count' | 'regex-filter' | 'line-stats';
  filename: string;
  fileSizeBytes: number;
  chunkCount: number;
  filterPattern?: string;
  linesPerChunk?: number;
}

export interface FileChunkInput {
  chunkIndex: number;
  totalChunks: number;
  operation: 'word-count' | 'regex-filter' | 'line-stats';
  contentChunk: string;
  startLine: number;
  endLine: number;
  filterPattern?: string;
}

export interface FileChunkOutput {
  chunkIndex: number;
  startLine: number;
  endLine: number;
  linesProcessed: number;
  operation: string;
  wordFrequencies?: Record<string, number>;
  matchedLines?: string[];
  lineStats?: {
    totalChars: number;
    totalWords: number;
    blankLines: number;
  };
  checksumSha256: string;
  executionTimeMs: number;
}

export interface FileAggregatedResult {
  operation: string;
  filename: string;
  totalChunks: number;
  totalLinesProcessed: number;
  totalWords?: number;
  totalChars?: number;
  blankLines?: number;
  topWords?: Array<{ word: string; count: number }>;
  matchedLineCount?: number;
  matchedLinesSample?: string[];
  combinedArtifactId?: string;
  completedAt: string;
}

// Single-process deterministic reference implementations for validation
export function isPrime(n: number): boolean {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

export function referencePrimeCompute(start: number, end: number): {
  count: number;
  sum: number;
  maxPrime: number;
} {
  let count = 0;
  let sum = 0;
  let maxPrime = 0;
  for (let i = Math.max(2, Math.floor(start)); i <= Math.floor(end); i++) {
    if (isPrime(i)) {
      count++;
      sum += i;
      if (i > maxPrime) maxPrime = i;
    }
  }
  return { count, sum, maxPrime };
}

export function evaluateFunction(
  fnName: 'polynomial' | 'sinusoid' | 'gaussian',
  x: number
): number {
  switch (fnName) {
    case 'sinusoid':
      return Math.sin(x) * Math.cos(x * 0.5);
    case 'gaussian':
      return Math.exp(-0.5 * x * x);
    case 'polynomial':
    default:
      // f(x) = 4 * x^3 - 3 * x^2 + 2 * x + 1
      return 4 * Math.pow(x, 3) - 3 * Math.pow(x, 2) + 2 * x + 1;
  }
}

export function referenceIntegrationCompute(
  start: number,
  end: number,
  steps: number,
  fnName: 'polynomial' | 'sinusoid' | 'gaussian' = 'polynomial'
): number {
  if (steps <= 0) return 0;
  const dx = (end - start) / steps;
  let sum = 0.5 * (evaluateFunction(fnName, start) + evaluateFunction(fnName, end));
  for (let i = 1; i < steps; i++) {
    const x = start + i * dx;
    sum += evaluateFunction(fnName, x);
  }
  return sum * dx;
}
