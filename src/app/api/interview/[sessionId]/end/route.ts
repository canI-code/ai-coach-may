import { NextResponse, after } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { canTransition } from '@/lib/interview/orchestrator';
import { runReportJob } from '@/lib/interview/report';
import {
  createReportStub,
  findSession,
  getInterviewDb,
  updateSession,
} from '@/lib/interview/session-store';

// Ending a session authenticates the caller and mutates `interview_sessions` at
// request time, so the handler must always run dynamically and is never cached.
export const dynamic = 'force-dynamic';

/**
 * POST /api/interview/[sessionId]/end
 *
 * Mark a session `completed` and kick off background report compilation:
 *
 *  1. Auth (401) + ownership (403) + session existence (404).
 *  2. Read the optional early-exit `reason` from the JSON body. Reaching the configured
 *     question_count is a natural completion (no reason); an explicit early exit records
 *     the reason on the session (Req 1.5, 1.6).
 *  3. Create a `coaching_reports` stub with `status:'pending'` and link it to the session,
 *     then transition the session to `completed` (forward-only lifecycle — Req 1.5/1.6).
 *  4. Schedule `runReportJob(db, sessionId)` via `after()` so the Report_Orchestrator
 *     compiles the Confidence Index report after the response is flushed and even if the
 *     client disconnects (Req 16.1, 19.1) — never blocking the response.
 *  5. Respond immediately with the pollable `{ reportId, status:'pending' }`.
 *
 * Idempotent: a session already `completed` returns its existing report reference without
 * creating a second stub or rescheduling compilation.
 *
 * Uses the Next.js 16 async `RouteContext` params and the stable `after()` API.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/interview/[sessionId]/end'>,
) {
  try {
    // 1. Authenticate — reject before any work (design error table → 401).
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await ctx.params;
    const userId = user._id.toString();

    const db = await getInterviewDb();

    // Load the session and enforce ownership before any state change.
    const session = await findSession(db, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (session.userId.toHexString() !== userId) {
      return NextResponse.json({ error: 'authorization_error' }, { status: 403 });
    }

    // Idempotent end: an already-completed session returns its existing report ref.
    if (session.status === 'completed') {
      if (session.reportId) {
        return NextResponse.json({ reportId: session.reportId.toHexString(), status: 'pending' });
      }
      // Completed without a linked report (e.g. an interrupted prior end) — create the
      // stub and (re)schedule compilation so the report still becomes available.
      const reportObjectId = await createReportStub(db, {
        sessionId: session._id,
        userId: session.userId,
      });
      await updateSession(db, sessionId, { reportId: reportObjectId });
      after(() => runReportJob(db, sessionId));
      return NextResponse.json({ reportId: reportObjectId.toHexString(), status: 'pending' });
    }

    // Only an `active` session can be completed (forward-only lifecycle — Req 1.5/1.6).
    if (!canTransition(session.status, 'completed')) {
      return NextResponse.json(
        { error: 'invalid_state', message: `cannot end session in status '${session.status}'` },
        { status: 409 },
      );
    }

    // 2. Optional early-exit reason (Req 1.6). Body may be empty or absent.
    let reason: string | undefined;
    try {
      const body = (await req.json()) as { reason?: unknown } | null;
      if (body && typeof body.reason === 'string' && body.reason.trim()) {
        reason = body.reason.trim();
      }
    } catch {
      // No/invalid JSON body — treated as a natural completion with no early-exit reason.
    }

    // 3. Create the report stub {status:pending} and link it, then mark completed.
    const reportObjectId = await createReportStub(db, {
      sessionId: session._id,
      userId: session.userId,
    });

    await updateSession(db, sessionId, {
      status: 'completed',
      reportId: reportObjectId,
      ...(reason ? { earlyExitReason: reason } : {}),
    });

    // 4. Compile the report in the background after the response is flushed (Req 16.1).
    after(() => runReportJob(db, sessionId));

    // 5. Pollable response — the client polls GET /report until status:'ready'.
    return NextResponse.json({ reportId: reportObjectId.toHexString(), status: 'pending' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Interview end error:', message);
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 },
    );
  }
}
