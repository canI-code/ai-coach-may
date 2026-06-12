import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';

/**
 * GET /api/b2b/mentor/mentees
 * Lists all mentees under this mentor.
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

    const mentees = await db.collection('users').find(
      { mentorId: user._id, role: 'mentee' },
      { projection: { password: 0 } }
    ).sort({ createdAt: -1 }).toArray();

    return NextResponse.json(mentees);
  } catch (error) {
    console.error('Mentor mentees list error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
