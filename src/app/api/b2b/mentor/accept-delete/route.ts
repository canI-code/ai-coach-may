import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb, removeUserFromInstitute } from '@/lib/b2b/registry';

/**
 * POST /api/b2b/mentor/accept-delete
 * Allows a mentor to accept a pending deletion request.
 * Returns their remaining credits to the institution and disables their account.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) {
      return NextResponse.json({ error: 'Institution not found' }, { status: 404 });
    }

    const db = await getInstituteDb(result.institute._id!);
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Retrieve current mentor info
    const mentor = await db.collection('users').findOne({ _id: user._id, role: 'mentor' });
    if (!mentor) {
      return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    }

    if (mentor.status !== 'pending_delete') {
      return NextResponse.json({ error: 'No deletion request pending for this account' }, { status: 400 });
    }

    const remainingCredits = mentor.credits?.remaining || 0;

    // Refund credits to the institution if any remain
    if (remainingCredits > 0) {
      await db.collection('users').updateOne(
        { role: 'institution' },
        { $inc: { 'credits.remaining': remainingCredits } }
      );
    }

    // Update mentor status and credits
    await db.collection('users').updateOne(
      { _id: user._id, role: 'mentor' },
      {
        $set: {
          status: 'disabled',
          disabledAt: new Date(),
          'credits.remaining': 0,
          'credits.allocated': mentor.credits?.used || 0,
        }
      }
    );

    // Remove mentor from registry userLookup so they cannot log in anymore
    await removeUserFromInstitute(result.institute._id!.toString(), user._id.toString());

    return NextResponse.json({
      message: 'Deletion accepted. Account has been deactivated and credits returned to institution.'
    });
  } catch (error) {
    console.error('Accept delete error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
