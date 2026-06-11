import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db('aicoach');

    const institution = await db.collection('institutions').findOne({ _id: new ObjectId(id) });

    if (!institution) {
      return NextResponse.json({ error: 'Institution not found' }, { status: 404 });
    }

    if (institution.status === 'approved') {
      return NextResponse.json({ error: 'Already approved' }, { status: 400 });
    }

    // 1. Update institution status
    await db.collection('institutions').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'approved', approvedAt: new Date() } }
    );

    // 2. Create Mentor User in institutional database
    await client.db('aicoach_institutional').collection('users').insertOne({
      email: institution.mentorEmail,
      password: institution.password,
      phone: institution.mentorPhone,
      accountType: 'institution',
      role: 'mentor',
      fullName: institution.mentorName, // Used the registered mentor name
      dob: institution.mentorDob,
      gender: institution.mentorGender,
      collegeName: institution.collegeName,
      institutionId: institution._id,
      createdAt: new Date(),
    });

    return NextResponse.json({ message: 'Institution approved and Mentor user created' });

  } catch (error) {
    console.error('Approval Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
