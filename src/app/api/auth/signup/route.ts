import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, phone, password, accountType, role, fullName, dob } = await request.json();

    if (!accountType || !role || !fullName || !dob) {
      return NextResponse.json({ error: 'Missing required profile fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');

    const isB2C = role === 'student' || role === 'professional';
    
    // Validation based on user type
    if (isB2C) {
      if (!phone) return NextResponse.json({ error: 'Phone number is required for B2C' }, { status: 400 });
    } else {
      if (!email || !password) return NextResponse.json({ error: 'Email and password are required for B2B' }, { status: 400 });
    }

    // Check if user already exists
    const query = isB2C ? { phone } : { email };
    const existingUser = await db.collection('users').findOne(query);
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Prepare user document
    const userDoc: any = {
      accountType,
      role,
      fullName,
      dob,
      createdAt: new Date(),
    };

    if (isB2C) {
      userDoc.phone = phone;
      // No password for B2C
    } else {
      userDoc.email = email;
      userDoc.password = await bcrypt.hash(password, 10);
    }

    const result = await db.collection('users').insertOne(userDoc);

    // Create a simulated session for the new user
    const sessionId = 'session_initial';
    await db.collection('users').updateOne(
      { _id: result.insertedId },
      { $set: { sessions: [{ id: sessionId, createdAt: new Date() }] } }
    );

    // Set auth cookie
    const cookieStore = await cookies();
    cookieStore.set('auth_token', `token|${result.insertedId}|${sessionId}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return NextResponse.json({ 
      message: 'User created successfully', 
      userId: result.insertedId,
      role 
    }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
