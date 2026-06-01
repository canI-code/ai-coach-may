import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { evaluateProfileCompletion } from '@/lib/profile';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    let profile = await db.collection('user_profile').findOne({ userId: user._id });

    if (!profile) {
      const newUserProfile = {
        userId: user._id,
        fullName: user.fullName,
        dob: user.dob,
        createdAt: new Date(),
        updatedAt: new Date(),
        completed: false,
      };
      
      const result = await db.collection('user_profile').insertOne(newUserProfile);
      profile = { ...newUserProfile, _id: result.insertedId };
    }

    // Evaluate completion status
    const { isComplete, pendingFields } = evaluateProfileCompletion(profile);

    return NextResponse.json({
      profile,
      user: {
        phone: user.phone || '',
        email: user.email || profile.email || '',
        role: user.role,
        accountType: user.accountType
      },
      completionStatus: {
        isComplete,
        pendingFields
      }
    });

  } catch (error: any) {
    console.error('Profile Fetch API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
