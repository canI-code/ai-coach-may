import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb, removeUserFromInstitute } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';

/**
 * GET /api/b2b/mentor/mentees/[id]
 * Get a specific mentee's details.
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

    const mentee = await db.collection('users').findOne(
      { _id: new ObjectId(id), mentorId: user._id, role: 'mentee' },
      { projection: { password: 0 } }
    );

    if (!mentee) {
      return NextResponse.json({ error: 'Mentee not found' }, { status: 404 });
    }

    return NextResponse.json(mentee);
  } catch (error) {
    console.error('Mentor get mentee error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/b2b/mentor/mentees/[id]
 * Update mentee fields (credits, portal access, status).
 * Body: { addCredits?, enabledPortals?, status? }
 */
export async function PATCH(
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

    const body = await request.json();
    const updateFields: any = {};

    if (body.enabledPortals && Array.isArray(body.enabledPortals)) {
      updateFields.enabledPortals = body.enabledPortals;
    }

    if (body.status === 'active' || body.status === 'disabled') {
      updateFields.status = body.status;
    }

    // Handle credit addition
    if (body.addCredits && body.addCredits > 0) {
      const { allocateCredits } = await import('@/lib/b2b/access');
      const r = await allocateCredits(db, user._id, id, body.addCredits);
      if (!r.success) {
        return NextResponse.json({ error: r.reason }, { status: 400 });
      }
    }

    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      await db.collection('users').updateOne(
        { _id: new ObjectId(id), mentorId: user._id, role: 'mentee' },
        { $set: updateFields }
      );
    }

    return NextResponse.json({ message: 'Mentee updated successfully' });
  } catch (error) {
    console.error('Mentor update mentee error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/mentor/mentees/[id]
 * Disable a mentee account (soft delete).
 */
export async function DELETE(
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

    await db.collection('users').updateOne(
      { _id: new ObjectId(id), mentorId: user._id, role: 'mentee' },
      { $set: { status: 'disabled', disabledAt: new Date() } }
    );

    await removeUserFromInstitute(result.institute._id!.toString(), id);

    return NextResponse.json({ message: 'Mentee disabled' });
  } catch (error) {
    console.error('Mentor delete mentee error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
