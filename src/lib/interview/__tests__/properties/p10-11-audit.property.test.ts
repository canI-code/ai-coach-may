import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { ObjectId } from 'mongodb';
import { seedPool } from '@/lib/interview/cache-seeder';
import { findValidatedQuestions } from '@/lib/interview/session-store';
import type { InterviewQuestionDoc, SessionConfig } from '@/lib/interview/schemas';
import type { LLMGateway } from '@/lib/interview/llm-gateway';

type Doc = InterviewQuestionDoc;

function mkDoc(status: 'validated' | 'pending'): Doc {
  return {
    _id: new ObjectId(),
    questionText: 'q',
    idealAnswer: 'a',
    role: 'engineer',
    difficulty: 3,
    tags: ['t'],
    status,
    is_validated: status === 'validated',
    source: 'seed',
    createdAt: new Date(),
  };
}

const okGateway: LLMGateway = {
  async complete() {
    return {
      ok: true,
      text: JSON.stringify({ questionText: 'gen', idealAnswer: 'ideal', tags: [], difficulty: 3 }),
    };
  },
};

const config = (questionCount: number): SessionConfig => ({
  role: 'engineer',
  difficulty: 3,
  questionCount,
  durationMinutes: 15,
  difficultyMin: 1,
  difficultyMax: 5,
  aiPersona: 'tech_lead',
});

// Feature: interview-module, Property 10: Generated questions are created as pending audit records
// Feature: interview-module, Property 11: Pending questions are excluded from the validated tier
describe('Properties 10-11: generated audit records and validated-tier exclusion', () => {
  it('Property 10: on-demand questions persist as pending/is_validated=false with both texts', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (qc) => {
        const generated: Record<string, unknown>[] = [];
        const db = {
          collection: () => ({
            find: () => ({ limit: () => ({ toArray: async () => [] }) }),
            insertOne: async (doc: Record<string, unknown>) => {
              const _id = new ObjectId();
              generated.push(doc);
              return { insertedId: _id };
            },
          }),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await seedPool(db as any, okGateway, config(qc), qc);

        expect(generated.length).toBeGreaterThan(0);
        for (const d of generated) {
          expect(d.status).toBe('pending');
          expect(d.is_validated).toBe(false);
          expect(typeof d.questionText).toBe('string');
          expect((d.questionText as string).length).toBeGreaterThan(0);
          expect(typeof d.idealAnswer).toBe('string');
          expect((d.idealAnswer as string).length).toBeGreaterThan(0);
        }
        expect(res.pool.every((p) => p.origin === 'generated')).toBe(true);
      }),
    );
  });

  it('Property 11: validated-tier query never returns a pending question', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom<'validated' | 'pending'>('validated', 'pending'), {
          minLength: 1,
          maxLength: 20,
        }),
        async (statuses) => {
          const docs = statuses.map((s) => mkDoc(s));
          const db = {
            collection: () => ({
              find: (query: { status?: string }) => ({
                limit: (n: number) => ({
                  toArray: async () => docs.filter((d) => d.status === query.status).slice(0, n),
                }),
              }),
            }),
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const got = await findValidatedQuestions(db as any, 'engineer', 1, 5, 100);
          for (const d of got) expect(d.status).toBe('validated');
        },
      ),
    );
  });
});
