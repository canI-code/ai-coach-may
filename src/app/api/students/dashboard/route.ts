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
      // Data Migration: Create profile if it doesn't exist
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

    // Evaluate completion status using shared utility
    const { isComplete, pendingFields } = evaluateProfileCompletion(profile);

    // Sync 'completed' status in DB if it changed
    if (isComplete !== profile.completed) {
      await db.collection('user_profile').updateOne(
        { _id: profile._id },
        { 
          $set: { 
            completed: isComplete, 
            updatedAt: new Date(),
            ...(isComplete ? { completedAt: new Date() } : {})
          } 
        }
      );
      profile.completed = isComplete;
    }

    return NextResponse.json({
      profile,
      completionStatus: {
        isComplete,
        pendingFields
      }
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
