import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const student = await getCurrentUser();
    if (!student || student.role !== 'mentee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach_institutional');

    const mentor = await db.collection('users').findOne(
      { role: 'mentor', collegeName: student.collegeName },
      { projection: { fullName: 1, email: 1 } }
    );

    if (!mentor) {
      return NextResponse.json({ error: 'Mentor not found for this institution' }, { status: 404 });
    }

    return NextResponse.json(mentor);
  } catch (error: any) {
    console.error('Fetch mentor info error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
