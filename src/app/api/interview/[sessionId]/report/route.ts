import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import {
  findReport,
  findSession,
  getInterviewDb,
  getReportStatusCache,
} from '@/lib/interview/session-store';
import { buildPerTurnHistory, compileStrengthsImprovements } from '@/lib/dashboard-suite/per-turn';

// The report endpoint is polled until the background compilation finishes, so it must
// always return request-time data and is never cached (Req 16.7).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/interview/[sessionId]/report
 *
 * Poll a session's Confidence Index report (Req 16.7). The background Report_Orchestrator
 * (scheduled by POST /end via `after()`) flips the status from `pending` to `ready` once
 * compilation and persistence succeed (or `failed` on a persistence error):
 *
 *  1. Auth (401) + ownership (403) + session existence (404).
 *  2. Resolve the linked `coaching_reports` id; 404 while none is linked yet (end not
 *     called) so the client keeps polling after triggering /end.
 *  3. Status is read from the fast Redis status mirror first, falling back to the
 *     authoritative `coaching_reports` document.
 *  4. While `pending`/`failed`, return only `{ reportId, status }` (poll again). When
 *     `ready`, return the full report payload (CI score, category scores, weakness tags,
 *     resources, narrative, behavioral timeline).
 *
 * Uses the Next.js 16 async `RouteContext` params; the handler opts out of caching so
 * each poll observes fresh status.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/interview/[sessionId]/report'>,
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

    // Load the session and enforce ownership before exposing any report data.
    const session = await findSession(db, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (session.userId.toHexString() !== userId) {
      return NextResponse.json({ error: 'authorization_error' }, { status: 403 });
    }

    // 2. No report linked yet — /end hasn't created the stub. The client should poll.
    if (!session.reportId) {
      return NextResponse.json(
        { error: 'not_found', message: 'report not requested yet' },
        { status: 404 },
      );
    }
    const reportId = session.reportId.toHexString();

    // 3. Fast status check via the Redis mirror; fall back to the report document.
    const cached = await getReportStatusCache(reportId);
    const report = await findReport(db, reportId);

    if (!report) {
      // Status cache may exist transiently before the doc is readable; report pending.
      return NextResponse.json({ reportId, status: cached?.status ?? 'pending' });
    }

    const status = cached?.status ?? report.status;

    // 4a. Still compiling (or failed) — return the pollable status only.
    if (status !== 'ready') {
      return NextResponse.json({ reportId, status });
    }

    // 4b. Ready — return the full report payload.
    const start = session.startedAt || session.createdAt || new Date();
    const end = session.updatedAt || new Date();
    const durationSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));

    const perTurnHistory = buildPerTurnHistory(session.turns || []);
    const { strengths, improvements } = compileStrengthsImprovements(session.turns || []);

    return NextResponse.json({
      reportId,
      status: 'ready',
      report: {
        sessionId: report.sessionId.toHexString(),
        ciScore: report.ciScore,
        categoryScores: report.categoryScores,
        weaknessTags: report.weaknessTags,
        resources: report.resources,
        narrative: report.narrative ?? null,
        behavioralTimeline: report.behavioralTimeline,
        readyAt: report.readyAt ?? null,
        durationSeconds,
        questionsAnswered: session.turns ? session.turns.length : 0,
        totalQuestions: session.config.questionCount,
        perTurnHistory,
        strengths,
        improvements,
        role: session.config.role,
        aiPersona: session.config.aiPersona,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Interview report poll error:', message);
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 },
    );
  }
}

