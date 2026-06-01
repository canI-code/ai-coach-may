import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { ObjectId } from 'mongodb';
import { advanceTurn, selectNext } from '@/lib/interview/orchestrator';
import {
  isSemanticDuplicate,
  raceDeepDive,
  slidingWindow,
  type DeepDiveStore,
  type DeepDiveTimer,
  type RaceDeepDiveArgs,
} from '@/lib/interview/deep-dive';
import type { LLMGateway } from '@/lib/interview/llm-gateway';
import type { PooledQuestion } from '@/lib/interview/schemas';

// ── Fixtures ──────────────────────────────────────────────────────────────
const BUFFER = 'alpha beta gamma delta';

function makePool(n: number): PooledQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `pool-${i}`,
    questionText: `one two three pool ${i}`, // disjoint tokens from BUFFER
    idealAnswer: 'x',
    difficulty: 3,
    tags: [],
    origin: 'validated',
  }));
}

const genGateway = (questionText: string): LLMGateway => ({
  async complete() {
    return {
      ok: true,
      text: JSON.stringify({ questionText, idealAnswer: 'a', tags: [], difficulty: 3 }),
    };
  },
});
const neverGateway: LLMGateway = { complete: () => new Promise(() => {}) };

function cloneStore(): DeepDiveStore {
  return { async persistDeepDiveClone() { return new ObjectId().toHexString(); } };
}

// Timer that fires immediately (timeout wins) vs. one that never fires (generation wins).
const TIMER_NOW: DeepDiveTimer = {
  timeout: () => ({ promise: Promise.resolve(undefined as never), cancel: () => {} }),
};
const TIMER_NEVER: DeepDiveTimer = {
  timeout: () => ({ promise: new Promise<never>(() => {}), cancel: () => {} }),
};

function baseArgs(gateway: LLMGateway, pool: PooledQuestion[], exclusion: string[]): RaceDeepDiveArgs {
  return {
    role: 'engineer',
    difficulty: 3,
    persona: 'tech_lead',
    windowTranscripts: [],
    exclusion,
    bufferQuestionText: BUFFER,
    pool,
    gateway,
  };
}

// Feature: interview-module, Property 14: Selection never returns an excluded question
// Feature: interview-module, Property 15: Served question identifiers are all distinct
// Feature: interview-module, Property 16: Deep-dive always yields a non-duplicate Turn 7
// Feature: interview-module, Property 17: The question loop never stalls and falls back to the pool
// Feature: interview-module, Property 18: Generation context is a sliding window suffix bounded by count
describe('Properties 14-18: question loop, deep dive, sliding window', () => {
  it('Property 14: selectNext never returns an excluded question', () => {
    const idArb = fc.constantFrom('a', 'b', 'c', 'd', 'e');
    const poolArb = fc.array(idArb, { maxLength: 8 }).map((ids) =>
      ids.map((id, i) => ({
        id: `${id}-${i}`,
        questionText: `q${id}`,
        idealAnswer: 'x',
        difficulty: 1,
        tags: [] as string[],
        origin: 'validated' as const,
      })),
    );
    fc.assert(
      fc.property(poolArb, fc.array(fc.string(), { maxLength: 8 }), (pool, exclusion) => {
        const r = selectNext(pool, exclusion);
        if (r !== null) expect(exclusion.includes(r.id)).toBe(false);
      }),
    );
  });

  it('Property 16: every deep-dive branch yields exactly one non-duplicate Turn 7', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('unique', 'dup', 'timeout'),
        fc.hexaString({ minLength: 1, maxLength: 8 }),
        async (branch, salt) => {
          const pool = makePool(3);
          const gateway =
            branch === 'unique'
              ? genGateway(`unique deep dive ${salt}`)
              : branch === 'dup'
                ? genGateway(BUFFER)
                : neverGateway;
          const timer = branch === 'timeout' ? TIMER_NOW : TIMER_NEVER;
          const res = await raceDeepDive(baseArgs(gateway, pool, []), {
            store: cloneStore(),
            timer,
            maxRetries: 0,
          });
          expect(res.ok).toBe(true);
          if (res.ok) {
            expect(isSemanticDuplicate(res.value.question.questionText, BUFFER)).toBe(false);
          }
        },
      ),
    );
  });

  it('Property 17: a never-resolving generation still falls back to the pool on timeout', async () => {
    const pool = makePool(3);
    const res = await raceDeepDive(baseArgs(neverGateway, pool, []), {
      store: cloneStore(),
      timer: TIMER_NOW,
      maxRetries: 0,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.source).toBe('pool_fallback_timeout');
      expect(pool.map((q) => q.id)).toContain(res.value.question.id);
    }
  });

  it('Property 15: served identifiers across a simulated session are all distinct', async () => {
    const branchArb = fc.array(fc.constantFrom('domain', 'gen', 'dup', 'timeout'), {
      minLength: 1,
      maxLength: 12,
    });
    await fc.assert(
      fc.asyncProperty(branchArb, async (branches) => {
        const pool = makePool(14);
        const exclusion: string[] = [];
        const served: string[] = [];
        for (const branch of branches) {
          if (branch === 'domain') {
            const q = selectNext(pool, exclusion);
            if (!q) break;
            served.push(q.id);
            exclusion.push(q.id);
            continue;
          }
          const gateway =
            branch === 'gen'
              ? genGateway('deep dive specialization tradeoffs')
              : branch === 'dup'
                ? genGateway(BUFFER)
                : neverGateway;
          const timer = branch === 'timeout' ? TIMER_NOW : TIMER_NEVER;
          const res = await raceDeepDive(baseArgs(gateway, pool, exclusion), {
            store: cloneStore(),
            timer,
            maxRetries: 0,
          });
          if (!res.ok) break;
          served.push(res.value.question.id);
          exclusion.push(res.value.question.id);
        }
        expect(new Set(served).size).toBe(served.length);
      }),
    );
  });

  it('Property 18: sliding window is a contiguous suffix bounded by size, and the loop is count-bounded', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ transcript: fc.string() }), { maxLength: 12 }),
        fc.integer({ min: -2, max: 10 }),
        (answered, size) => {
          const w = slidingWindow(answered, size);
          if (size <= 0 || answered.length === 0) {
            expect(w).toEqual([]);
          } else {
            const expected = answered
              .slice(Math.max(0, answered.length - size))
              .map((t) => t.transcript);
            expect(w).toEqual(expected);
            expect(w.length).toBeLessThanOrEqual(size);
            expect(w.length).toBeLessThanOrEqual(answered.length);
          }
        },
      ),
    );

    // Req 6.3: the loop never serves beyond question_count.
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (totalQuestions) => {
        const res = advanceTurn({
          sessionId: 's1',
          answeredIndex: totalQuestions - 1,
          turn1Transcript: '',
          pool: makePool(5),
          servedPoolIds: [],
          totalQuestions,
        });
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.value.kind).toBe('complete');
      }),
    );
  });
});
