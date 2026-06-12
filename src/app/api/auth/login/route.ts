import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { findInstituteByUserId, getInstituteDbForUser } from '@/lib/b2b/registry';

export async function POST(request: Request) {
  try {
    const { email, phone, password, role, validateOnly } = await request.json();

    const client = await clientPromise;

    // Determine if B2C (student/professional) or B2B (institution/mentor/mentee)
    const isB2C = role === 'student' || role === 'professional';
    const isB2B = role === 'institution' || role === 'mentor' || role === 'mentee';

    let db: any;
    let user: any;

    if (isB2C) {
      // B2C: always use aicoach database
      if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
      db = client.db('aicoach');
      user = await db.collection('users').findOne({ phone });

      // Fallback: If not found in B2C, check all active B2B databases by phone
      if (!user) {
        const registry = db.collection('institute_registry');
        const institutes = await registry.find({ status: 'active' }).toArray();
        for (const inst of institutes) {
          const instDb = client.db(inst.dbName);
          const found = await instDb.collection('users').findOne({ phone });
          if (found) {
            user = found;
            db = instDb;
            break;
          }
        }
      }
    } else if (isB2B) {
      // B2B: find user in their institute's database via registry
      if (!email || !password) return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });

      let searchIdentifier = email.trim();
      if (/^\d{10}$/.test(searchIdentifier)) {
        searchIdentifier = '+91' + searchIdentifier;
      }
      if (searchIdentifier.includes('@')) {
        searchIdentifier = searchIdentifier.toLowerCase();
      }

      const query = searchIdentifier.includes('@') 
        ? { email: searchIdentifier } 
        : { phone: searchIdentifier };

      // Search across institute databases for this email/phone
      const registry = client.db('aicoach').collection('institute_registry');
      const institutes = await registry.find({ status: 'active' }).toArray();

      for (const inst of institutes) {
        const instDb = client.db(inst.dbName);
        const found = await instDb.collection('users').findOne(query);
        if (found) {
          user = found;
          db = instDb;
          break;
        }
      }

      // Also check if it's an institution rep logging in via registry credentials
      if (!user) {
        const registryQuery = searchIdentifier.includes('@')
          ? { 'loginCredentials.email': searchIdentifier, status: 'active' }
          : { representativePhone: searchIdentifier, status: 'active' };

        const inst = await registry.findOne(registryQuery as any);
        if (inst) {
          db = client.db(inst.dbName);
          // Create/find the institution user in their DB
          user = await db.collection('users').findOne({
            $or: [
              { email: inst.representativeEmail },
              { phone: inst.representativePhone }
            ],
            role: 'institution'
          });
        }
      }
    } else {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const otpsCollection = client.db('aicoach').collection('otps');

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

    // Status checks for B2B users
    if (user.role === 'mentee' && user.status === 'disabled') {
      return NextResponse.json({ error: 'Account disabled by mentor' }, { status: 403 });
    }
    if (user.role === 'mentor' && user.status === 'disabled') {
      return NextResponse.json({ error: 'Account disabled' }, { status: 403 });
    }

    // Check Password (B2B only — B2C uses OTP)
    if (!isB2C) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    }

    // Step 1: Validate Only (for B2B to trigger OTP)
    if (validateOnly) {
      return NextResponse.json({ message: 'Credentials valid', user: { phone: user.phone } });
    }

    // Step 2: Final Login — Must verify OTP first
    if (!validateOnly) {
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
        lastDevice: userAgent,
      },
      $inc: { loginCount: 1 },
    };

    // Session limits based on role
    if (user.role === 'institution') {
      // Institution reps: max 3 sessions (rotate oldest)
      const activeSessions = user.sessions || [];
      if (activeSessions.length >= 3) {
        const rotatedSessions = activeSessions.slice(-2);
        updateData.$set.sessions = [...rotatedSessions, { id: sessionId, createdAt: new Date() }];
        delete updateData.$push;
      }
    } else if (user.role === 'mentor') {
      // Mentors: max 3 sessions (rotate oldest)
      const activeSessions = user.sessions || [];
      if (activeSessions.length >= 3) {
        const rotatedSessions = activeSessions.slice(-2);
        updateData.$set.sessions = [...rotatedSessions, { id: sessionId, createdAt: new Date() }];
        delete updateData.$push;
      }
    } else if (user.role === 'mentee') {
      // Mentees: single device enforcement
      updateData.$set.sessions = [{ id: sessionId, createdAt: new Date() }];
      delete updateData.$push;
    }

    if (recovered) {
      updateData.$unset = { deletionScheduled: '', deletionScheduledAt: '' };
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
