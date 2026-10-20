import {
  MathParallelParams,
  MathChunkOutput,
  MathAggregatedResult,
  FileChunkParams,
  FileChunkOutput,
  FileAggregatedResult,
  referencePrimeCompute,
  referenceIntegrationCompute,
} from './workloads.js';

export function aggregateMathWorkload(
  params: MathParallelParams,
  taskOutputs: MathChunkOutput[]
): MathAggregatedResult {
  let totalPrimesCount = 0;
  let totalPrimesSum = 0;
  let highestPrime = 0;
  let totalIntegral = 0;
  let totalExecutionTimeMs = 0;

  for (const out of taskOutputs) {
    totalExecutionTimeMs += out.executionTimeMs || 0;

    if (params.algorithm === 'prime-count') {
      totalPrimesCount += out.count || 0;
      totalPrimesSum += out.sum || 0;
      if (out.maxPrime && out.maxPrime > highestPrime) {
        highestPrime = out.maxPrime;
      }
    } else if (params.algorithm === 'numerical-integration') {
      totalIntegral += out.integralValue || 0;
    }
  }

  let verified = false;
  if (params.algorithm === 'prime-count') {
    const ref = referencePrimeCompute(params.rangeStart, params.rangeEnd);
    verified =
      ref.count === totalPrimesCount &&
      ref.sum === totalPrimesSum &&
      ref.maxPrime === highestPrime;
  } else if (params.algorithm === 'numerical-integration') {
    const ref = referenceIntegrationCompute(
      params.rangeStart,
      params.rangeEnd,
      params.totalSteps || 1000,
      params.integrationFunction || 'polynomial'
    );
    verified = Math.abs(ref - totalIntegral) < 0.0001;
  }

  return {
    algorithm: params.algorithm,
    rangeStart: params.rangeStart,
    rangeEnd: params.rangeEnd,
    totalChunks: taskOutputs.length,
    totalPrimesCount: params.algorithm === 'prime-count' ? totalPrimesCount : undefined,
    totalPrimesSum: params.algorithm === 'prime-count' ? totalPrimesSum : undefined,
    highestPrime: params.algorithm === 'prime-count' ? highestPrime : undefined,
    totalIntegral: params.algorithm === 'numerical-integration' ? totalIntegral : undefined,
    verifiedAgainstReference: verified,
    totalExecutionTimeMs,
    completedAt: new Date().toISOString(),
  };
}

export function aggregateFileWorkload(
  params: FileChunkParams,
  taskOutputs: FileChunkOutput[]
): FileAggregatedResult {
  const combinedFrequencies: Record<string, number> = {};
  let totalLines = 0;
  let totalWords = 0;
  let totalChars = 0;
  let blankLines = 0;
  const matchedLines: string[] = [];

  for (const out of taskOutputs) {
    totalLines += out.linesProcessed || 0;

    if (out.wordFrequencies) {
      for (const [word, count] of Object.entries(out.wordFrequencies)) {
        combinedFrequencies[word] = (combinedFrequencies[word] || 0) + count;
        totalWords += count;
      }
    }

    if (out.lineStats) {
      totalChars += out.lineStats.totalChars || 0;
      blankLines += out.lineStats.blankLines || 0;
    }

    if (out.matchedLines) {
      matchedLines.push(...out.matchedLines);
    }
  }

  const topWords = Object.entries(combinedFrequencies)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return {
    operation: params.operation,
    filename: params.filename,
    totalChunks: taskOutputs.length,
    totalLinesProcessed: totalLines,
    totalWords,
    totalChars,
    blankLines,
    topWords: params.operation === 'word-count' ? topWords : undefined,
    matchedLineCount: params.operation === 'regex-filter' ? matchedLines.length : undefined,
    matchedLinesSample:
      params.operation === 'regex-filter' ? matchedLines.slice(0, 100) : undefined,
    completedAt: new Date().toISOString(),
  };
}
