import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { computeCiScore, weaknessTags } from '@/lib/interview/report';

const score = fc.double({ min: 0, max: 100, noNaN: true });

// Feature: interview-module, Property 32: Confidence Index is bounded and weight-consistent
describe('Property 32: CI bounded and weight-consistent', () => {
  it('stays within [0, 100] for any category scores', () => {
    fc.assert(
      fc.property(score, score, score, score, (technicalAccuracy, communication, voiceCi, bodyCi) => {
        const ci = computeCiScore({ technicalAccuracy, communication, voiceCi, bodyCi });
        expect(ci).toBeGreaterThanOrEqual(-1e-9);
        expect(ci).toBeLessThanOrEqual(100 + 1e-9);
      }),
    );
  });

  it('equals V when all four categories equal V', () => {
    fc.assert(
      fc.property(score, (v) => {
        const ci = computeCiScore({
          technicalAccuracy: v,
          communication: v,
          voiceCi: v,
          bodyCi: v,
        });
        expect(ci).toBeCloseTo(v, 6);
      }),
    );
  });
});

// Feature: interview-module, Property 33: Weakness tags flag exactly the sub-65 categories
describe('Property 33: weakness tags flag exactly sub-65 categories', () => {
  it('includes a category iff its score is strictly below 65', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), score), (scores) => {
        const tags = weaknessTags(scores);
        for (const [category, value] of Object.entries(scores)) {
          expect(tags.includes(category)).toBe(value < 65);
        }
      }),
    );
  });

  it('never flags a category scoring exactly 65 and is empty when none below', () => {
    expect(weaknessTags({ a: 65, b: 80, c: 100 })).toEqual([]);
    expect(weaknessTags({ a: 64.999 })).toEqual(['a']);
  });
});
