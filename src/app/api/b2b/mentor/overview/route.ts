import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { calculatePlacementReadiness } from '@/lib/b2b/predictor';
import { ObjectId } from 'mongodb';

/**
 * GET /api/b2b/mentor/overview
 * Returns dashboard overview stats for the logged-in mentor.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const mentorId = user._id;

    const [mentees, batches, mentorDoc] = await Promise.all([
      db.collection('users').find({ mentorId, role: 'mentee' }).toArray(),
      db.collection('batches').find({ mentorId }).toArray(),
      db.collection('users').findOne({ _id: mentorId }, { projection: { credits: 1, enabledPortals: 1, status: 1 } }),
    ]);

    const menteeIds = mentees.map(m => m._id);

    const [assessmentStats, coachingReports, examSessions] = await Promise.all([
      db.collection('user_assessment_stats').find({ userId: { $in: menteeIds } }).toArray(),
      db.collection('coaching_reports').find({ userId: { $in: menteeIds }, status: 'ready' }).sort({ createdAt: -1 }).toArray(),
      db.collection('exam_sessions').find({ userId: { $in: menteeIds } }).sort({ startedAt: -1 }).toArray()
    ]);

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
      examsByUser.get(uId)!.push({ ...es, attempts });
    });

    let overallTier1Count = 0;
    let overallTier2Count = 0;
    let overallTier3Count = 0;
    let overallInsufficientCount = 0;

    const menteeReadinessMap = new Map<string, any>();

    mentees.forEach(mentee => {
      const uId = mentee._id.toString();
      const stats = assessmentStatsMap.get(uId) || null;
      const reports = reportsByUser.get(uId) || [];
      const exams = examsByUser.get(uId) || [];

      const readiness = calculatePlacementReadiness(reports, stats, exams);
      menteeReadinessMap.set(uId, readiness);

      if (readiness.tier === 'Tier 1') overallTier1Count++;
      else if (readiness.tier === 'Tier 2') overallTier2Count++;
      else if (readiness.tier === 'Tier 3') overallTier3Count++;
      else overallInsufficientCount++;
    });

    const batchSummary = batches.map(batch => {
      const batchMentees = mentees.filter(m => m.batchId?.toString() === batch._id.toString());
      let t1 = 0, t2 = 0, t3 = 0, ins = 0;
      let totalScore = 0;
      let scoredMentees = 0;

      batchMentees.forEach(m => {
        const r = menteeReadinessMap.get(m._id.toString());
        if (r.tier === 'Tier 1') t1++;
        else if (r.tier === 'Tier 2') t2++;
        else if (r.tier === 'Tier 3') t3++;
        else ins++;

        if (r.score > 0) {
          totalScore += r.score;
          scoredMentees++;
        }
      });

      return {
        _id: batch._id,
        name: batch.name,
        department: batch.department,
        menteeCount: batchMentees.length,
        avgReadiness: scoredMentees > 0 ? Math.round(totalScore / scoredMentees) : 0,
        tiers: { tier1: t1, tier2: t2, tier3: t3, insufficient: ins }
      };
    });

    // Recent Interview Performance Trend (aggregate by date or just last 10)
    // To keep it simple for the chart, let's take the latest 10-15 reports and sort them chronologically
    const recentInterviews = coachingReports
      .slice(0, 15)
      .reverse() // chronologically
      .map(r => ({
        date: r.createdAt,
        score: r.ciScore || 0
      }));

    // Recent Exam Performance Trend
    const recentExams = examSessions
      .filter(es => es.status === 'completed' && es.result?.scorePercentage !== undefined)
      .slice(0, 15)
      .reverse() // chronologically
      .map(es => ({
        date: es.startedAt,
        score: es.result.scorePercentage || 0
      }));

    return NextResponse.json({
      stats: {
        totalMentees: mentees.length,
        activeMentees: mentees.filter(m => m.status === 'active').length,
        totalBatches: batches.length,
        creditsAllocated: mentorDoc?.credits?.allocated || 0,
        creditsUsed: mentorDoc?.credits?.used || 0,
        creditsRemaining: mentorDoc?.credits?.remaining || 0,
        enabledPortals: mentorDoc?.enabledPortals || result.institute.plan?.enabledPortals || [],
        placementReadiness: {
          tier1Count: overallTier1Count,
          tier2Count: overallTier2Count,
          tier3Count: overallTier3Count,
          insufficientCount: overallInsufficientCount
        }
      },
      batchSummary,
      trends: {
        interviews: recentInterviews,
        exams: recentExams
      },
      status: mentorDoc?.status || 'active',
      collegeName: result.institute.collegeName,
    });
  } catch (error) {
    console.error('Mentor overview error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
