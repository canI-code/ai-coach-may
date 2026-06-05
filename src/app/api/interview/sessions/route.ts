import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { getInterviewDb, INTERVIEW_COLLECTIONS } from '@/lib/interview/session-store';
import type { InterviewSessionDoc, CoachingReportDoc } from '@/lib/interview/schemas';

function getDifficultyLevel(diff: number): string {
  if (diff < 3) return 'Beginner';
  if (diff === 3) return 'Intermediate';
  if (diff === 4) return 'Advanced';
  return 'Expert';
}

// The history list is request-time, per-user data; never cache it.
export const dynamic = 'force-dynamic';

/**
 * GET /api/interview/sessions
 *
 * Returns the authenticated candidate's interview sessions (most recent first) for the
 * interview-history view. Scoped strictly to the caller's own sessions; the heavy
 * pool/turn arrays are projected out by the store helper.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const flat = searchParams.get('flat') === 'true';

    const db = await getInterviewDb();

    if (flat) {
      const sessions = await db
        .collection<InterviewSessionDoc>(INTERVIEW_COLLECTIONS.sessions)
        .aggregate([
          { $match: { userId: user._id } },
          {
            $project: {
              turnsCount: { $size: { $ifNull: ['$turns', []] } },
              userId: 1,
              status: 1,
              config: 1,
              institutionCode: 1,
              reportId: 1,
              earlyExitReason: 1,
              parentSessionId: 1,
              attemptNumber: 1,
              startedAt: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
          { $sort: { createdAt: -1 } },
        ])
        .toArray();

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
    }

    // Default: Grouped sessions
    const sessions = await db
      .collection<InterviewSessionDoc>(INTERVIEW_COLLECTIONS.sessions)
      .aggregate([
        { $match: { userId: user._id } },
        {
          $project: {
            turnsCount: { $size: { $ifNull: ['$turns', []] } },
            userId: 1,
            status: 1,
            config: 1,
            institutionCode: 1,
            reportId: 1,
            earlyExitReason: 1,
            parentSessionId: 1,
            attemptNumber: 1,
            startedAt: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
        { $sort: { createdAt: 1 } },
      ])
      .toArray();

    const reports = await db
      .collection<CoachingReportDoc>(INTERVIEW_COLLECTIONS.reports)
      .find({ userId: user._id })
      .toArray();

    const reportMap = new Map(reports.map((r) => [r.sessionId.toString(), r]));

    const groupsMap = new Map<
      string,
      {
        sessionId: string;
        role: string;
        aiPersona: string;
        durationMinutes: number;
        attempts: any[];
      }
    >();

    sessions.forEach((s) => {
      const sId = s._id.toString();
      const r = reportMap.get(sId);
      const parentIdStr = s.parentSessionId ? s.parentSessionId.toString() : null;
      const rootId = parentIdStr || sId;

      const timeTaken = s.startedAt
        ? Math.max(0, Math.round((new Date(s.updatedAt).getTime() - new Date(s.startedAt).getTime()) / 1000))
        : 0;

      const attempt = {
        attemptId: sId,
        attemptNumber: s.attemptNumber ?? 1,
        date: s.createdAt,
        ciScore: (r && r.status === 'ready') ? r.ciScore : null,
        level: getDifficultyLevel(s.config?.difficulty ?? 3),
        duration: timeTaken,
        questionCount: s.config?.questionCount ?? 0,
        questionsAnswered: s.turnsCount ?? 0,
        startingDifficulty: s.config?.difficulty ?? 3,
        status: s.status,
        reportStatus: r?.status ?? 'pending',
        durationMinutes: s.config?.durationMinutes ?? 10,
      };

      if (!groupsMap.has(rootId)) {
        groupsMap.set(rootId, {
          sessionId: rootId,
          role: s.config?.role ?? '—',
          aiPersona: s.config?.aiPersona ?? 'general_recruiter',
          durationMinutes: s.config?.durationMinutes ?? 10,
          attempts: [],
        });
      }

      groupsMap.get(rootId)!.attempts.push(attempt);
    });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const sortedGroups = Array.from(groupsMap.values()).map((group) => {
      group.attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);

      const latestAttempt = group.attempts[group.attempts.length - 1];
      const latestDate = latestAttempt ? latestAttempt.date : new Date(0);

      const retakesLast24h = group.attempts.filter(
        (a) => a.attemptNumber > 1 && new Date(a.date) >= twentyFourHoursAgo
      ).length;

      const canRetake = retakesLast24h < 2;

      return {
        ...group,
        latestDate,
        canRetake,
      };
    });

    sortedGroups.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());

    return NextResponse.json({ success: true, sessions: sortedGroups });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Interview sessions list error:', message);
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 },
    );
  }
}
