import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const { identifier, role } = await request.json();

    if (!identifier) {
      return NextResponse.json({ error: 'Identifier (phone/email) is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');
    const otpsCollection = db.collection('otps');

    const existingRecord = await otpsCollection.findOne({ identifier });
    const now = new Date();

    // CRITICAL: Check if user is ALREADY locked out BEFORE sending new OTP
    // This prevents brute force - user cannot get new OTP if already locked
    if (existingRecord && existingRecord.lockoutUntil && existingRecord.lockoutUntil > now) {
      const minutesLeft = Math.ceil((existingRecord.lockoutUntil.getTime() - now.getTime()) / 60000);
      return NextResponse.json({ 
        error: `Account locked due to previous failed attempts. Try again in ${minutesLeft} minutes.`,
        lockout: true,
        minutesLeft 
      }, { status: 429 });
    }

    if (existingRecord) {
      // Check 60s cooldown for resending
      if (existingRecord.lastSentAt && (now.getTime() - existingRecord.lastSentAt.getTime()) < 60000) {
        const secondsLeft = 60 - Math.floor((now.getTime() - existingRecord.lastSentAt.getTime()) / 1000);
        return NextResponse.json({ error: `Please wait ${secondsLeft} seconds before resending.` }, { status: 429 });
      }
    }

    // Generate/Simulate OTP: 6 digits for Mentor, 4 digits for others
    const isMentor = role === 'mentor';
    const simulatedOtp = isMentor ? '123456' : '1234';
    const expiresAt = new Date(now.getTime() + 5 * 60000); // 5 minutes validity

    await otpsCollection.updateOne(
      { identifier },
      {
        $set: {
          otp: simulatedOtp,
          expiresAt,
          lastSentAt: now,
          role,
          // Reset attempts ONLY if lockout has expired, else keep them and DON'T allow new OTP
          attempts: (existingRecord && existingRecord.lockoutUntil && existingRecord.lockoutUntil <= now) ? 0 : (existingRecord ? existingRecord.attempts : 0),
          lockoutUntil: null,
        },
      },
      { upsert: true }
    );

    console.log(`[SIMULATION] OTP for ${identifier} is ${simulatedOtp}`);
    return NextResponse.json({ message: `OTP sent successfully (Simulated: ${simulatedOtp})`, resendAfter: 60 }, { status: 200 });
  } catch (error) {
    console.error('OTP Send Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
