import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import {
  insertInterviewQuestion,
  INTERVIEW_COLLECTIONS,
} from '@/lib/interview/session-store';

const EXAM_COLLECTIONS = ['questions_ai', 'questions_non_ai', 'exam_sessions', 'exam_attempts'];

function recordingDb() {
  const writes: { coll: string; doc: Record<string, unknown> }[] = [];
  const db = {
    collection: (name: string) => ({
      insertOne: async (doc: Record<string, unknown>) => {
        writes.push({ coll: name, doc });
        return { insertedId: 'x' };
      },
    }),
  };
  return { db, writes };
}

const baseArb = fc.record({
  questionText: fc.string(),
  idealAnswer: fc.string(),
  role: fc.string(),
  difficulty: fc.integer(),
  tags: fc.array(fc.string()),
  is_validated: fc.boolean(),
  source: fc.constantFrom('seed', 'on_demand', 'deep_dive'),
  createdAt: fc.date(),
});

// Feature: interview-module, Property 37: Persistence stays within interview collections
describe('Property 37: persistence scope', () => {
  it('never targets exam collections in its configuration', () => {
    for (const name of Object.values(INTERVIEW_COLLECTIONS)) {
      expect(EXAM_COLLECTIONS).not.toContain(name);
    }
  });

  it('only persists questions with validated|pending status to interview_questions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('validated', 'pending', 'active', 'rejected', 'draft', ''),
        baseArb,
        async (status, base) => {
          const { db, writes } = recordingDb();
          const doc = { ...base, status };
          if (status === 'validated' || status === 'pending') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await insertInterviewQuestion(db as any, doc as any);
            expect(writes).toHaveLength(1);
            expect(writes[0].coll).toBe(INTERVIEW_COLLECTIONS.questions);
            expect(['validated', 'pending']).toContain(writes[0].doc.status);
            expect(EXAM_COLLECTIONS).not.toContain(writes[0].coll);
          } else {
            await expect(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              insertInterviewQuestion(db as any, doc as any),
            ).rejects.toThrow();
            expect(writes).toHaveLength(0);
          }
        },
      ),
    );
  });
});
