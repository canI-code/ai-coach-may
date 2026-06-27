import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';
import { calculatePlacementReadiness } from '@/lib/b2b/predictor';

/**
 * GET /api/b2b/mentor/batches/[batchId]/mentees
 * Returns the list of mentees in this batch with details and placement readiness scores.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batchId } = await params;
    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const batch = await db.collection('batches').findOne({ _id: new ObjectId(batchId) });
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Verify batch belongs to mentor
    if (batch.mentorId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all mentees in this batch
    const mentees = await db.collection('users').find({
      role: 'mentee',
      $or: [
        { batchId: batch._id },
        { batchIds: batch._id }
      ]
    }).toArray();

    const menteeIds = mentees.map(m => m._id);

    // Bulk query profiles, assessment stats, coaching reports, and exam sessions
    const profiles = await db.collection('user_profile').find({ userId: { $in: menteeIds } }).toArray();
    const assessmentStats = await db.collection('user_assessment_stats').find({ userId: { $in: menteeIds } }).toArray();
    const coachingReports = await db.collection('coaching_reports').find({ userId: { $in: menteeIds }, status: 'ready' }).toArray();
    const examSessions = await db.collection('exam_sessions').find({ userId: { $in: menteeIds } }).toArray();

    const examSessionIds = examSessions.map(es => es._id);
    const examAttempts = examSessionIds.length > 0
      ? await db.collection('exam_attempts').find({ sessionId: { $in: examSessionIds }, completedAt: { $exists: true } }).toArray()
      : [];

    const profilesMap = new Map(profiles.map(p => [p.userId.toString(), p]));
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

    const responseData = mentees.map(mentee => {
      const uId = mentee._id.toString();
      const profile: any = profilesMap.get(uId) || {};
      const stats = assessmentStatsMap.get(uId) || null;
      const reports = reportsByUser.get(uId) || [];
      const exams = examsByUser.get(uId) || [];

      const readiness = calculatePlacementReadiness(reports, stats, exams);
      const sessionCount = reports.length + exams.length;

      // Extract lightweight history for the slide-over timeline
      const history = {
        interviews: reports.map(r => ({
          _id: r._id.toString(),
          role: r.jobRole || 'Mock Interview',
          score: Math.round(r.ciScore || 0),
          date: r.createdAt
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
        exams: exams.map(e => {
          let score = 0;
          if (e.attempts && e.attempts.length > 0) {
            score = e.attempts.reduce((sum: number, att: any) => sum + (att.scorePercentage || 0), 0) / e.attempts.length;
          }
          return {
            _id: e._id.toString(),
            title: 'Assessment',
            score: Math.round(score),
            date: e.createdAt
          };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)
      };

      return {
        _id: mentee._id,
        email: mentee.email,
        fullName: mentee.fullName || profile.fullName || 'Mentee',
        credits: mentee.credits || { allocated: 0, used: 0, remaining: 0 },
        sessionCount,
        readiness,
        history,
        profile: {
          degree: profile.education?.degree || 'N/A',
          course: profile.education?.course || 'N/A',
          interests: profile.interests || []
        }
      };
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Batch mentees route error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
