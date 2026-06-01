import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { ObjectId } from 'mongodb';
import { seedPool } from '@/lib/interview/cache-seeder';
import type { InterviewQuestionDoc, QuestionOrigin, SessionConfig } from '@/lib/interview/schemas';
import type { LLMGateway } from '@/lib/interview/llm-gateway';

type Doc = InterviewQuestionDoc;

function mkDoc(status: 'validated' | 'pending', rejected = false): Doc {
  return {
    _id: new ObjectId(),
    questionText: 'q',
    idealAnswer: 'a',
    role: 'engineer',
    difficulty: 3,
    tags: ['t'],
    status,
    is_validated: status === 'validated',
    ...(rejected ? { rejected: true } : {}),
    source: 'seed',
    createdAt: new Date(),
  };
}

// db that honours status / rejected filters and records generated inserts
function fakeDb(validated: Doc[], pending: Doc[]) {
  const generated: Record<string, unknown>[] = [];
  const db = {
    collection: () => ({
      find: (query: { status?: string; rejected?: unknown }) => ({
        limit: (n: number) => ({
          toArray: async () => {
            if (query.status === 'validated') return validated.slice(0, n);
            if (query.status === 'pending') {
              const src = query.rejected ? pending.filter((d) => d.rejected !== true) : pending;
              return src.slice(0, n);
            }
            return [];
          },
        }),
      }),
      insertOne: async (doc: Record<string, unknown>) => {
        const _id = new ObjectId();
        generated.push({ ...doc, _id });
        return { insertedId: _id };
      },
    }),
  };
  return { db, generated };
}

const okGateway: LLMGateway = {
  async complete() {
    return {
      ok: true,
      text: JSON.stringify({ questionText: 'gen', idealAnswer: 'a', tags: [], difficulty: 3 }),
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

const RANK: Record<QuestionOrigin, number> = { validated: 0, pending: 1, generated: 2 };

// Feature: interview-module, Property 7: Seeded pool exclusion has no duplicates
// Feature: interview-module, Property 8: Tier selection order is strictly prioritized
// Feature: interview-module, Property 9: Successful seeding meets the required count
describe('Properties 7-9: seeding pool, tier order, count', () => {
  it('Property 7: exclusion equals pool ids with no duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 6 }),
        fc.nat({ max: 6 }),
        fc.integer({ min: 1, max: 8 }),
        async (nVal, nPend, qc) => {
          const { db } = fakeDb(
            Array.from({ length: nVal }, () => mkDoc('validated')),
            Array.from({ length: nPend }, () => mkDoc('pending')),
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await seedPool(db as any, okGateway, config(qc), qc);
          expect(new Set(res.exclusion).size).toBe(res.exclusion.length);
          expect(res.exclusion).toEqual(res.pool.map((p) => p.id));
        },
      ),
    );
  });

  it('Property 8: consumes validated → pending → on-demand and never picks rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 5 }),
        fc.nat({ max: 5 }),
        fc.nat({ max: 3 }),
        fc.integer({ min: 1, max: 10 }),
        async (nVal, nPend, nRej, qc) => {
          const rejected = Array.from({ length: nRej }, () => mkDoc('pending', true));
          const rejIds = new Set(rejected.map((d) => d._id.toHexString()));
          const { db } = fakeDb(
            Array.from({ length: nVal }, () => mkDoc('validated')),
            [...Array.from({ length: nPend }, () => mkDoc('pending')), ...rejected],
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await seedPool(db as any, okGateway, config(qc), qc);

          for (const q of res.pool) expect(rejIds.has(q.id)).toBe(false);
          for (let i = 1; i < res.pool.length; i++) {
            expect(RANK[res.pool[i].origin]).toBeGreaterThanOrEqual(RANK[res.pool[i - 1].origin]);
          }
          const order = ['validated', 'pending', 'on_demand'];
          let idx = -1;
          for (const t of res.tiersUsed) {
            const p = order.indexOf(t);
            expect(p).toBeGreaterThan(idx);
            idx = p;
          }
        },
      ),
    );
  });

  it('Property 9: pool size >= questionCount when supply suffices', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.nat({ max: 5 }),
        fc.nat({ max: 5 }),
        async (qc, nVal, nPend) => {
          // on-demand (okGateway) guarantees total supply >= questionCount
          const { db } = fakeDb(
            Array.from({ length: nVal }, () => mkDoc('validated')),
            Array.from({ length: nPend }, () => mkDoc('pending')),
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await seedPool(db as any, okGateway, config(qc), qc);
          expect(res.pool.length).toBeGreaterThanOrEqual(qc);
        },
      ),
    );
  });
});
