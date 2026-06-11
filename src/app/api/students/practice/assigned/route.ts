import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const student = await getCurrentUser();
    if (!student || student.role !== 'mentee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach_institutional');

    const assignments = await db.collection('assigned_practices')
      .find({ menteeId: student._id })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Fetch Assigned Practices Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
