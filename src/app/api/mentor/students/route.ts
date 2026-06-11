import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mentor = await getCurrentUser();
    if (!mentor || mentor.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach_institutional');

    const students = await db.collection('users').find({ 
      role: 'mentee',
      collegeName: mentor.collegeName 
    }).toArray();

    // Aggregate sessions and CI for each student
    const aggregatedStudents = await Promise.all(students.map(async (student) => {
      // 1. Interviews count and reports
      const interviewSessionsCount = await db.collection('interview_sessions').countDocuments({ userId: student._id });
      const reports = await db.collection('coaching_reports').find({ userId: student._id, status: 'ready' }, { projection: { ciScore: 1 } }).toArray();
      const avgCi = reports.length > 0 
        ? Math.round(reports.reduce((sum, r) => sum + r.ciScore, 0) / reports.length) 
        : null;

      // 2. Exams count
      const examSessionsCount = await db.collection('exam_sessions').countDocuments({ userId: student._id });

      // 3. Get recent session timeline
      const recentInterviews = await db.collection('interview_sessions')
        .find({ userId: student._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

      const recentExams = await db.collection('exam_sessions')
        .find({ userId: student._id })
        .sort({ startedAt: -1 })
        .limit(5)
        .toArray();

      return {
        ...student,
        avgCi: avgCi !== null ? avgCi : (student.ci || 0), // fallback to mock or 0
        sessionsCount: interviewSessionsCount + examSessionsCount,
        interviewSessionsCount,
        examSessionsCount,
        recentInterviews: recentInterviews.map(i => ({
          id: i._id.toString(),
          type: i.config?.role || 'Interview',
          date: i.createdAt ? new Date(i.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
          createdAt: i.createdAt,
          status: i.status
        })),
        recentExams: recentExams.map(e => ({
          id: e._id.toString(),
          type: 'Exam',
          date: e.startedAt ? new Date(e.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
          startedAt: e.startedAt,
          status: e.status
        }))
      };
    }));

    return NextResponse.json(aggregatedStudents);
  } catch (error: any) {
    console.error('Mentor students retrieval error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
