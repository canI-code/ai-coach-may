import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { applyDifficulty, evaluateTurn } from '@/lib/interview/feedback';
import type { LLMGateway } from '@/lib/interview/llm-gateway';
import type { AggregatedMetrics, QuestionEvaluation } from '@/lib/interview/schemas';

const metrics: AggregatedMetrics = {
  wpmArr: [100],
  fillerCount: 1,
  eyeContactArr: [80],
  postureArr: [90],
  pitchVariance: 1,
  loudnessVariance: 1,
  sentiment: 0,
  dominantEmotion: 'calm',
  composure: 90,
  pace: 'normal',
};

const baseArgs = {
  userId: 'user-1',
  sessionId: 'sess-1',
  payload: { questionIndex: 0, transcript: 'hello world', metrics },
  activeQuestion: { id: 'q1', questionText: 'q', idealAnswer: 'a' },
  persona: 'tech_lead' as const,
  currentDifficulty: 3,
  difficultyMin: 1,
  difficultyMax: 5,
  priorTurns: [],
};

const noopStore = { async persistTurn() {} };

function gatewayReturning(text: string): LLMGateway {
  return { async complete() {
    return { ok: true, text };
  } };
}

const evalArb = fc.record({
  technicalAccuracy: fc.double({ min: 0, max: 100, noNaN: true }),
  communication: fc.double({ min: 0, max: 100, noNaN: true }),
  voiceCi: fc.double({ min: 0, max: 100, noNaN: true }),
  bodyCi: fc.double({ min: 0, max: 100, noNaN: true }),
  strengths: fc.array(fc.string()),
  improvements: fc.array(fc.string()),
  difficultyAdjustment: fc.constantFrom('increase', 'same', 'decrease'),
});

// Feature: interview-module, Property 26: Validated evaluations are complete and bounded
// Feature: interview-module, Property 27: Evaluation failure returns a typed error with no feedback
// Feature: interview-module, Property 30: Difficulty stays within bounds and `same` is identity
describe('Properties 26, 27, 30: feedback evaluation and difficulty', () => {
  it('Property 26: a successful evaluation is complete and bounded', async () => {
    await fc.assert(
      fc.asyncProperty(evalArb, async (evaluation) => {
        const res = await evaluateTurn(baseArgs, {
          gateway: gatewayReturning(JSON.stringify(evaluation)),
          store: noopStore,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          const e: QuestionEvaluation = res.value.evaluation;
          for (const score of [e.technicalAccuracy, e.communication, e.voiceCi, e.bodyCi]) {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          }
          expect(Array.isArray(e.strengths)).toBe(true);
          expect(Array.isArray(e.improvements)).toBe(true);
          expect(['increase', 'same', 'decrease']).toContain(e.difficultyAdjustment);
        }
      }),
    );
  });

  it('Property 27: an unvalidatable response yields evaluation_failed with no feedback', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (garbage) => {
        const res = await evaluateTurn(baseArgs, {
          gateway: gatewayReturning(`not-json ${garbage}`),
          store: noopStore,
          maxRetries: 0,
        });
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.kind).toBe('evaluation_failed');
        expect('value' in res).toBe(false);
      }),
    );
  });

  it('Property 30: difficulty stays within bounds and `same` is identity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        fc.constantFrom<'increase' | 'same' | 'decrease'>('increase', 'same', 'decrease'),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b, adj, frac) => {
          const min = Math.min(a, b);
          const max = Math.max(a, b);
          const current = min + Math.round(frac * (max - min));
          const out = applyDifficulty(current, adj, min, max);
          expect(out).toBeGreaterThanOrEqual(min);
          expect(out).toBeLessThanOrEqual(max);
          if (adj === 'same') expect(out).toBe(current);
          if (min === max) expect(out).toBe(min);
        },
      ),
    );
  });
});
