import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// `feedback.ts` transitively imports the Mongo client (via session-store), which throws
// at import time when MONGODB_URI is absent. Stub it — these properties exercise the pure
// `deriveDifficultyAdjustment` helper only and never touch the DB. Mirrors the sibling
// p26-27-30-feedback.property.test.ts pattern.
vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { deriveDifficultyAdjustment } from '@/lib/interview/feedback';

/**
 * BUG 2: adaptive difficulty must actually move. The LLM unreliably self-reports
 * `difficultyAdjustment: 'same'`, so `deriveDifficultyAdjustment` recomputes the signal
 * in code from `technicalAccuracy` + `communication`. These properties pin the EXACT
 * control flow of that helper (increase checked first, then decrease, else same) so the
 * adaptive loop is guaranteed to move when it should — and only when it should.
 *
 * Actual code rule (mirrored, NOT idealized):
 *   if (technicalAccuracy >= 75 && communication >= 75) return 'increase';
 *   if (technicalAccuracy < 50 || communication < 50)   return 'decrease';
 *   return 'same';
 *
 * Scores are generated with fc.integer({min:0,max:100}) — using fc.constantFrom for the
 * branch labels would widen the inferred type to `string` and defeat the assertions, so
 * scores stay numeric and the union is asserted against a literal array.
 */

// Scores are bounded integers in [0,100], matching the QuestionEvaluation score range.
const scoreArb = fc.integer({ min: 0, max: 100 });

describe('Property: deriveDifficultyAdjustment (BUG 2 — adaptive difficulty must actually move)', () => {
  // BUG 2: whatever the scores, the helper must yield a usable difficulty signal —
  // never undefined/garbage — so the adaptive loop always has a defined move.
  it('Property: output is always one of increase | same | decrease', () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (technicalAccuracy, communication) => {
        const out = deriveDifficultyAdjustment({ technicalAccuracy, communication });
        expect(['increase', 'same', 'decrease']).toContain(out);
      }),
      { numRuns: 200 },
    );
  });

  // BUG 2: a strong answer (both >= 75) must push difficulty UP, not sit at 'same'.
  it('Property: tech>=75 AND comm>=75 => increase', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 75, max: 100 }),
        fc.integer({ min: 75, max: 100 }),
        (technicalAccuracy, communication) => {
          const out = deriveDifficultyAdjustment({ technicalAccuracy, communication });
          expect(out).toBe('increase');
        },
      ),
      { numRuns: 200 },
    );
  });

  // BUG 2: a struggling answer must pull difficulty DOWN. This mirrors the ACTUAL flow:
  // 'increase' is checked first, so 'decrease' is only reached when NOT(both>=75). When a
  // score is >=75 but the other is <50, increase fails and decrease wins — exactly the
  // edge the spec note calls out.
  it('Property: NOT(tech>=75 && comm>=75) AND (tech<50 OR comm<50) => decrease', () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (technicalAccuracy, communication) => {
        const bothHigh = technicalAccuracy >= 75 && communication >= 75;
        const eitherLow = technicalAccuracy < 50 || communication < 50;
        fc.pre(!bothHigh && eitherLow);
        const out = deriveDifficultyAdjustment({ technicalAccuracy, communication });
        expect(out).toBe('decrease');
      }),
      { numRuns: 200 },
    );
  });

  // BUG 2: the middle band must stay put — moving here would make difficulty oscillate.
  // 'same' is the else branch: both scores >= 50 and not both >= 75.
  it('Property: otherwise (both in [50,100], not both >=75) => same', () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (technicalAccuracy, communication) => {
        const bothHigh = technicalAccuracy >= 75 && communication >= 75;
        const eitherLow = technicalAccuracy < 50 || communication < 50;
        fc.pre(!bothHigh && !eitherLow);
        const out = deriveDifficultyAdjustment({ technicalAccuracy, communication });
        expect(out).toBe('same');
      }),
      { numRuns: 200 },
    );
  });

  // BUG 2: the corrected signal must be deterministic — the same answer can't randomly
  // move difficulty one turn and hold it the next.
  it('Property: determinism — same input always yields same output', () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (technicalAccuracy, communication) => {
        const a = deriveDifficultyAdjustment({ technicalAccuracy, communication });
        const b = deriveDifficultyAdjustment({ technicalAccuracy, communication });
        expect(a).toBe(b);
      }),
      { numRuns: 200 },
    );
  });
});
