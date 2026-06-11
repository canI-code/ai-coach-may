import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, phone, password, role, validateOnly } = await request.json();

    const client = await clientPromise;
    const isB2C = role === 'student' || role === 'professional';
    const isB2B = role === 'mentor' || role === 'mentee';
    const db = client.db(isB2B ? 'aicoach_institutional' : 'aicoach');
    const otpsCollection = client.db('aicoach').collection('otps');
    let user;

    if (isB2C) {
      if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
      user = await db.collection('users').findOne({ phone });
    } else {
      if (!email || !password) return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
      user = await db.collection('users').findOne({ email });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let recovered = false;
    if (user.deletionScheduled) {
      const deletionScheduledAt = new Date(user.deletionScheduledAt);
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - deletionScheduledAt.getTime() > thirtyDaysMs) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      recovered = true;
    }

    // Status and Role Checks
    if (user.role === 'mentee') {
      if (user.status === 'pending') return NextResponse.json({ error: 'Account pending mentor approval' }, { status: 403 });
      if (user.status === 'disabled') return NextResponse.json({ error: 'Account disabled by mentor' }, { status: 403 });
    }

    // Check Password (B2B only)
    if (!isB2C) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    }

// Step 1: Validate Only (for Mentor/Mentee to trigger OTP)
    if (validateOnly) {
      return NextResponse.json({ message: 'Credentials valid', user: { phone: user.phone } });
    }

    // Step 2: Final Login - Must verify OTP first
    if (!validateOnly) {
      // Determine the identifier used for OTP
      const otpIdentifier = isB2C ? phone : user.phone;

      if (!otpIdentifier) {
        return NextResponse.json({ error: 'Verification identifier (phone) not found' }, { status: 400 });
      }

      const otpRecord = await otpsCollection.findOne({ identifier: otpIdentifier });
      
      if (!otpRecord) {
        return NextResponse.json({ error: 'OTP not verified. Please request a new OTP.' }, { status: 400 });
      }
      
      if (!otpRecord.verified) {
        return NextResponse.json({ error: 'OTP not verified. Please verify your OTP first.' }, { status: 400 });
      }
      
      // Check if OTP was verified within last 5 minutes
      const verifiedAt = otpRecord.verifiedAt ? new Date(otpRecord.verifiedAt) : null;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      if (!verifiedAt || verifiedAt < fiveMinutesAgo) {
        return NextResponse.json({ error: 'OTP verification expired. Please verify again.' }, { status: 400 });
      }
      
      // OTP verified! Clean up the OTP record
      await otpsCollection.deleteOne({ identifier: otpIdentifier });
    }

    const sessionId = 'session_' + Math.random().toString(36).substring(7);
    const userAgent = request.headers.get('user-agent') || 'Unknown Device';

    // Update Logic
    const updateData: any = {
      $push: { sessions: { id: sessionId, createdAt: new Date() } },
      $set: { 
        lastLogin: new Date(),
        lastDevice: userAgent
      },
      $inc: { loginCount: 1 }
    };

    // Device Limit (Mentor) - Session Rotation
    if (role === 'mentor') {
      const activeSessions = user.sessions || [];
      if (activeSessions.length >= 3) {
        // Keep the newest 2 and add the new one
        const rotatedSessions = activeSessions.slice(-2);
        updateData.$set.sessions = [...rotatedSessions, { id: sessionId, createdAt: new Date() }];
        delete updateData.$push;
      }
    }

    // Single Device Enforcement for Mentee (B2B Student)
    if (user.role === 'mentee') {
      updateData.$set.sessions = [{ id: sessionId, createdAt: new Date() }];
      delete updateData.$push; // Overwrite push with single array
    }

    if (recovered) {
      updateData.$unset = { deletionScheduled: "", deletionScheduledAt: "" };
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      updateData as any
    );

    const cookieStore = await cookies();
    cookieStore.set('auth_token', `token|${user._id}|${sessionId}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    const { password: _, sessions: __, ...userWithoutSecrets } = user;
    return NextResponse.json({ message: 'Login successful', user: userWithoutSecrets, recovered }, { status: 200 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
