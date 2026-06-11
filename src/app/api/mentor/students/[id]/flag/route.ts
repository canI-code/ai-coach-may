import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const mentor = await getCurrentUser();
    if (!mentor || mentor.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { flagged } = body;

    if (flagged === undefined) {
      return NextResponse.json({ error: 'Flagged status is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach_institutional');

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id), collegeName: mentor.collegeName },
      { $set: { flagged: Boolean(flagged) } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Student not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Student flag status updated' });
  } catch (error) {
    console.error('Flag Student Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
