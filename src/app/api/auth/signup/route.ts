import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, phone, password, accountType, role, fullName, dob, inviteCode } = body;

    if (!accountType || !role || !fullName || !dob) {
      return NextResponse.json({ error: 'Missing required profile fields' }, { status: 400 });
    }

    const client = await clientPromise;
    let db = client.db('aicoach');

    const isB2C = role === 'student' || role === 'professional';
    let collegeName = '';
    let invite: any = null;

    // B2B Mentee Invite Code validation
    if (role === 'mentee') {
      if (!inviteCode) {
        return NextResponse.json({ error: 'Invite code is required for direct B2B registration' }, { status: 400 });
      }

      // Check invitations in institutional database
      invite = await client.db('aicoach_institutional').collection('invitations').findOne({
        code: inviteCode,
        status: 'active'
      });

      if (!invite) {
        return NextResponse.json({ error: 'Invalid or inactive invite code' }, { status: 400 });
      }

      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 });
      }

      if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
        return NextResponse.json({ error: 'Invite code usage limit reached' }, { status: 400 });
      }

      collegeName = invite.collegeName;
      db = client.db('aicoach_institutional');
    }

    // Validation based on user type
    if (isB2C) {
      if (!phone) return NextResponse.json({ error: 'Phone number is required for B2C' }, { status: 400 });
    } else {
      if (!email || !password) return NextResponse.json({ error: 'Email and password are required for B2B' }, { status: 400 });
    }

    // Check if user already exists in target DB
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
      status: role === 'mentee' ? 'approved' : 'active'
    };

    if (role === 'mentee') {
      userDoc.collegeName = collegeName;
      userDoc.gender = body.gender;
      userDoc.phone = phone;
      userDoc.inviteCode = inviteCode;
      userDoc.accessLimit = { interviewsCount: 10, examsCount: 10, expiresAt: null }; // default limit
      userDoc.usage = { interviewsCompleted: 0, examsCompleted: 0 };
      userDoc.degree = invite.degree || '';
      userDoc.subject = invite.subject || '';
      userDoc.year = invite.year || null;
    }

    if (isB2C) {
      userDoc.phone = phone;
    } else {
      userDoc.email = email;
      userDoc.password = await bcrypt.hash(password, 10);
    }

    const result = await db.collection('users').insertOne(userDoc);

    // If mentee, increment invitation useCount
    if (role === 'mentee') {
      await client.db('aicoach_institutional').collection('invitations').updateOne(
        { code: inviteCode },
        { $inc: { useCount: 1 } }
      );
    }

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
