import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getInterviewDb, listPendingQuestions } from '@/lib/interview/session-store';

// Audit queue is request-time data; never cache.
export const dynamic = 'force-dynamic';

/**
 * GET /api/interview/admin/questions
 * Returns the human-audit queue: all interview questions with status='pending'.
 * (Req 8.3, 8.4)
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    // In production we would additionally check an admin role (e.g. user.role === 'admin').
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getInterviewDb();
    const pending = await listPendingQuestions(db);

    const questions = pending.map((q) => ({
      id: q._id.toString(),
      questionText: q.questionText,
      idealAnswer: q.idealAnswer,
      role: q.role,
      difficulty: q.difficulty,
      tags: q.tags,
      status: q.status,
      is_validated: q.is_validated,
      source: q.source,
      createdAt: q.createdAt,
    }));

    return NextResponse.json({ success: true, count: questions.length, questions });
  } catch (error: any) {
    console.error('Interview audit-queue list error:', error?.message);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error?.message },
      { status: 500 },
    );
  }
}
