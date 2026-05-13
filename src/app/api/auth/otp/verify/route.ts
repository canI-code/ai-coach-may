import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const { identifier, otp, role } = await request.json();

    if (!identifier || !otp) {
      return NextResponse.json({ error: 'Identifier and OTP are required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');
    const otpsCollection = db.collection('otps');
    const usersCollection = db.collection('users');

    const record = await otpsCollection.findOne({ identifier });
    const now = new Date();

    if (!record) {
      return NextResponse.json({ error: 'No OTP requested for this identifier' }, { status: 400 });
    }

    // Check for active lockout
    if (record.lockoutUntil && record.lockoutUntil > now) {
      const minutesLeft = Math.ceil((record.lockoutUntil.getTime() - now.getTime()) / 60000);
      return NextResponse.json(
        { error: `Locked out. Try again in ${minutesLeft} minutes.`, status: 429, lockout: true, minutesLeft },
        { status: 429 }
      );
    }

    // Check for expiration
    if (record.expiresAt < now) {
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    if (record.otp !== otp) {
      const attempts = (record.attempts || 0) + 1;
      let lockoutUntil = null;
      let errorMessage = '';
      let isFlagged = false;

      // NEW LOCKOUT LOGIC FOR ALL USERS:
      // After 5 wrong: 10 min block
      // After another 5 (total 10): 30 min block
      // After another 5 (total 15): Flag and deactivate account
      
      if (attempts >= 15) {
        // Flag and deactivate the account
        isFlagged = true;
        errorMessage = 'Account has been flagged and deactivated due to multiple failed attempts. Contact admin.';
        
        // Update the user record to flag the account
        const userIdentifier = identifier.includes('@') ? { email: identifier } : { phone: identifier };
        await usersCollection.updateOne(
          userIdentifier,
          { 
            $set: { 
              isFlagged: true, 
              isActive: false,
              flaggedAt: now,
              flagReason: 'Multiple OTP verification failures'
            }
          },
          { upsert: false }
        );
      } else if (attempts >= 10) {
        // 30 minute lockout after 10 failed attempts
        lockoutUntil = new Date(now.getTime() + 30 * 60000);
        errorMessage = 'Account temporarily locked for 30 minutes due to multiple failed attempts.';
      } else if (attempts >= 5) {
        // 10 minute lockout after 5 failed attempts
        lockoutUntil = new Date(now.getTime() + 10 * 60000);
        errorMessage = 'Too many failed attempts. Account locked for 10 minutes.';
      } else {
        const remaining = 5 - attempts;
        errorMessage = `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`;
      }

      await otpsCollection.updateOne({ identifier }, { $set: { attempts, lockoutUntil, isFlagged } });
      return NextResponse.json(
        { error: errorMessage, status: 429, attempts, lockout: lockoutUntil !== null, isFlagged },
        { status: 429 }
      );
    }

    // Success! Mark OTP as verified (don't delete yet - login API will verify this)
    await otpsCollection.updateOne(
      { identifier },
      { $set: { verified: true, verifiedAt: now } }
    );

    return NextResponse.json({ message: 'OTP verified successfully' }, { status: 200 });
  } catch (error) {
    console.error('OTP Verify Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}