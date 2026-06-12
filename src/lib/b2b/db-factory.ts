/**
 * B2B Database Factory — Creates a new isolated MongoDB database for an
 * institute with all required collections and indexes.
 */

import clientPromise from '@/lib/mongodb';
import type { Db } from 'mongodb';

/** All collections that every institute database must contain. */
const INSTITUTE_COLLECTIONS = [
  'users',
  'batches',
  'invitations',
  'credit_transactions',
  'credit_requests',
  'chat_messages',
  'interview_sessions',
  'interview_questions',
  'coaching_reports',
  'exam_sessions',
  'exam_attempts',
  'questions_ai',
  'user_profile',
  'user_assessment_stats',
] as const;

/**
 * Creates all collections and indexes for a new institute database.
 * Idempotent — safe to call multiple times.
 */
export async function createInstituteDatabase(dbName: string): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(dbName);

  // Create all collections (MongoDB creates them implicitly on first insert,
  // but explicit creation allows us to set up indexes immediately)
  for (const colName of INSTITUTE_COLLECTIONS) {
    try {
      await db.createCollection(colName);
    } catch (err: any) {
      // 48 = NamespaceExists — collection already exists, which is fine
      if (err.code !== 48) throw err;
    }
  }

  // ── Indexes ──────────────────────────────────────────────────────────────

  // users
  const users = db.collection('users');
  await users.createIndex({ email: 1 }, { unique: true, sparse: true });
  await users.createIndex({ phone: 1 }, { sparse: true });
  await users.createIndex({ role: 1 });
  await users.createIndex({ mentorId: 1 }, { sparse: true });
  await users.createIndex({ batchId: 1 }, { sparse: true });

  // batches
  const batches = db.collection('batches');
  await batches.createIndex({ mentorId: 1 });
  await batches.createIndex({ createdAt: -1 });

  // invitations
  const invitations = db.collection('invitations');
  await invitations.createIndex({ code: 1 }, { unique: true });
  await invitations.createIndex({ mentorId: 1 });
  await invitations.createIndex({ status: 1 });

  // credit_transactions
  const creditTx = db.collection('credit_transactions');
  await creditTx.createIndex({ userId: 1 });
  await creditTx.createIndex({ createdAt: -1 });

  // credit_requests
  const creditReq = db.collection('credit_requests');
  await creditReq.createIndex({ requesterId: 1 });
  await creditReq.createIndex({ status: 1 });

  // chat_messages
  const chat = db.collection('chat_messages');
  await chat.createIndex({ senderId: 1, receiverId: 1 });
  await chat.createIndex({ createdAt: -1 });

  // interview_sessions (mirrors B2C)
  const interviewSessions = db.collection('interview_sessions');
  await interviewSessions.createIndex({ userId: 1 });
  await interviewSessions.createIndex({ createdAt: -1 });

  // interview_questions (mirrors B2C)
  const interviewQuestions = db.collection('interview_questions');
  await interviewQuestions.createIndex({ role: 1, difficulty: 1, status: 1 });
  await interviewQuestions.createIndex({ status: 1, rejected: 1 });

  // coaching_reports
  const reports = db.collection('coaching_reports');
  await reports.createIndex({ sessionId: 1 });
  await reports.createIndex({ userId: 1 });

  // exam_sessions
  const examSessions = db.collection('exam_sessions');
  await examSessions.createIndex({ userId: 1 });
  await examSessions.createIndex({ status: 1 });

  // exam_attempts
  const examAttempts = db.collection('exam_attempts');
  await examAttempts.createIndex({ userId: 1 });
  await examAttempts.createIndex({ sessionId: 1 });

  // questions_ai
  const questionsAi = db.collection('questions_ai');
  await questionsAi.createIndex({ interest: 1, difficulty: 1 });
  await questionsAi.createIndex({ status: 1 });

  // user_profile
  const userProfile = db.collection('user_profile');
  await userProfile.createIndex({ userId: 1 }, { unique: true });

  // user_assessment_stats
  const assessmentStats = db.collection('user_assessment_stats');
  await assessmentStats.createIndex({ userId: 1 }, { unique: true });

  console.log(`✅ Institute database "${dbName}" created with ${INSTITUTE_COLLECTIONS.length} collections and indexes.`);
  return db;
}
