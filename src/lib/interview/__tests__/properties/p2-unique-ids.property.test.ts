import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { ObjectId } from 'mongodb';
import { createSession, type CreateSessionDeps } from '@/lib/interview/orchestrator';
import type { PooledQuestion, SessionConfig } from '@/lib/interview/schemas';

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

const noopStore = {
  async insertSession() {},
  async updateSession() {},
  async setPoolCache() {},
};

const config = {
  role: 'engineer',
  difficulty: 3,
  durationMinutes: 10,
  difficultyMin: 1,
  difficultyMax: 5,
  aiPersona: 'tech_lead',
};

// Feature: interview-module, Property 2: Unique session identifiers
describe('Property 2: unique session identifiers', () => {
  it('assigns a distinct id to every created session', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 25 }), async (count) => {
        const ids = new Set<string>();
        const userId = new ObjectId().toHexString();
        for (let i = 0; i < count; i++) {
          const res = await createSession(userId, config, { seed: fakeSeed, store: noopStore });
          expect(res.ok).toBe(true);
          if (res.ok) ids.add(res.value.sessionId);
        }
        expect(ids.size).toBe(count);
      }),
    );
  });
});
