import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
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

    const [menteeCount, activeMenteeCount, batchCount, mentorDoc] = await Promise.all([
      db.collection('users').countDocuments({ mentorId, role: 'mentee' }),
      db.collection('users').countDocuments({ mentorId, role: 'mentee', status: 'active' }),
      db.collection('batches').countDocuments({ mentorId }),
      db.collection('users').findOne({ _id: mentorId }, { projection: { credits: 1, enabledPortals: 1, status: 1 } }),
    ]);

    return NextResponse.json({
      stats: {
        totalMentees: menteeCount,
        activeMentees: activeMenteeCount,
        totalBatches: batchCount,
        creditsAllocated: mentorDoc?.credits?.allocated || 0,
        creditsUsed: mentorDoc?.credits?.used || 0,
        creditsRemaining: mentorDoc?.credits?.remaining || 0,
        enabledPortals: mentorDoc?.enabledPortals || result.institute.plan?.enabledPortals || [],
      },
      status: mentorDoc?.status || 'active',
      collegeName: result.institute.collegeName,
    });
  } catch (error) {
    console.error('Mentor overview error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
