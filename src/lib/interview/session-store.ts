import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { redis } from '@/lib/redis';
import type {
  CoachingReportDoc,
  InterviewQuestionDoc,
  InterviewSessionDoc,
  PooledQuestion,
} from './schemas';

export const INTERVIEW_DB = process.env.MONGODB_DB_NAME || 'aicoach';
export const INTERVIEW_COLLECTIONS = {
  sessions: 'interview_sessions',
  questions: 'interview_questions',
  reports: 'coaching_reports',
} as const;

const POOL_TTL_SECONDS = 7200;

import { getCurrentUser } from '@/lib/auth';

export async function getInterviewDb(): Promise<Db> {
  const client = await clientPromise;
  try {
    const user = await getCurrentUser();
    if (user && (user.role === 'mentor' || user.role === 'mentee')) {
      return client.db('aicoach_institutional');
    }
  } catch (err) {
    // cookies() lookup may throw during static generation / build time
  }
  return client.db(INTERVIEW_DB);
}

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export async function ensureInterviewIndexes(db: Db): Promise<void> {
  const questions = db.collection(INTERVIEW_COLLECTIONS.questions);
  await questions.createIndex({ role: 1, difficulty: 1, status: 1 });
  await questions.createIndex({ status: 1, rejected: 1 });
}

// ── interview_sessions ──────────────────────────────────────────────────────

export async function insertSession(db: Db, doc: InterviewSessionDoc): Promise<void> {
  await db.collection<InterviewSessionDoc>(INTERVIEW_COLLECTIONS.sessions).insertOne(doc);
}

export async function findSession(db: Db, sessionId: string): Promise<InterviewSessionDoc | null> {
  const _id = toObjectId(sessionId);
  if (!_id) return null;
  return db.collection<InterviewSessionDoc>(INTERVIEW_COLLECTIONS.sessions).findOne({ _id });
}

export async function updateSession(
  db: Db,
  sessionId: string,
  patch: Partial<InterviewSessionDoc>,
): Promise<void> {
  const _id = toObjectId(sessionId);
  if (!_id) return;
  await db
    .collection<InterviewSessionDoc>(INTERVIEW_COLLECTIONS.sessions)
    .updateOne({ _id }, { $set: { ...patch, updatedAt: new Date() } });
}

/**
 * List a candidate's interview sessions, most recent first, for the history view.
 * Scoped strictly to the authenticated user's own sessions (Req 21.2 — interview
 * collections only). The heavy `pool`/`turns` arrays are projected out since the
 * history list only needs lifecycle + config + report-reference fields.
 */
export async function listSessionsByUser(
  db: Db,
  userId: string,
  limit = 50,
): Promise<InterviewSessionDoc[]> {
  const _userId = toObjectId(userId);
  if (!_userId) return [];
  return db
    .collection<InterviewSessionDoc>(INTERVIEW_COLLECTIONS.sessions)
    .find(
      { userId: _userId },
      { projection: { pool: 0, turns: 0, behavioralTimeline: 0 } },
    )
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

// ── interview_questions ─────────────────────────────────────────────────────

export async function insertInterviewQuestion(
  db: Db,
  doc: Omit<InterviewQuestionDoc, '_id'>,
): Promise<ObjectId> {
  if (doc.status !== 'validated' && doc.status !== 'pending') {
    throw new Error(`invalid interview question status: ${String(doc.status)}`);
  }
  const res = await db
    .collection<InterviewQuestionDoc>(INTERVIEW_COLLECTIONS.questions)
    .insertOne(doc as InterviewQuestionDoc);
  return res.insertedId;
}

export async function findValidatedQuestions(
  db: Db,
  role: string,
  difficultyMin: number,
  difficultyMax: number,
  limit: number,
  tags?: string[],
): Promise<InterviewQuestionDoc[]> {
  const query: any = { role, status: 'validated', difficulty: { $gte: difficultyMin, $lte: difficultyMax } };
  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }
  return db
    .collection<InterviewQuestionDoc>(INTERVIEW_COLLECTIONS.questions)
    .find(query)
    .limit(limit)
    .toArray();
}

export async function findPendingPoolQuestions(
  db: Db,
  role: string,
  difficultyMin: number,
  difficultyMax: number,
  limit: number,
  tags?: string[],
): Promise<InterviewQuestionDoc[]> {
  const query: any = {
    role,
    status: 'pending',
    rejected: { $ne: true },
    difficulty: { $gte: difficultyMin, $lte: difficultyMax },
  };
  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }
  return db
    .collection<InterviewQuestionDoc>(INTERVIEW_COLLECTIONS.questions)
    .find(query)
    .limit(limit)
    .toArray();
}

export async function listPendingQuestions(db: Db): Promise<InterviewQuestionDoc[]> {
  return db
    .collection<InterviewQuestionDoc>(INTERVIEW_COLLECTIONS.questions)
    .find({ status: 'pending' })
    .sort({ createdAt: 1 })
    .toArray();
}

export async function approveQuestion(
  db: Db,
  questionId: string,
  validatedBy: ObjectId,
): Promise<boolean> {
  const _id = toObjectId(questionId);
  if (!_id) return false;
  const res = await db
    .collection<InterviewQuestionDoc>(INTERVIEW_COLLECTIONS.questions)
    .updateOne(
      { _id, status: 'pending' },
      { $set: { status: 'validated', is_validated: true, validatedAt: new Date(), validatedBy } },
    );
  return res.modifiedCount === 1;
}

// ── coaching_reports ────────────────────────────────────────────────────────

export async function createReportStub(
  db: Db,
  args: { sessionId: ObjectId; userId: ObjectId },
): Promise<ObjectId> {
  const now = new Date();
  const res = await db.collection<CoachingReportDoc>(INTERVIEW_COLLECTIONS.reports).insertOne({
    sessionId: args.sessionId,
    userId: args.userId,
    status: 'pending',
    ciScore: 0,
    categoryScores: { technicalAccuracy: 0, communication: 0, voiceCi: 0, bodyCi: 0 },
    weaknessTags: [],
    resources: [],
    behavioralTimeline: [],
    createdAt: now,
  } as unknown as CoachingReportDoc);
  return res.insertedId;
}

export async function updateReport(
  db: Db,
  reportId: string,
  patch: Partial<CoachingReportDoc>,
): Promise<void> {
  const _id = toObjectId(reportId);
  if (!_id) return;
  await db.collection<CoachingReportDoc>(INTERVIEW_COLLECTIONS.reports).updateOne({ _id }, { $set: patch });
}

export async function findReport(db: Db, reportId: string): Promise<CoachingReportDoc | null> {
  const _id = toObjectId(reportId);
  if (!_id) return null;
  return db.collection<CoachingReportDoc>(INTERVIEW_COLLECTIONS.reports).findOne({ _id });
}

// ── Redis cache (single JSON doc per session; Mongo is source of truth) ───────

export interface PoolCache {
  pool: PooledQuestion[];
  exclusion: string[];
  currentQuestionIndex: number;
  currentDifficulty: number;
}

const poolKey = (sessionId: string) => `interview:session:${sessionId}:pool`;
const reportStatusKey = (reportId: string) => `interview:report:${reportId}:status`;

export async function setPoolCache(sessionId: string, data: PoolCache): Promise<void> {
  await redis.set(poolKey(sessionId), data, POOL_TTL_SECONDS);
}

export async function getPoolCache(sessionId: string): Promise<PoolCache | null> {
  return redis.get<PoolCache>(poolKey(sessionId));
}

export async function delPoolCache(sessionId: string): Promise<void> {
  await redis.del(poolKey(sessionId));
}

export async function setReportStatusCache(
  reportId: string,
  status: CoachingReportDoc['status'],
): Promise<void> {
  await redis.set(reportStatusKey(reportId), { status }, POOL_TTL_SECONDS);
}

export async function getReportStatusCache(
  reportId: string,
): Promise<{ status: CoachingReportDoc['status'] } | null> {
  return redis.get<{ status: CoachingReportDoc['status'] }>(reportStatusKey(reportId));
}
