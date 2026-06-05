import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { GET } from '@/app/api/students/exam/history/route';

// ── Mock State ──────────────────────────────────────────────────────────────
const authState = vi.hoisted(() => ({ user: null as { _id: ObjectId } | null }));

const { mockDb, dbState } = vi.hoisted(() => {
  const dbState = {
    assessments: [] as any[],
    examAttempts: [] as any[],
    sessions: [] as any[],
    questionsNonAi: [] as any[],
    questionsAi: [] as any[],
  };

  const mockDb = {
    collection: (name: string) => ({
      find: (query: any) => ({
        toArray: async () => {
          if (name === 'user_assessment_attempts') {
            return dbState.assessments.filter(
              (a: any) =>
                a.userId.toString() === query.userId.toString() &&
                a.status === query.status
            );
          }
          if (name === 'exam_attempts') {
            return dbState.examAttempts.filter(
              (a: any) =>
                a.userId.toString() === query.userId.toString() &&
                (query.completedAt ? a.completedAt : true)
            );
          }
          if (name === 'exam_sessions') {
            const ids = query._id?.$in?.map((id: any) => id.toString()) || [];
            return dbState.sessions.filter((s: any) => ids.includes(s._id.toString()));
          }
          if (name === 'questions_non_ai') {
            const ids = query._id?.$in?.map((id: any) => id.toString()) || [];
            return dbState.questionsNonAi.filter((q: any) => ids.includes(q._id.toString()));
          }
          if (name === 'questions_ai') {
            const ids = query._id?.$in?.map((id: any) => id.toString()) || [];
            return dbState.questionsAi.filter((q: any) => ids.includes(q._id.toString()));
          }
          return [];
        },
      }),
      aggregate: (pipeline: any[]) => ({
        toArray: async () => {
          const matchStage = pipeline.find((p: any) => p.$match)?.$match || {};
          const matched = dbState.examAttempts.filter((att: any) => {
            if (matchStage.attemptNumber && matchStage.attemptNumber.$gt) {
              if (!(att.attemptNumber > matchStage.attemptNumber.$gt)) return false;
            }
            if (matchStage.startedAt && matchStage.startedAt.$gte) {
              if (att.startedAt < matchStage.startedAt.$gte) return false;
            }
            return true;
          });
          const counts: Record<string, number> = {};
          matched.forEach((m: any) => {
            const sId = m.sessionId.toString();
            counts[sId] = (counts[sId] || 0) + 1;
          });
          return Object.entries(counts).map(([id, count]) => ({
            _id: new ObjectId(id),
            count,
          }));
        },
      }),
    }),
  };

  return { mockDb, dbState };
});

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => authState.user,
}));

vi.mock('@/lib/mongodb', () => ({
  default: Promise.resolve({
    db: () => mockDb,
  }),
}));

describe('Exam History GET API route integration tests', () => {
  beforeEach(() => {
    authState.user = null;
    dbState.assessments = [];
    dbState.examAttempts = [];
    dbState.sessions = [];
    dbState.questionsNonAi = [];
    dbState.questionsAi = [];
  });

  it('rejects unauthorized users with 401', async () => {
    const res = await GET(new Request('http://localhost/api/students/exam/history'));
    expect(res.status).toBe(401);
  });

  it('returns exam history with calculated interest percentages for initial assessments and practice attempts', async () => {
    const userId = new ObjectId();
    authState.user = { _id: userId };

    const q1Id = new ObjectId();
    const q2Id = new ObjectId();
    const q3Id = new ObjectId();

    // Setup questions
    dbState.questionsNonAi.push({
      _id: q1Id,
      interest: 'Reasoning & Logic',
    });
    dbState.questionsAi.push({
      _id: q2Id,
      interest: 'Coding',
    });
    dbState.questionsAi.push({
      _id: q3Id,
      interest: 'Reasoning & Logic',
    });

    // 1. Set up an initial assessment attempt
    dbState.assessments.push({
      _id: new ObjectId(),
      userId,
      status: 'completed',
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
      scorePercentage: 75,
      levelDetermined: 'Intermediate',
      questionIds: [q1Id, q2Id],
      answers: [
        { questionId: q1Id, isCorrect: true },  // Correct (Reasoning & Logic)
        { questionId: q2Id, isCorrect: false }, // Incorrect (Coding)
      ],
    });

    // 2. Set up a practice session and practice attempts
    const sessionId = new ObjectId();
    dbState.sessions.push({
      _id: sessionId,
      interests: ['Reasoning & Logic', 'Coding'],
      totalQuestionCount: 2,
    });

    dbState.examAttempts.push({
      _id: new ObjectId(),
      userId,
      sessionId,
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
      attemptNumber: 1,
      scorePercentage: 50,
      levelAchieved: 'Beginner',
      questionIds: [q2Id, q3Id],
      answers: [
        { questionId: q2Id, isCorrect: true }, // Correct (Coding: 100%)
        { questionId: q3Id, isCorrect: false }, // Incorrect (Reasoning & Logic: 0%)
      ],
    });

    const res = await GET(new Request('http://localhost/api/students/exam/history'));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Verify global interestStats sorting and calculations
    expect(body.interestStats).toBeDefined();
    // 3 answers in total across assessments + practice:
    // Reasoning & Logic: q1 (correct), q3 (incorrect) -> 50%
    // Coding: q2 (incorrect in assessment, correct in practice) -> 50%
    const codingStats = body.interestStats.find((s: any) => s.interest === 'Coding');
    const reasoningStats = body.interestStats.find((s: any) => s.interest === 'Reasoning & Logic');
    expect(codingStats.percentage).toBe(50);
    expect(reasoningStats.percentage).toBe(50);

    // Verify attempts
    expect(body.attempts).toHaveLength(2);

    // Initial assessment attempt (index 1 since sorted by completedAt desc, but let's check by type)
    const initialSession = body.attempts.find((a: any) => a.sessionType === 'initial');
    expect(initialSession).toBeDefined();
    expect(initialSession.attempts[0].interestPercentages).toBeDefined();
    expect(initialSession.attempts[0].interestPercentages['Reasoning & Logic']).toBe(100);
    expect(initialSession.attempts[0].interestPercentages['Coding']).toBe(0);

    // Practice session attempt
    const practiceSession = body.attempts.find((a: any) => a.sessionType === 'practice');
    expect(practiceSession).toBeDefined();
    expect(practiceSession.attempts[0].interestPercentages).toBeDefined();
    expect(practiceSession.attempts[0].interestPercentages['Coding']).toBe(100);
    expect(practiceSession.attempts[0].interestPercentages['Reasoning & Logic']).toBe(0);
  });
});
