import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    const { id, status } = await request.json(); // status: 'approved' | 'disabled'
    const mentor = await getCurrentUser();
    
    if (!mentor || mentor.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach_institutional');

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id), collegeName: mentor.collegeName },
      { 
        $set: { 
          status,
          // If disabling, also clear sessions to log them out
          ...(status === 'disabled' ? { sessions: [] } : {})
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Student not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ message: `Account ${status === 'disabled' ? 'disabled' : 'enabled'} successfully` });

  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
