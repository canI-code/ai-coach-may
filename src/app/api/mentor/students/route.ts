import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const mentor = await getCurrentUser();
    if (!mentor || mentor.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');

    const students = await db.collection('users').find({ 
      role: 'mentee',
      status: 'approved',
      collegeName: mentor.collegeName 
    }).toArray();

    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
