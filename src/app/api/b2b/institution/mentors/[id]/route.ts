import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb, removeUserFromInstitute } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

/**
 * GET /api/b2b/institution/mentors/[id]
 * Get a specific mentor's details.
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

    if (!mentor) {
      return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    }

    // Get mentee count under this mentor
    const menteeCount = await db.collection('users').countDocuments({ mentorId: new ObjectId(id), role: 'mentee' });

    return NextResponse.json({ ...mentor, menteeCount });
  } catch (error) {
    console.error('Institution get mentor error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/b2b/institution/mentors/[id]
 * Update mentor fields (credits allocation, department, status, etc.).
 */
export async function PATCH(
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

    const body = await request.json();
    const updateFields: any = {};
    const allowedFields = ['department', 'year', 'status', 'enabledPortals', 'fullName', 'email', 'phone'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'email') {
          updateFields[field] = body[field].toLowerCase();
        } else {
          updateFields[field] = body[field];
        }
      }
    }

    if (body.password) {
      const passwordHash = await bcrypt.hash(body.password, 12);
      updateFields.password = passwordHash;
      updateFields.rawPassword = body.password;
    }

    // Handle credit addition separately
    if (body.addCredits && body.addCredits > 0) {
      const instUser = await db.collection('users').findOne({ role: 'institution' });
      const remaining = instUser?.credits?.remaining || 0;
      if (remaining < body.addCredits) {
        return NextResponse.json({
          error: `Insufficient credits. You have ${remaining} remaining.`,
        }, { status: 400 });
      }

      // Deduct from institution, add to mentor
      await db.collection('users').updateOne(
        { role: 'institution' },
        { $inc: { 'credits.remaining': -body.addCredits } }
      );
      await db.collection('users').updateOne(
        { _id: new ObjectId(id), role: 'mentor' },
        { $inc: { 'credits.allocated': body.addCredits, 'credits.remaining': body.addCredits } }
      );
    }

    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      await db.collection('users').updateOne(
        { _id: new ObjectId(id), role: 'mentor' },
        { $set: updateFields }
      );
    }

    return NextResponse.json({ message: 'Mentor updated successfully' });
  } catch (error) {
    console.error('Institution update mentor error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/b2b/institution/mentors/[id]
 * Disable a mentor account (soft delete).
 */
export async function DELETE(
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

    const mentor = await db.collection('users').findOne({ _id: new ObjectId(id), role: 'mentor' });
    if (!mentor) {
      return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    }

    if (mentor.status === 'disabled') {
      await db.collection('users').deleteOne({ _id: new ObjectId(id), role: 'mentor' });
      return NextResponse.json({ message: 'Mentor account permanently deleted.' });
    } else {
      await db.collection('users').updateOne(
        { _id: new ObjectId(id), role: 'mentor' },
        { $set: { status: 'pending_delete', deleteRequestedAt: new Date() } }
      );
      return NextResponse.json({ message: 'Deletion request submitted. Pending mentor approval.' });
    }
  } catch (error) {
    console.error('Institution delete mentor error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
