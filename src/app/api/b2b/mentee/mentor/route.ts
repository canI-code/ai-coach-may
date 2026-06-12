import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';

/**
 * GET /api/b2b/mentee/mentor
 * Returns the mentee's assigned mentor info.
 */
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

    if (!user.mentorId) {
      return NextResponse.json({ error: 'No mentor assigned' }, { status: 404 });
    }

    const mentor = await db.collection('users').findOne(
      { _id: user.mentorId, role: 'mentor' },
      {
        projection: {
          password: 0,
          credits: 0, // Don't expose mentor's credits to mentee
          _id: 1,
          fullName: 1,
          email: 1,
          department: 1,
          collegeName: 1,
        },
      }
    );

    if (!mentor) {
      return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    }

    // Get unread message count
    const unreadCount = await db.collection('chat_messages').countDocuments({
      senderId: mentor._id,
      receiverId: user._id,
      read: false,
    });

    return NextResponse.json({
      mentor,
      unreadMessages: unreadCount,
      collegeName: result.institute.collegeName,
    });
  } catch (error) {
    console.error('Mentee mentor error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
