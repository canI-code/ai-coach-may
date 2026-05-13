import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const { collegeName, fullName, email, phone, gender, dob } = await request.json();

    if (!collegeName || !fullName || !email || !phone || !gender || !dob) {
      return NextResponse.json({ error: 'Missing required registration fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');

    // Check if user already exists in users collection (approved or pending)
    const existingUser = await db.collection('users').findOne({ 
      $or: [{ email }, { phone }] 
    });
    
    if (existingUser) {
      return NextResponse.json({ error: 'Email or Phone already in use or request pending' }, { status: 400 });
    }

    // Save mentee request in users collection with status 'pending'
    const userDoc = {
      fullName,
      email,
      phone,
      gender,
      dob,
      collegeName,
      accountType: 'institution',
      role: 'mentee',
      status: 'pending',
      loginCount: 0,
      sessions: [],
      createdAt: new Date(),
    };

    await db.collection('users').insertOne(userDoc);

    return NextResponse.json({ 
      message: 'Registration request submitted to mentor' 
    }, { status: 201 });

  } catch (error) {
    console.error('Mentee Request Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
