import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { ObjectId } from 'mongodb';
import { createSession, type CreateSessionDeps } from '@/lib/interview/orchestrator';
import { durationToMaxQuestions, DURATION_OPTIONS } from '@/lib/interview/duration';
import type { InterviewSessionDoc, PooledQuestion, SessionConfig } from '@/lib/interview/schemas';

function fakeStore() {
  const inserted: InterviewSessionDoc[] = [];
  return {
    inserted,
    store: {
      async insertSession(doc: InterviewSessionDoc) {
        inserted.push(doc);
      },
      async updateSession() {},
      async setPoolCache() {},
    },
  };
}

const fakeSeed: CreateSessionDeps['seed'] = async (config: SessionConfig, minPoolSize: number) => {
  const n = Math.max(config.questionCount, minPoolSize);
  const pool: PooledQuestion[] = Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    questionText: `Q${i}`,
    idealAnswer: 'a',
    difficulty: config.difficulty,
    tags: [],
    origin: 'validated',
  }));
  return { pool, exclusion: pool.map((p) => p.id), tiersUsed: ['validated'] };
};

const configArb = fc.record({
  role: fc.string({ minLength: 1 }),
  difficulty: fc.integer({ min: 1, max: 5 }),
  durationMinutes: fc.constantFrom(...DURATION_OPTIONS),
  difficultyMin: fc.integer({ min: 1, max: 3 }),
  difficultyMax: fc.integer({ min: 3, max: 5 }),
  aiPersona: fc.option(
    fc.constantFrom('stress_interviewer', 'tech_lead', 'general_recruiter'),
    { nil: undefined },
  ),
});

// Feature: interview-module, Property 1: Created session preserves configuration
describe('Property 1: created session preserves configuration', () => {
  it('persists requested config with durationMinutes and derived questionCount', async () => {
    await fc.assert(
      fc.asyncProperty(configArb, async (cfg) => {
        const { inserted, store } = fakeStore();
        const userId = new ObjectId().toHexString();
        const expectedQC = durationToMaxQuestions(cfg.durationMinutes);
        const res = await createSession(userId, cfg, { seed: fakeSeed, store });
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.value.totalQuestions).toBe(expectedQC);

        expect(inserted).toHaveLength(1);
        const stored = inserted[0].config;
        expect(stored.role).toBe(cfg.role);
        expect(stored.difficulty).toBe(cfg.difficulty);
        expect(stored.durationMinutes).toBe(cfg.durationMinutes);
        expect(stored.questionCount).toBe(expectedQC);
        expect(stored.difficultyMin).toBe(cfg.difficultyMin);
        expect(stored.difficultyMax).toBe(cfg.difficultyMax);
        expect(stored.aiPersona).toBe(cfg.aiPersona ?? 'general_recruiter');
      }),
    );
  });
});
