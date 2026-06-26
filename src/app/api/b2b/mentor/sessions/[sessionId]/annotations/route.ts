import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const result = await findInstituteByUserId(user._id.toString());
    if (!result) {
      return NextResponse.json({ error: 'Institute not found' }, { status: 404 });
    }

    const db = await getInstituteDb(result.institute._id!);
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    let sessionOid;
    try {
      sessionOid = new ObjectId(sessionId);
    } catch {
      return NextResponse.json({ error: 'Invalid Session ID' }, { status: 400 });
    }

    const session = await db.collection('interview_sessions').findOne({ _id: sessionOid });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Ensure student belongs to one of this mentor's batches
    const student = await db.collection('users').findOne({ _id: session.userId });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const mentorBatches = await db.collection('batches').find({ mentorId: user._id }).toArray();
    const mentorBatchIds = mentorBatches.map(b => b._id.toString());

    const studentBatchIds: string[] = [];
    if (student.batchId) {
      studentBatchIds.push(student.batchId.toString());
    }
    if (Array.isArray(student.batchIds)) {
      student.batchIds.forEach((id: any) => studentBatchIds.push(id.toString()));
    }

    const belongsToMentorBatch = studentBatchIds.some(id => mentorBatchIds.includes(id));
    if (!belongsToMentorBatch) {
      return NextResponse.json({ error: 'Forbidden: Student is not in any of your batches' }, { status: 403 });
    }

    let payload: any;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { annotations, generalFeedback } = payload;

    // Validate annotations format
    if (annotations !== undefined && annotations !== null) {
      if (!Array.isArray(annotations)) {
        return NextResponse.json({ error: 'Annotations must be an array' }, { status: 400 });
      }
      for (const ann of annotations) {
        if (
          typeof ann.questionIndex !== 'number' ||
          typeof ann.tSeconds !== 'number' ||
          ann.tSeconds < 0 ||
          typeof ann.feedback !== 'string'
        ) {
          return NextResponse.json({ error: 'Invalid annotation object structure' }, { status: 400 });
        }
      }
    }

    // Upsert annotation document into mentor_annotations collection
    await db.collection('mentor_annotations').updateOne(
      { sessionId: sessionOid },
      {
        $set: {
          sessionId: sessionOid,
          mentorId: user._id,
          annotations: annotations || [],
          generalFeedback: generalFeedback || '',
          updatedAt: new Date(),
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mentor session annotations upsert error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
