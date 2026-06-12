import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';

/**
 * GET /api/b2b/institution/mentor-overview/[id]
 * Returns a specific mentor's stats: mentee count, credits, batches, portal usage.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'institution') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const mentor = await db.collection('users').findOne(
      { _id: new ObjectId(id), role: 'mentor' },
      { projection: { password: 0 } }
    );
    if (!mentor) return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });

    // Get mentees under this mentor
    const mentees = await db.collection('users').find(
      { mentorId: new ObjectId(id), role: 'mentee' },
      { projection: { password: 0, _id: 1, fullName: 1, email: 1, credits: 1, status: 1, createdAt: 1 } }
    ).toArray();

    // Get batches
    const batches = await db.collection('batches').find(
      { mentorId: new ObjectId(id) }
    ).toArray();

    // Get recent credit transactions
    const transactions = await db.collection('credit_transactions').find(
      { $or: [{ userId: new ObjectId(id) }, { sourceUserId: new ObjectId(id) }, { targetUserId: new ObjectId(id) }] }
    ).sort({ createdAt: -1 }).limit(20).toArray();

    return NextResponse.json({
      mentor,
      mentees,
      batches,
      transactions,
      stats: {
        totalMentees: mentees.length,
        activeMentees: mentees.filter(m => m.status !== 'disabled').length,
        creditsAllocated: mentor.credits?.allocated || 0,
        creditsUsed: mentor.credits?.used || 0,
        creditsRemaining: mentor.credits?.remaining || 0,
      },
    });
  } catch (error) {
    console.error('Institution mentor overview error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
