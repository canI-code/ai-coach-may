import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { getInterviewDb, INTERVIEW_COLLECTIONS } from '@/lib/interview/session-store';
import {
  computeDashboardMetrics,
  type ReportInput,
  type SessionInput,
} from '@/lib/interview/dashboard-metrics';
import type { CoachingReportDoc, InterviewSessionDoc } from '@/lib/interview/schemas';

// Per-user, request-time dashboard metrics. Never cache; always recompute for the caller.
export const dynamic = 'force-dynamic';

/** Best-effort ISO-8601 conversion for DB date values; null when missing/invalid. */
function toIso(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * GET /api/interview/dashboard
 *
 * Returns the authenticated candidate's interview dashboard metrics. Scoped strictly to
 * the caller's own sessions/reports. Maps DB docs into the pure `ReportInput`/`SessionInput`
 * shapes and delegates all aggregation to `computeDashboardMetrics` (no math in the route).
 * DB output is treated as data only.
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getInterviewDb();
    const userId = user._id;

    // Sessions: caller-scoped, newest first, heavy arrays projected out.
    const sessionDocs = await db
      .collection<InterviewSessionDoc>(INTERVIEW_COLLECTIONS.sessions)
      .find(
        { userId },
        { projection: { pool: 0, turns: 0, behavioralTimeline: 0 } },
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    // Reports: caller-scoped, only those that are ready to surface scores.
    const reportDocs = await db
      .collection<CoachingReportDoc>(INTERVIEW_COLLECTIONS.reports)
      .find(
        { userId, status: 'ready' },
        { projection: { behavioralTimeline: 0, narrative: 0 } },
      )
      .sort({ readyAt: -1 })
      .limit(100)
      .toArray();

    const sessions: SessionInput[] = sessionDocs.map((s) => ({
      sessionId: s._id.toString(),
      role: s.config?.role ?? '—',
      status: s.status,
      reportId: s.reportId ? s.reportId.toString() : null,
      createdAt: toIso(s.createdAt) ?? '',
      endedAt: toIso(s.updatedAt),
    }));

    const reports: ReportInput[] = reportDocs.map((r) => ({
      sessionId: r.sessionId.toString(),
      reportId: r._id.toString(),
      ciScore: r.ciScore,
      categoryScores: r.categoryScores,
      weaknessTags: r.weaknessTags ?? [],
      resources: (r.resources ?? []).map((res) => ({
        id: res.id,
        title: res.title,
        url: res.url,
        tags: res.tags ?? [],
      })),
      readyAt: toIso(r.readyAt),
      createdAt: toIso(r.createdAt) ?? '',
    }));

    const metrics = computeDashboardMetrics(reports, sessions, new Date(), { trendLimit: 100, recentLimit: 100 });

    return NextResponse.json({ success: true, metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Interview dashboard metrics error:', message);
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 },
    );
  }
}
