import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { ObjectId } from 'mongodb';
import { resume, buildTurn1Intro } from '@/lib/interview/orchestrator';
import type { InterviewSessionDoc, PooledQuestion } from '@/lib/interview/schemas';

function makeSession(userId: ObjectId, questionCount: number, currentQuestionIndex: number): InterviewSessionDoc {
  const pool: PooledQuestion[] = Array.from({ length: Math.max(questionCount, 1) }, (_, i) => ({
    id: `pool-${i}`,
    questionText: `Pool question ${i}`,
    idealAnswer: 'a',
    difficulty: 3,
    tags: [],
    origin: 'validated',
  }));
  return {
    _id: new ObjectId(),
    userId,
    status: 'active',
    config: {
      role: 'engineer',
      difficulty: 3,
      questionCount,
      durationMinutes: 15,
      aiPersona: 'tech_lead',
      difficultyMin: 1,
      difficultyMax: 5,
    },
    currentQuestionIndex,
    currentDifficulty: 3,
    pool,
    exclusion: pool.map((p) => p.id),
    turns: [{ index: 0, questionId: 'intro', transcript: 'I am Alex, 5 years with React', metrics: {} as never, difficultyAfter: 3, createdAt: new Date() }],
    behavioralTimeline: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function storeFor(session: InterviewSessionDoc) {
  return {
    async findSession() {
      return session;
    },
    async getPoolCache() {
      return null;
    },
    async findReport() {
      return null;
    },
  };
}

// Feature: interview-module, Property 5: Resume serves the persisted index and is idempotent
describe('Property 5: resume serves persisted index and is idempotent', () => {
  it('serves the question at the persisted index and is identical across repeats', async () => {
    const arb = fc
      .integer({ min: 1, max: 10 })
      .chain((questionCount) =>
        fc.record({
          questionCount: fc.constant(questionCount),
          idx: fc.integer({ min: 0, max: questionCount - 1 }),
        }),
      );
    await fc.assert(
      fc.asyncProperty(arb, async ({ questionCount, idx }) => {
        const userId = new ObjectId();
        const session = makeSession(userId, questionCount, idx);
        const deps = { store: storeFor(session) };

        const first = await resume(userId.toHexString(), session._id.toHexString(), deps);
        const second = await resume(userId.toHexString(), session._id.toHexString(), deps);

        expect(first).toEqual(second);
        expect(first.ok).toBe(true);
        if (first.ok && 'currentQuestionIndex' in first.value) {
          expect(first.value.currentQuestionIndex).toBe(idx);
          if (idx === 0) expect(first.value.questionText).toBe(buildTurn1Intro(session.config.role));
        }
      }),
    );
  });
});
