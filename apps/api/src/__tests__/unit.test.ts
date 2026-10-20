import { describe, it, expect } from 'vitest';
import {
  MathWorkloadParamsSchema,
  FileWorkloadParamsSchema,
  referencePrimeCompute,
  referenceIntegrationCompute,
  isPrime,
} from '@computegrid/shared';
import { storageService } from '../services/storageService.js';

describe('Unit Tests: ComputeGrid Engine', () => {
  describe('Input Validation Schemas', () => {
    it('validates correct MathWorkload parameters', () => {
      const valid = {
        algorithm: 'prime-count',
        rangeStart: 1,
        rangeEnd: 1000,
        chunkCount: 4,
      };
      const result = MathWorkloadParamsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid MathWorkload where rangeEnd <= rangeStart', () => {
      const invalid = {
        algorithm: 'prime-count',
        rangeStart: 500,
        rangeEnd: 500,
        chunkCount: 4,
      };
      const result = MathWorkloadParamsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('validates FileWorkload parameters', () => {
      const valid = {
        operation: 'word-count',
        filename: 'data.txt',
        chunkCount: 2,
      };
      const result = FileWorkloadParamsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('Deterministic Mathematical Workloads', () => {
    it('accurately detects prime numbers', () => {
      expect(isPrime(2)).toBe(true);
      expect(isPrime(3)).toBe(true);
      expect(isPrime(4)).toBe(false);
      expect(isPrime(17)).toBe(true);
      expect(isPrime(100)).toBe(false);
      expect(isPrime(97)).toBe(true);
    });

    it('computes prime count and sum in range [2, 100]', () => {
      // In [2, 100], there are exactly 25 primes with sum 1060 and largest prime 97
      const result = referencePrimeCompute(2, 100);
      expect(result.count).toBe(25);
      expect(result.sum).toBe(1060);
      expect(result.maxPrime).toBe(97);
    });

    it('partitioned computation matches reference single-process execution', () => {
      const start = 2;
      const end = 200;
      const totalSpan = end - start;
      const chunkCount = 4;
      const step = Math.floor(totalSpan / chunkCount);

      let chunkTotalCount = 0;
      let chunkTotalSum = 0;
      let chunkMaxPrime = 0;

      for (let i = 0; i < chunkCount; i++) {
        const chunkStart = start + i * step;
        const chunkEnd = i === chunkCount - 1 ? end : chunkStart + step - 1;
        const chunkRes = referencePrimeCompute(chunkStart, chunkEnd);

        chunkTotalCount += chunkRes.count;
        chunkTotalSum += chunkRes.sum;
        if (chunkRes.maxPrime > chunkMaxPrime) {
          chunkMaxPrime = chunkRes.maxPrime;
        }
      }

      const reference = referencePrimeCompute(start, end);
      expect(chunkTotalCount).toBe(reference.count);
      expect(chunkTotalSum).toBe(reference.sum);
      expect(chunkMaxPrime).toBe(reference.maxPrime);
    });

    it('computes numerical integration accurately', () => {
      // Definite integral of f(x) = 4x^3 - 3x^2 + 2x + 1 from 0 to 2
      // Antiderivative: x^4 - x^3 + x^2 + x
      // At x=2: 16 - 8 + 4 + 2 = 14
      // At x=0: 0
      // Exact value = 14
      const result = referenceIntegrationCompute(0, 2, 10000, 'polynomial');
      expect(Math.abs(result - 14)).toBeLessThan(0.01);
    });
  });

  describe('Storage Service Security', () => {
    it('sanitizes filename and prevents directory traversal characters', () => {
      const dangerousName = '../../etc/passwd';
      const sanitized = storageService.sanitizeFilename(dangerousName);
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('/');
      expect(sanitized).toBe('passwd');
    });

    it('generates consistent SHA-256 checksums', () => {
      const buffer = Buffer.from('ComputeGrid Test Content', 'utf-8');
      const hash1 = storageService.calculateSha256(buffer);
      const hash2 = storageService.calculateSha256(buffer);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });
});
