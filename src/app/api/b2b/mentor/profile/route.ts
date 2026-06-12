import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';

/**
 * GET /api/b2b/mentor/profile
 * Returns the mentor's profile info.
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

    const mentor = await db.collection('users').findOne(
      { _id: user._id },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      ...mentor,
      collegeName: result.institute.collegeName,
      institutePlan: {
        enabledPortals: result.institute.plan?.enabledPortals || [],
      },
    });
  } catch (error) {
    console.error('Mentor profile error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
