import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    // Fetch user from institute DB to get latest batchIds
    const mentee = await db.collection('users').findOne({ _id: user._id });
    if (!mentee) return NextResponse.json({ error: 'Mentee not found' }, { status: 404 });

    const batchIds = mentee.batchIds || (mentee.batchId ? [mentee.batchId] : []);
    if (batchIds.length === 0) {
      return NextResponse.json([]);
    }

    const batches = await db.collection('batches').find({
      _id: { $in: batchIds.map((id: any) => new ObjectId(id)) }
    }).toArray();

    const batchesWithPerformance = await Promise.all(
      batches.map(async (batch) => {
        // Fetch mentor details
        const mentor = await db.collection('users').findOne(
          { _id: batch.mentorId },
          { projection: { fullName: 1, email: 1 } }
        );

        // Fetch all mentees in this batch to compute overall health
        const batchMentees = await db.collection('users').find({
          role: 'mentee',
          $or: [
            { batchId: batch._id },
            { batchIds: batch._id }
          ]
        }, { projection: { _id: 1 } }).toArray();

        const batchMenteeIds = batchMentees.map(bm => bm._id);

        let overallHealth = null;
        if (batchMenteeIds.length > 0) {
          const stats = await db.collection('user_assessment_stats').find({ userId: { $in: batchMenteeIds } }).toArray();
          const reports = await db.collection('coaching_reports').find({ userId: { $in: batchMenteeIds } }).toArray();

          const avgAssessmentScore = stats.length > 0 ? stats.reduce((sum: number, s: any) => sum + (s.scorePercentage || 0), 0) / stats.length : 0;
          const avgConfidenceIndex = reports.length > 0 ? reports.reduce((sum: number, r: any) => sum + (r.confidenceIndex || r.overallScore || 0), 0) / reports.length : 0;

          if (stats.length > 0 && reports.length > 0) {
            overallHealth = Math.round((avgAssessmentScore + avgConfidenceIndex) / 2);
          } else if (stats.length > 0) {
            overallHealth = Math.round(avgAssessmentScore);
          } else if (reports.length > 0) {
            overallHealth = Math.round(avgConfidenceIndex);
          }
        }

        // Fetch current mentee's individual performance scoped to this batch
        // 1. Interview stats
        const menteeReports = await db.collection('coaching_reports').find({
          userId: user._id,
          batchId: batch._id,
          status: 'ready'
        }).toArray();
        const personalCi = menteeReports.length > 0
          ? Math.round(menteeReports.reduce((sum: number, r: any) => sum + r.ciScore, 0) / menteeReports.length)
          : null;

        const totalInterviews = await db.collection('interview_sessions').countDocuments({
          userId: user._id,
          batchId: batch._id
        });

        // 2. Exam stats
        const menteeAttempts = await db.collection('exam_attempts').find({
          userId: user._id,
          batchId: batch._id,
          completedAt: { $exists: true }
        }).toArray();
        const personalExamScore = menteeAttempts.length > 0
          ? Math.round(menteeAttempts.reduce((sum: number, a: any) => sum + a.scorePercentage, 0) / menteeAttempts.length)
          : null;

        const totalExams = await db.collection('exam_sessions').countDocuments({
          userId: user._id,
          batchId: batch._id
        });

        return {
          _id: batch._id,
          name: batch.name,
          department: batch.department,
          year: batch.year,
          mentorName: mentor?.fullName || 'Unassigned',
          mentorEmail: mentor?.email || 'N/A',
          overallHealth,
          personalStats: {
            ciScore: personalCi,
            examScore: personalExamScore,
            totalInterviews,
            totalExams
          },
          isActive: mentee.batchId && mentee.batchId.toString() === batch._id.toString()
        };
      })
    );

    return NextResponse.json(batchesWithPerformance);
  } catch (error) {
    console.error('Mentee batches GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
