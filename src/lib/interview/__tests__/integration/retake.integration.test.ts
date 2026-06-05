import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import type { NextRequest } from 'next/server';

// ── Mock State ──────────────────────────────────────────────────────────────
const authState = vi.hoisted(() => ({ user: null as { _id: ObjectId } | null }));
const dbState = vi.hoisted(() => ({
  sessions: [] as any[],
  reports: [] as any[],
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => authState.user,
}));

vi.mock('@/lib/interview/cache-seeder', () => ({
  seedPool: async (_db: any, _gw: any, config: any) => {
    return {
      pool: Array.from({ length: config.questionCount }, (_, i) => ({
        id: `q${i}`,
        questionText: 'Test Question',
        idealAnswer: 'Test Ideal Answer',
        difficulty: config.difficulty,
        tags: [],
        origin: 'validated',
      })),
      exclusion: [],
      tiersUsed: ['validated'],
    };
  },
}));

vi.mock('@/lib/interview/llm-gateway', () => ({
  getLLMGateway: () => ({}),
}));

vi.mock('@/lib/interview/session-store', () => ({
  getInterviewDb: async () => ({
    collection: (name: string) => ({
      findOne: async (query: any) => {
        if (name === 'interview_sessions') {
          return dbState.sessions.find(s => s._id.toHexString() === query._id?.toHexString()) || null;
        }
        if (name === 'coaching_reports') {
          return dbState.reports.find(r => r.sessionId?.toHexString() === query.sessionId?.toHexString() && (!query.status || r.status === query.status)) || null;
        }
        return null;
      },
      countDocuments: async (query: any) => {
        if (name === 'interview_sessions') {
          return dbState.sessions.filter(s => {
            if (query.parentSessionId && s.parentSessionId?.toHexString() !== query.parentSessionId.toHexString()) {
              return false;
            }
            if (query.createdAt && query.createdAt.$gte && s.createdAt < query.createdAt.$gte) {
              return false;
            }
            return true;
          }).length;
        }
        return 0;
      },
      find: (query: any) => ({
        toArray: async () => {
          if (name === 'interview_sessions') {
            return dbState.sessions.filter(s => {
              if (query.userId && s.userId.toHexString() !== query.userId.toHexString()) return false;
              if (query.$or) {
                return query.$or.some((q: any) => {
                  if (q._id && s._id.toHexString() === q._id.toHexString()) return true;
                  if (q.parentSessionId && s.parentSessionId?.toHexString() === q.parentSessionId.toHexString()) return true;
                  return false;
                });
              }
              return true;
            });
          }
          if (name === 'coaching_reports') {
            return dbState.reports;
          }
          return [];
        },
      }),
      aggregate: (pipeline: any[]) => ({
        toArray: async () => {
          const matchStage = pipeline.find((p: any) => p.$match);
          const matchUser = matchStage?.$match?.userId;
          let filtered = dbState.sessions;
          if (matchUser) {
            filtered = filtered.filter(s => s.userId.toHexString() === matchUser.toHexString());
          }
          return filtered.map(s => ({
            ...s,
            turnsCount: s.turns?.length ?? 0,
          }));
        },
      }),
      insertOne: async (doc: any) => {
        dbState.sessions.push(doc);
        return { insertedId: doc._id };
      },
    }),
  }),
  insertSession: async (_db: any, doc: any) => {
    dbState.sessions.push(doc);
  },
  updateSession: async (_db: any, id: string, patch: any) => {
    const idx = dbState.sessions.findIndex(s => s._id.toHexString() === id);
    if (idx !== -1) {
      dbState.sessions[idx] = { ...dbState.sessions[idx], ...patch, updatedAt: new Date() };
    }
  },
  findSession: async (_db: any, id: string) => {
    return dbState.sessions.find(s => s._id.toHexString() === id) || null;
  },
  findReport: async (_db: any, id: string) => {
    return dbState.reports.find(r => r._id.toHexString() === id) || null;
  },
  setPoolCache: async () => {},
  getPoolCache: async () => null,
  INTERVIEW_COLLECTIONS: {
    sessions: 'interview_sessions',
    questions: 'interview_questions',
    reports: 'coaching_reports',
  },
}));

import { POST as retakePOST } from '@/app/api/interview/[sessionId]/retake/route';
import { GET as sessionsGET } from '@/app/api/interview/sessions/route';

const jsonReq = (body: any = {}, url = 'http://localhost/api/interview/sessions') => ({
  url,
  json: async () => body,
} as unknown as NextRequest);

const ctxFor = (sessionId: string) => ({
  params: Promise.resolve({ sessionId }),
});

describe('Interview Retake & Sessions integration tests', () => {
  beforeEach(() => {
    authState.user = null;
    dbState.sessions = [];
    dbState.reports = [];
  });

  it('rejects unauthorized users with 401', async () => {
    const res = await retakePOST(jsonReq(), ctxFor(new ObjectId().toHexString()));
    expect(res.status).toBe(401);
  });

  it('rejects retakes on non-owned sessions with 403', async () => {
    const ownerId = new ObjectId();
    const anotherUser = new ObjectId();
    authState.user = { _id: anotherUser };

    const parentSession = {
      _id: new ObjectId(),
      userId: ownerId,
      status: 'completed',
      config: {
        role: 'engineer',
        difficulty: 3,
        durationMinutes: 10,
        difficultyMin: 1,
        difficultyMax: 5,
        aiPersona: 'tech_lead',
        sessionType: 'full',
      },
      createdAt: new Date(),
    };
    dbState.sessions.push(parentSession);

    const res = await retakePOST(jsonReq(), ctxFor(parentSession._id.toHexString()));
    expect(res.status).toBe(403);
  });

  it('allows retake, computes attempt number and creates a new session in DB', async () => {
    const userId = new ObjectId();
    authState.user = { _id: userId };

    const parentSession = {
      _id: new ObjectId(),
      userId,
      status: 'completed',
      config: {
        role: 'engineer',
        difficulty: 3,
        durationMinutes: 10,
        difficultyMin: 1,
        difficultyMax: 5,
        aiPersona: 'tech_lead',
        sessionType: 'full',
      },
      createdAt: new Date(),
    };
    dbState.sessions.push(parentSession);

    const res = await retakePOST(jsonReq(), ctxFor(parentSession._id.toHexString()));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.success).toBe(true);

    const createdSession = dbState.sessions.find(s => s._id.toHexString() === body.sessionId);
    expect(createdSession).toBeDefined();
    expect(createdSession.parentSessionId.toHexString()).toBe(parentSession._id.toHexString());
    expect(createdSession.attemptNumber).toBe(2);
  });

  it('maps dynamically the starting difficulty based on previous attempt ciScore', async () => {
    const userId = new ObjectId();
    authState.user = { _id: userId };

    const parentSession = {
      _id: new ObjectId(),
      userId,
      status: 'completed',
      config: {
        role: 'engineer',
        difficulty: 3,
        durationMinutes: 10,
        difficultyMin: 1,
        difficultyMax: 5,
        aiPersona: 'tech_lead',
        sessionType: 'full',
      },
      createdAt: new Date(),
    };
    dbState.sessions.push(parentSession);

    // Set coaching report with ciScore < 60
    dbState.reports.push({
      _id: new ObjectId(),
      sessionId: parentSession._id,
      userId,
      status: 'ready',
      ciScore: 50,
      createdAt: new Date(),
    });

    const res1 = await retakePOST(jsonReq(), ctxFor(parentSession._id.toHexString()));
    const body1 = await res1.json();
    const retake1 = dbState.sessions.find(s => s._id.toHexString() === body1.sessionId);
    expect(retake1.config.difficulty).toBe(1);

    // Mark retake1 completed so it is matched as the previous completed attempt
    retake1.status = 'completed';

    // Set coaching report on retake1 with ciScore > 80
    dbState.reports.push({
      _id: new ObjectId(),
      sessionId: retake1._id,
      userId,
      status: 'ready',
      ciScore: 90,
      createdAt: new Date(),
    });

    const res2 = await retakePOST(jsonReq(), ctxFor(retake1._id.toHexString()));
    const body2 = await res2.json();
    const retake2 = dbState.sessions.find(s => s._id.toHexString() === body2.sessionId);
    expect(retake2.config.difficulty).toBe(5);
  });

  it('respects 24h limit of maximum 2 retakes per session group', async () => {
    const userId = new ObjectId();
    authState.user = { _id: userId };

    const parentSession = {
      _id: new ObjectId(),
      userId,
      status: 'completed',
      config: {
        role: 'engineer',
        difficulty: 3,
        durationMinutes: 10,
        difficultyMin: 1,
        difficultyMax: 5,
        aiPersona: 'tech_lead',
        sessionType: 'full',
      },
      createdAt: new Date(),
    };
    dbState.sessions.push(parentSession);

    // Attempt 1 (retake 1)
    const res1 = await retakePOST(jsonReq(), ctxFor(parentSession._id.toHexString()));
    expect(res1.status).toBe(201);

    // Attempt 2 (retake 2)
    const res2 = await retakePOST(jsonReq(), ctxFor(parentSession._id.toHexString()));
    expect(res2.status).toBe(201);

    // Attempt 3 (retake 3 - should fail due to 24h rate limit)
    const res3 = await retakePOST(jsonReq(), ctxFor(parentSession._id.toHexString()));
    expect(res3.status).toBe(429);
    const body3 = await res3.json();
    expect(body3.error).toBe('rate_limit_exceeded');
  });

  it('sessions list groupings and canRetake calculation works', async () => {
    const userId = new ObjectId();
    authState.user = { _id: userId };

    const parentSession = {
      _id: new ObjectId(),
      userId,
      status: 'completed',
      config: {
        role: 'engineer',
        difficulty: 3,
        durationMinutes: 10,
        difficultyMin: 1,
        difficultyMax: 5,
        aiPersona: 'tech_lead',
        sessionType: 'full',
      },
      createdAt: new Date(Date.now() - 2 * 3600 * 1000), // 2 hours ago
      turns: [{}, {}],
    };
    dbState.sessions.push(parentSession);

    const retakeSession = {
      _id: new ObjectId(),
      userId,
      status: 'active',
      parentSessionId: parentSession._id,
      attemptNumber: 2,
      config: {
        role: 'engineer',
        difficulty: 1,
        durationMinutes: 10,
        difficultyMin: 1,
        difficultyMax: 5,
        aiPersona: 'tech_lead',
        sessionType: 'full',
      },
      createdAt: new Date(Date.now() - 1 * 3600 * 1000), // 1 hour ago
      turns: [],
    };
    dbState.sessions.push(retakeSession);

    // Get grouped sessions
    const res = await sessionsGET(jsonReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sessions).toHaveLength(1);

    const group = body.sessions[0];
    expect(group.sessionId).toBe(parentSession._id.toHexString());
    expect(group.attempts).toHaveLength(2);
    expect(group.canRetake).toBe(true);

    const parentAttempt = group.attempts.find((a: any) => a.attemptId === parentSession._id.toHexString());
    expect(parentAttempt.attemptNumber).toBe(1);
    expect(parentAttempt.questionsAnswered).toBe(2);
    expect(parentAttempt.level).toBe('Intermediate');

    const retakeAttempt = group.attempts.find((a: any) => a.attemptId === retakeSession._id.toHexString());
    expect(retakeAttempt.attemptNumber).toBe(2);
    expect(retakeAttempt.questionsAnswered).toBe(0);
    expect(retakeAttempt.level).toBe('Beginner');
  });
});
