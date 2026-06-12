import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

/**
 * B2C-only signup route.
 * B2B users are created by their institution/mentor, not via self-registration.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, role, fullName, dob } = body;

    if (!role || !fullName || !dob) {
      return NextResponse.json({ error: 'Missing required profile fields' }, { status: 400 });
    }

    // Only B2C roles allowed via self-signup
    const validRoles = ['student', 'professional'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Self-registration is only available for students and professionals. For institutional access, please contact your institution.' },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ phone });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Prepare user document (B2C only)
    const userDoc: any = {
      accountType: 'personal',
      role,
      fullName,
      dob,
      phone,
      createdAt: new Date(),
      status: 'active',
    };

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
      role,
    }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
