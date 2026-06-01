import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { getInterviewDb, listSessionsByUser } from '@/lib/interview/session-store';

// The history list is request-time, per-user data; never cache it.
export const dynamic = 'force-dynamic';

/**
 * GET /api/interview/sessions
 *
 * Returns the authenticated candidate's interview sessions (most recent first) for the
 * interview-history view. Scoped strictly to the caller's own sessions; the heavy
 * pool/turn arrays are projected out by the store helper.
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getInterviewDb();
    const sessions = await listSessionsByUser(db, user._id.toString());

    const items = sessions.map((s) => ({
      sessionId: s._id.toString(),
      role: s.config?.role ?? '—',
      aiPersona: s.config?.aiPersona ?? 'general_recruiter',
      questionCount: s.config?.questionCount ?? 0,
      status: s.status,
      reportId: s.reportId ? s.reportId.toString() : null,
      earlyExitReason: s.earlyExitReason ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return NextResponse.json({ success: true, count: items.length, sessions: items });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Interview sessions list error:', message);
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 },
    );
  }
}
