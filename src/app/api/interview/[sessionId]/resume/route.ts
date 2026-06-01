/**
 * POST /api/interview/[sessionId]/resume — rebuild an interrupted session and serve the
 * question at its persisted current index (idempotent), or return the report reference
 * for a finished session.
 *
 * Task 21.1 scope (this file): authenticate via `getCurrentUser()`, delegate to the
 * Interview_Orchestrator's `resume` (which rebuilds from the persisted index/difficulty
 * in `interview_sessions`, serves the persisted index, the Turn 1 intro at index 0, and
 * the `coaching_reports` reference for a completed session), enforce the ownership
 * authorization boundary, and map typed errors to HTTP statuses per the design table.
 *
 * Next.js 16: dynamic `[sessionId]` is awaited via the generated `RouteContext`; POST
 * Route Handlers are uncached by default.
 *
 * Requirements: 2.1 (rebuild + serve persisted index), 2.5 (ownership authorization 403).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { ObjectId } from 'mongodb';

import { getCurrentUser } from '@/lib/auth';
import { findSession, getInterviewDb } from '@/lib/interview/session-store';
import { createMongoStore, isReportRef, resume, resolveResumeQuestionTags } from '@/lib/interview/orchestrator';
import type { OrchestratorError } from '@/lib/interview/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Map a typed `OrchestratorError` to its HTTP status (design error table). */
function statusForError(error: OrchestratorError): number {
  switch (error.kind) {
    case 'authorization_error':
      return 403; // Resume of a non-owned session (Req 2.5).
    case 'not_found':
      return 404;
    case 'validation_error':
      return 400;
    case 'seeding_failed':
    case 'pool_exhausted':
      return 503;
    case 'evaluation_failed':
      return 502;
    default:
      return 500;
  }
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/interview/[sessionId]/resume'>,
) {
  try {
    // 1. Authenticate — reject before any work (401).
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await ctx.params;
    const db = await getInterviewDb();
    const candidateId = String((user._id as ObjectId));

    // Update startedAt to the exact start moment if ?start=true is passed
    const url = new URL(req.url, 'http://localhost');
    if (url.searchParams.get('start') === 'true') {
      const { updateSession } = await import('@/lib/interview/session-store');
      await updateSession(db, sessionId, { startedAt: new Date() });
    }

    // 2. Resume — rebuild from persisted state, enforce ownership (Req 2.1, 2.5).
    const result = await resume(candidateId, sessionId, { store: createMongoStore(db) });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.kind },
        { status: statusForError(result.error) },
      );
    }

    // 3. A finished session resolves to its report reference; otherwise the served question.
    if (isReportRef(result.value)) {
      return NextResponse.json({ success: true, report: result.value });
    }

    // 4. Augment the served-question response with the timing fields the browser needs
    //    to drive the countdown timer (the user-facing guide for the time-boxed session).
    //    The ServedQuestion shape stays clean; timing is route-level metadata. We
    //    intentionally do NOT surface the maxQuestions cap so the candidate cannot
    //    pace themselves to the threshold (Req: time-boxed UX).
    const session = await findSession(db, sessionId);
    const startedAt = session?.startedAt ?? session?.createdAt ?? null;
    const durationMinutes = session?.config.durationMinutes ?? 0;
    const role = session?.config.role ?? '';
    const aiPersona = session?.config.aiPersona ?? 'general_recruiter';
    const tags = session ? resolveResumeQuestionTags(session) : [];

    return NextResponse.json({
      success: true,
      ...result.value,
      durationMinutes,
      startedAt: startedAt ? startedAt.toISOString() : null,
      difficulty: session?.currentDifficulty ?? session?.config.difficulty ?? 3,
      role,
      aiPersona,
      tags,
    });

  } catch (error: any) {
    console.error('Interview resume error:', error?.message);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error?.message },
      { status: 500 },
    );
  }
}
