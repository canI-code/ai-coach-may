import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';

/**
 * POST /api/b2b/mentor/batches/[batchId]/assign
 * Assign mentees to a batch and optionally set portal limits.
 * Body: { menteeIds: string[], enabledPortals?: string[] }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batchId } = await params;
    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    // Verify batch belongs to this mentor
    const batch = await db.collection('batches').findOne({
      _id: new ObjectId(batchId),
      mentorId: user._id,
    });
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    const { menteeIds, enabledPortals } = await request.json();

    if (!menteeIds || !Array.isArray(menteeIds) || menteeIds.length === 0) {
      return NextResponse.json({ error: 'menteeIds array is required' }, { status: 400 });
    }

    const updateFields: any = {
      batchId: new ObjectId(batchId),
      batchName: batch.name,
    };

    // Optionally override portal access for this assignment
    if (enabledPortals && Array.isArray(enabledPortals)) {
      updateFields.enabledPortals = enabledPortals;
    }

    const objectIds = menteeIds.map((id: string) => new ObjectId(id));
    const updateResult = await db.collection('users').updateMany(
      {
        _id: { $in: objectIds },
        mentorId: user._id,
        role: 'mentee',
      },
      { $set: updateFields }
    );

    return NextResponse.json({
      message: `${updateResult.modifiedCount} mentees assigned to batch "${batch.name}"`,
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error('Mentor batch assign error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
