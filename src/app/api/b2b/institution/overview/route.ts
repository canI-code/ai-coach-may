import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { calculatePlacementReadiness } from '@/lib/b2b/predictor';

/**
 * GET /api/b2b/institution/overview
 * Returns dashboard overview stats: total mentors, mentees, credits used/remaining, recent activity.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'institution') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) {
      return NextResponse.json({ error: 'Institute not found' }, { status: 404 });
    }

    const { institute } = result;
    const db = await getInstituteDb(institute._id!);
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Aggregate stats
    const [allUsers, recentSessions] = await Promise.all([
      db.collection('users').find().toArray(),
      db.collection('credit_transactions').find()
        .sort({ createdAt: -1 }).limit(10).toArray(),
    ]);

    const mentorCount = allUsers.filter(u => u.role === 'mentor').length;
    const mentees = allUsers.filter(u => u.role === 'mentee');
    const menteeCount = mentees.length;
    const menteeIds = mentees.map(m => m._id);
    
    // Sum used credits across all users (mentees)
    const actualCreditsUsed = allUsers.reduce((sum, u) => sum + (u.credits?.used || 0), 0);

    // Bulk query stats, coaching reports, and exam sessions + attempts
    const assessmentStats = await db.collection('user_assessment_stats').find({ userId: { $in: menteeIds } }).toArray();
    const coachingReports = await db.collection('coaching_reports').find({ userId: { $in: menteeIds }, status: 'ready' }).toArray();
    const examSessions = await db.collection('exam_sessions').find({ userId: { $in: menteeIds } }).toArray();

    const examSessionIds = examSessions.map(es => es._id);
    const examAttempts = examSessionIds.length > 0
      ? await db.collection('exam_attempts').find({ sessionId: { $in: examSessionIds }, completedAt: { $exists: true } }).toArray()
      : [];

    const assessmentStatsMap = new Map(assessmentStats.map(s => [s.userId.toString(), s]));

    const reportsByUser = new Map<string, any[]>();
    coachingReports.forEach(r => {
      const uId = r.userId.toString();
      if (!reportsByUser.has(uId)) reportsByUser.set(uId, []);
      reportsByUser.get(uId)!.push(r);
    });

    const examsByUser = new Map<string, any[]>();
    examSessions.forEach(es => {
      const uId = es.userId.toString();
      if (!examsByUser.has(uId)) examsByUser.set(uId, []);

      const attempts = examAttempts.filter(a => a.sessionId.toString() === es._id.toString());
      examsByUser.get(uId)!.push({
        ...es,
        attempts
      });
    });

    let tier1Count = 0;
    let tier2Count = 0;
    let tier3Count = 0;
    let insufficientCount = 0;

    mentees.forEach(mentee => {
      const uId = mentee._id.toString();
      const stats = assessmentStatsMap.get(uId) || null;
      const reports = reportsByUser.get(uId) || [];
      const exams = examsByUser.get(uId) || [];

      const readiness = calculatePlacementReadiness(reports, stats, exams);
      if (readiness.tier === 'Tier 1') {
        tier1Count++;
      } else if (readiness.tier === 'Tier 2') {
        tier2Count++;
      } else if (readiness.tier === 'Tier 3') {
        tier3Count++;
      } else {
        insufficientCount++;
      }
    });

    return NextResponse.json({
      stats: {
        totalMentors: mentorCount,
        totalMentees: menteeCount,
        creditsTotal: institute.plan?.totalCredits || 0,
        creditsUsed: actualCreditsUsed,
        creditsRemaining: (institute.plan?.totalCredits || 0) - actualCreditsUsed,
        enabledPortals: institute.plan?.enabledPortals || [],
        expiresAt: institute.plan?.expiresAt,
        placementReadiness: {
          tier1Count,
          tier2Count,
          tier3Count,
          insufficientCount
        }
      },
      recentActivity: recentSessions.map(s => ({
        type: s.type,
        amount: s.amount,
        reason: s.reason,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('Institution overview error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
