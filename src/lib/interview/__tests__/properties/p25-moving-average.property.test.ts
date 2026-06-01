import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { movingAverage } from '@/lib/interview/browser/metrics';

// Feature: interview-module, Property 25: Aggregated averages stay within their source bounds
describe('Property 25: aggregated averages within source bounds', () => {
  it('mean lies within [min, max] of the source array', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { minLength: 1 }),
        (arr) => {
          const avg = movingAverage(arr);
          const min = Math.min(...arr);
          const max = Math.max(...arr);
          const eps = 1e-3 + 1e-6 * (Math.abs(max) + Math.abs(min) + 1);
          expect(avg).toBeGreaterThanOrEqual(min - eps);
          expect(avg).toBeLessThanOrEqual(max + eps);
        },
      ),
    );
  });
});
