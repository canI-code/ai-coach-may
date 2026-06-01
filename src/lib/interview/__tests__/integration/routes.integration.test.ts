import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import type { NextRequest } from 'next/server';

// ── Hoisted mock state ──────────────────────────────────────────────────────
const authState = vi.hoisted(() => ({ user: null as { _id: ObjectId } | null }));
const afterState = vi.hoisted(() => ({ callbacks: [] as Array<() => unknown> }));
const reportState = vi.hoisted(() => ({ runs: [] as string[] }));
const dbState = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  report: null as Record<string, unknown> | null,
  statusCache: null as { status: string } | null,
  inserted: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => authState.user }));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (fn: () => unknown) => afterState.callbacks.push(fn) };
});

vi.mock('@/lib/interview/report', () => ({
  runReportJob: async (_db: unknown, sessionId: string) => {
    reportState.runs.push(sessionId);
  },
}));

vi.mock('@/lib/interview/cache-seeder', () => ({
  seedPool: async (_db: unknown, _gw: unknown, config: { questionCount: number }) => {
    const pool = Array.from({ length: config.questionCount }, (_, i) => ({
      id: `q${i}`,
      questionText: 'Q',
      idealAnswer: 'a',
      difficulty: 3,
      tags: [],
      origin: 'validated',
    }));
    return { pool, exclusion: pool.map((p) => p.id), tiersUsed: ['validated'] };
  },
}));

vi.mock('@/lib/interview/llm-gateway', () => ({
  getLLMGateway: () => ({
    complete: async (req: any) => {
      const p = req.prompt;
      if (p.includes('technicalAccuracy')) {
        return {
          ok: true,
          text: JSON.stringify({
            technicalAccuracy: 75,
            communication: 78,
            voiceCi: 72,
            bodyCi: 74,
            strengths: ['Clear structure'],
            improvements: ['More specifics'],
            difficultyAdjustment: 'same',
          }),
        };
      }
      if (p.includes('questionText')) {
        return {
          ok: true,
          text: JSON.stringify({
            questionText: 'Can you walk me through your reasoning on that in more depth?',
            idealAnswer: 'A strong answer expands on the prior point with concrete detail.',
            tags: ['follow-up'],
            difficulty: 3,
          }),
        };
      }
      return { ok: true, text: '{}' };
    },
  }),
}));

vi.mock('@/lib/interview/session-store', () => ({
  getInterviewDb: async () => ({}),
  insertSession: async (_db: unknown, doc: Record<string, unknown>) => {
    dbState.inserted.push(doc);
  },
  updateSession: async (_db: unknown, _id: string, patch: Record<string, unknown>) => {
    if (dbState.session) Object.assign(dbState.session, patch);
  },
  setPoolCache: async () => {},
  getPoolCache: async () => null,
  findSession: async () => dbState.session,
  findReport: async () => dbState.report,
  createReportStub: async () => new ObjectId(),
  getReportStatusCache: async () => dbState.statusCache,
  insertInterviewQuestion: async () => new ObjectId(),
}));

import { POST as startPOST } from '@/app/api/interview/start/route';
import { POST as answerPOST } from '@/app/api/interview/[sessionId]/answer/route';
import { POST as resumePOST } from '@/app/api/interview/[sessionId]/resume/route';
import { POST as endPOST } from '@/app/api/interview/[sessionId]/end/route';
import { GET as reportGET } from '@/app/api/interview/[sessionId]/report/route';

const jsonReq = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
const ctxFor = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) });

const validConfig = {
  role: 'engineer',
  difficulty: 3,
  durationMinutes: 10,
  difficultyMin: 1,
  difficultyMax: 5,
  aiPersona: 'tech_lead',
};
const validAnswer = {
  questionIndex: 0,
  transcript: 'hi',
  metrics: {
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
  },
};

function makeSession(ownerId: ObjectId, extra: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    _id: new ObjectId(),
    userId: ownerId,
    status: 'active',
    config: { ...validConfig, questionCount: 7 },
    currentQuestionIndex: 0,
    currentDifficulty: 3,
    pool: [],
    exclusion: [],
    turns: [],
    behavioralTimeline: [],
    createdAt: now,
    startedAt: now,
    ...extra,
  };
}

describe('main interview routes — integration', () => {
  beforeEach(() => {
    authState.user = null;
    afterState.callbacks = [];
    reportState.runs = [];
    dbState.session = null;
    dbState.report = null;
    dbState.statusCache = null;
    dbState.inserted = [];
  });

  it('start associates the session with the authenticated candidate (cookie auth)', async () => {
    const uid = new ObjectId();
    authState.user = { _id: uid };
    const res = await startPOST(jsonReq(validConfig));
    expect(res.status).toBe(201);
    expect(dbState.inserted).toHaveLength(1);
    expect((dbState.inserted[0].userId as ObjectId).toHexString()).toBe(uid.toHexString());
    expect(dbState.inserted[0].status).toBe('seeding');
  });

  it('every route rejects an unauthenticated request with 401', async () => {
    const sid = new ObjectId().toHexString();
    const results = await Promise.all([
      startPOST(jsonReq(validConfig)),
      answerPOST(jsonReq(validAnswer), ctxFor(sid) as Parameters<typeof answerPOST>[1]),
      resumePOST(jsonReq({}), ctxFor(sid) as Parameters<typeof resumePOST>[1]),
      endPOST(jsonReq({}), ctxFor(sid) as Parameters<typeof endPOST>[1]),
      reportGET(jsonReq({}), ctxFor(sid) as Parameters<typeof reportGET>[1]),
    ]);
    for (const res of results) expect(res.status).toBe(401);
  });

  it('answer/resume/end/report reject a non-owner with 403', async () => {
    authState.user = { _id: new ObjectId() };
    dbState.session = makeSession(new ObjectId()); // owned by someone else
    const sid = (dbState.session._id as ObjectId).toHexString();

    const answer = await answerPOST(jsonReq(validAnswer), ctxFor(sid) as Parameters<typeof answerPOST>[1]);
    const resume = await resumePOST(jsonReq({}), ctxFor(sid) as Parameters<typeof resumePOST>[1]);
    const end = await endPOST(jsonReq({}), ctxFor(sid) as Parameters<typeof endPOST>[1]);
    const report = await reportGET(jsonReq({}), ctxFor(sid) as Parameters<typeof reportGET>[1]);

    for (const res of [answer, resume, end, report]) expect(res.status).toBe(403);
  });

  it('end schedules report compilation via after() and returns a pollable pending status', async () => {
    const uid = new ObjectId();
    authState.user = { _id: uid };
    dbState.session = makeSession(uid);
    const sid = (dbState.session._id as ObjectId).toHexString();

    const res = await endPOST(jsonReq({}), ctxFor(sid) as Parameters<typeof endPOST>[1]);
    const body = await res.json();
    expect(body.status).toBe('pending');
    expect(typeof body.reportId).toBe('string');

    expect(afterState.callbacks).toHaveLength(1);
    await afterState.callbacks[0]();
    expect(reportState.runs).toContain(sid);
  });

  it('report poll returns pending then the full report when ready', async () => {
    const uid = new ObjectId();
    authState.user = { _id: uid };
    const reportId = new ObjectId();
    dbState.session = makeSession(uid, { status: 'completed', reportId });
    const sid = (dbState.session._id as ObjectId).toHexString();

    dbState.report = { status: 'pending' };
    const pending = await reportGET(jsonReq({}), ctxFor(sid) as Parameters<typeof reportGET>[1]);
    expect((await pending.json()).status).toBe('pending');

    dbState.report = {
      status: 'ready',
      sessionId: dbState.session._id,
      ciScore: 80,
      categoryScores: { technicalAccuracy: 80, communication: 80, voiceCi: 80, bodyCi: 80 },
      weaknessTags: [],
      resources: [],
      narrative: 'good',
      behavioralTimeline: [],
      readyAt: new Date(),
    };
    const ready = await reportGET(jsonReq({}), ctxFor(sid) as Parameters<typeof reportGET>[1]);
    const body = await ready.json();
    expect(body.status).toBe('ready');
    expect(body.report.ciScore).toBe(80);
  });

  it('answer submit at index 1 schedules pregeneration via after()', async () => {
    const uid = new ObjectId();
    authState.user = { _id: uid };
    dbState.session = makeSession(uid, {
      pool: [
        { id: 'pq0', questionText: 'Pool Q1', idealAnswer: '', difficulty: 3, tags: [], origin: 'validated' },
        { id: 'pq1', questionText: 'Pool Q2', idealAnswer: '', difficulty: 3, tags: [], origin: 'validated' },
      ],
      exclusion: ['pq0', 'pq1'],
    });
    const sid = (dbState.session._id as ObjectId).toHexString();

    const payload = {
      ...validAnswer,
      questionIndex: 1, // submitting Turn 2
    };

    const res = await answerPOST(jsonReq(payload), ctxFor(sid) as Parameters<typeof answerPOST>[1]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.nextQuestion).toBe('Pool Q1'); // Served Q3
    expect(body.index).toBe(2);

    // Should have scheduled pre-generation
    expect(afterState.callbacks).toHaveLength(1);
    
    // Let's run the scheduled pregeneration callback and verify it updates the pool cache
    await afterState.callbacks[0]();
    
    // Retrieve the modified session state
    const updatedSession = dbState.session as any;
    expect(updatedSession.pool[1].origin).toBe('generated');
    expect(updatedSession.pool[1].questionText).toBe('Can you walk me through your reasoning on that in more depth?');
  });
});
