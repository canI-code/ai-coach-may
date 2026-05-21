import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { evaluateProfileCompletion } from '@/lib/profile';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username } = await req.json();
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const trimmedUsername = String(username).trim();
    if (!trimmedUsername) {
      return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Check if username is taken by another user
    const existingUsername = await db.collection('user_profile').findOne({ 
      username: { $regex: new RegExp(`^${trimmedUsername}$`, 'i') },
      userId: { $ne: user._id }
    });

    if (existingUsername) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
    }

    let profile = await db.collection('user_profile').findOne({ userId: user._id });
    
    if (!profile) {
      // Create profile if it doesn't exist (though it should ideally exist)
      const newUserProfile: any = {
        userId: user._id,
        fullName: user.fullName,
        dob: user.dob,
        username: trimmedUsername,
        createdAt: new Date(),
        updatedAt: new Date(),
        completed: false,
      };
      
      const completion = evaluateProfileCompletion(newUserProfile);
      if (completion.isComplete) {
        newUserProfile.completed = true;
        newUserProfile.completedAt = new Date();
      }
      
      const result = await db.collection('user_profile').insertOne(newUserProfile);
      profile = { ...newUserProfile, _id: result.insertedId };
    } else {
      const updateData: any = {
        username: trimmedUsername,
        updatedAt: new Date(),
      };
      
      const tempProfile = { ...profile, ...updateData };
      const { isComplete } = evaluateProfileCompletion(tempProfile);
      
      if (isComplete) {
        updateData.completed = true;
        // Only set completedAt if it wasn't already completed
        if (!profile.completed) {
          updateData.completedAt = new Date();
        }
      } else {
        updateData.completed = false;
      }
      
      await db.collection('user_profile').updateOne(
        { userId: user._id },
        { $set: updateData }
      );
      
      profile = { ...profile, ...updateData };
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      profile,
      completion: evaluateProfileCompletion(profile as any)
    });
  } catch (error: any) {
    console.error('Update username error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
