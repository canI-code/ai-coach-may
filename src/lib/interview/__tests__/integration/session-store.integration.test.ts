import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { ObjectId } from 'mongodb';
import {
  setPoolCache,
  getPoolCache,
  delPoolCache,
  setReportStatusCache,
  getReportStatusCache,
  insertSession,
  createReportStub,
  updateReport,
  INTERVIEW_COLLECTIONS,
  type PoolCache,
} from '@/lib/interview/session-store';

const EXAM_COLLECTIONS = ['questions_ai', 'questions_non_ai', 'exam_sessions', 'exam_attempts'];

describe('session-store integration', () => {
  it('round-trips the pool cache through the Redis in-memory fallback', async () => {
    const data: PoolCache = {
      pool: [],
      exclusion: ['q1', 'q2'],
      currentQuestionIndex: 3,
      currentDifficulty: 4,
    };
    await setPoolCache('sess-1', data);
    expect(await getPoolCache('sess-1')).toEqual(data);
    await delPoolCache('sess-1');
    expect(await getPoolCache('sess-1')).toBeNull();
  });

  it('round-trips the report status cache', async () => {
    await setReportStatusCache('rep-1', 'ready');
    expect(await getReportStatusCache('rep-1')).toEqual({ status: 'ready' });
  });

  it('writes only to interview collections', async () => {
    const writes: string[] = [];
    const db = {
      collection: (name: string) => ({
        insertOne: async () => {
          writes.push(name);
          return { insertedId: new ObjectId() };
        },
        updateOne: async () => {
          writes.push(name);
          return { matchedCount: 1, modifiedCount: 1 };
        },
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyDb = db as any;
    await insertSession(anyDb, {
      _id: new ObjectId(),
      userId: new ObjectId(),
      status: 'seeding',
      config: {
        role: 'engineer',
        difficulty: 3,
        questionCount: 7,
        durationMinutes: 10,
        aiPersona: 'tech_lead',
        difficultyMin: 1,
        difficultyMax: 5,
      },
      currentQuestionIndex: 0,
      currentDifficulty: 3,
      pool: [],
      exclusion: [],
      turns: [],
      behavioralTimeline: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createReportStub(anyDb, { sessionId: new ObjectId(), userId: new ObjectId() });
    await updateReport(anyDb, new ObjectId().toString(), { status: 'ready' });

    expect(writes).toContain(INTERVIEW_COLLECTIONS.sessions);
    expect(writes).toContain(INTERVIEW_COLLECTIONS.reports);
    for (const c of writes) expect(EXAM_COLLECTIONS).not.toContain(c);
  });
});
