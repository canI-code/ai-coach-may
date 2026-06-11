import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    const mentor = await getCurrentUser();
    if (!mentor || mentor.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { menteeId, type, domain, dueDate } = body;

    if (!menteeId || !type || !domain) {
      return NextResponse.json({ error: 'Missing required assignment fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach_institutional');

    // Verify student belongs to the same college
    const student = await db.collection('users').findOne({
      _id: new ObjectId(menteeId),
      collegeName: mentor.collegeName,
      role: 'mentee'
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found or unauthorized' }, { status: 404 });
    }

    const practiceDoc = {
      mentorId: mentor._id,
      menteeId: new ObjectId(menteeId),
      type, // 'technical' | 'hr' | 'mock' | 'exam'
      domain,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdAt: new Date(),
      status: 'pending' // 'pending' | 'completed'
    };

    await db.collection('assigned_practices').insertOne(practiceDoc);

    return NextResponse.json({ message: 'Practice assigned successfully' }, { status: 201 });
  } catch (error) {
    console.error('Assign Practice Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
