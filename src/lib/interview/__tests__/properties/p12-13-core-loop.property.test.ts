import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { advanceTurn } from '@/lib/interview/orchestrator';
import type { PooledQuestion } from '@/lib/interview/schemas';

function pool(n: number): PooledQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `pool-${i}`,
    questionText: `Pool question ${i}`,
    idealAnswer: 'a',
    difficulty: 3,
    tags: [],
    origin: 'validated',
  }));
}

// Feature: interview-module, Property 12: Turn 2 template is fully filled without an LLM call
// Feature: interview-module, Property 13: Domain turns are drawn only from the pool
describe('Properties 12-13: core question loop', () => {
  it('Property 12: Turn 2 is templated with no unfilled placeholder and no pool consumed', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 2, max: 10 }), (turn1Transcript, totalQuestions) => {
        const res = advanceTurn({
          sessionId: 's1',
          answeredIndex: 0, // next index = 1 → Turn 2
          turn1Transcript,
          pool: pool(5),
          servedPoolIds: [],
          totalQuestions,
        });
        expect(res.ok).toBe(true);
        if (res.ok && res.value.kind === 'question') {
          expect(res.value.served.currentQuestionIndex).toBe(1);
          expect(res.value.servedPoolId).toBeNull();
          expect(/\{[^}]*\}/.test(res.value.served.questionText)).toBe(false);
          expect(res.value.served.questionText.length).toBeGreaterThan(0);
        }
      }),
    );
  });

  it('Property 13: domain turns come from the pool and the index increments by one', () => {
    const arb = fc
      .integer({ min: 1, max: 8 })
      .chain((n) =>
        fc.record({
          n: fc.constant(n),
          k: fc.integer({ min: 0, max: n - 1 }),
          answeredIndex: fc.integer({ min: 1, max: 6 }),
        }),
      );
    fc.assert(
      fc.property(arb, ({ n, k, answeredIndex }) => {
        const p = pool(n);
        const servedPoolIds = p.slice(0, k).map((q) => q.id);
        const poolIds = new Set(p.map((q) => q.id));
        const res = advanceTurn({
          sessionId: 's1',
          answeredIndex, // next index = answeredIndex + 1 (>= 2)
          turn1Transcript: '',
          pool: p,
          servedPoolIds,
          totalQuestions: answeredIndex + 2,
        });
        expect(res.ok).toBe(true);
        if (res.ok && res.value.kind === 'question') {
          expect(res.value.served.currentQuestionIndex).toBe(answeredIndex + 1);
          expect(res.value.servedPoolId).not.toBeNull();
          expect(poolIds.has(res.value.servedPoolId as string)).toBe(true);
          expect(servedPoolIds.includes(res.value.servedPoolId as string)).toBe(false);
        }
      }),
    );
  });
});
