import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';

/**
 * GET /api/b2b/mentor/mentees/[id]/track
 * Returns a mentee's session history (interviews + exams) for the mentor to track progress.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    // Verify this mentee belongs to this mentor
    const mentee = await db.collection('users').findOne(
      { _id: new ObjectId(id), mentorId: user._id, role: 'mentee' },
      { projection: { password: 0, fullName: 1, email: 1, credits: 1, status: 1 } }
    );
    if (!mentee) return NextResponse.json({ error: 'Mentee not found' }, { status: 404 });

    // Get interview sessions
    const interviews = await db.collection('interview_sessions').find(
      { userId: new ObjectId(id) },
      { projection: { type: 1, subject: 1, status: 1, startedAt: 1, completedAt: 1, score: 1 } }
    ).sort({ startedAt: -1 }).limit(50).toArray();

    // Get exam sessions
    const exams = await db.collection('assessment_sessions').find(
      { userId: new ObjectId(id) },
      { projection: { subject: 1, status: 1, startedAt: 1, completedAt: 1, finalScore: 1, totalQuestions: 1 } }
    ).sort({ startedAt: -1 }).limit(50).toArray();

    // Get credit usage
    const creditHistory = await db.collection('credit_transactions').find(
      { userId: new ObjectId(id) }
    ).sort({ createdAt: -1 }).limit(20).toArray();

    return NextResponse.json({
      mentee,
      interviews,
      exams,
      creditHistory,
      stats: {
        totalInterviews: interviews.length,
        completedInterviews: interviews.filter(i => i.status === 'completed').length,
        totalExams: exams.length,
        completedExams: exams.filter(e => e.status === 'completed').length,
      },
    });
  } catch (error) {
    console.error('Mentor track mentee error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
