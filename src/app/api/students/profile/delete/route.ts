import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { cookies } from 'next/headers';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phoneOtp, emailOtp } = await request.json();

    if (!phoneOtp || !emailOtp) {
      return NextResponse.json({ error: 'Both phone and email OTPs are required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Retrieve email from user profile or user doc
    const profile = await db.collection('user_profile').findOne({ userId: user._id });
    const email = user.email || profile?.email || '';
    const phone = user.phone || '';

    if (!email) {
      return NextResponse.json({ error: 'Please update your email address in your profile before requesting account deletion.' }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required for B2C verification.' }, { status: 400 });
    }

    const now = new Date();

    // Verify Phone OTP
    const phoneOtpRecord = await db.collection('otps').findOne({ identifier: phone });
    if (!phoneOtpRecord || phoneOtpRecord.otp !== phoneOtp || phoneOtpRecord.expiresAt < now) {
      return NextResponse.json({ error: 'Invalid or expired phone OTP' }, { status: 400 });
    }

    // Verify Email OTP
    const emailOtpRecord = await db.collection('otps').findOne({ identifier: email });
    if (!emailOtpRecord || emailOtpRecord.otp !== emailOtp || emailOtpRecord.expiresAt < now) {
      return NextResponse.json({ error: 'Invalid or expired email OTP' }, { status: 400 });
    }

    // Success! Verify complete. Let's delete the OTP tokens.
    await db.collection('otps').deleteMany({
      identifier: { $in: [phone, email] }
    });

    // Mark user for deletion and clear active sessions
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          deletionScheduled: true,
          deletionScheduledAt: now,
          sessions: [] // Invalidate all active session IDs
        }
      }
    );

    // Clear auth cookie
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');

    return NextResponse.json({ message: 'Account successfully scheduled for deletion.' }, { status: 200 });

  } catch (error: any) {
    console.error('Delete Account API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
