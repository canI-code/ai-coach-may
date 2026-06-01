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

    const { mainField, interests } = await req.json();
    if (!mainField || !interests || !Array.isArray(interests)) {
      return NextResponse.json({ error: 'Missing mainField or interests array' }, { status: 400 });
    }

    if (interests.length < 3) {
      return NextResponse.json({ error: 'Select at least 3 interests' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    let profile: any = await db.collection('user_profile').findOne({ userId: user._id });
    
    // Check 48-hour interests edit lock
    const INTERESTS_LOCK_MS = 48 * 60 * 60 * 1000;
    if (profile && profile.lastInterestsEditAt && profile.interests && profile.interests.length >= 3) {
      const lastEdit = new Date(profile.lastInterestsEditAt);
      const diffMs = Date.now() - lastEdit.getTime();
      if (diffMs < INTERESTS_LOCK_MS) {
        const remainingMs = INTERESTS_LOCK_MS - diffMs;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return NextResponse.json({ 
          error: `Interests details are locked. You can edit them again in ${hours}h ${mins}m.` 
        }, { status: 403 });
      }
    }

    const isFirstTime = !profile || !profile.interests || profile.interests.length < 3;

    const interestsData = {
      mainField: String(mainField).trim(),
      interests: interests.map(i => String(i).trim()).filter(i => i.length > 0)
    };

    if (interestsData.interests.length < 3) {
      return NextResponse.json({ error: 'Select at least 3 valid interests' }, { status: 400 });
    }

    if (!profile) {
      const newUserProfile: any = {
        userId: user._id,
        fullName: user.fullName,
        dob: user.dob,
        ...interestsData,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Don't set lastInterestsEditAt on first creation
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
        ...interestsData,
        updatedAt: new Date(),
      };

      // Only apply lock if it's NOT the first time setting interests
      if (!isFirstTime) {
        updateData.lastInterestsEditAt = new Date();
      }
      
      const tempProfile = { ...profile, ...updateData };
      const { isComplete } = evaluateProfileCompletion(tempProfile);
      
      if (isComplete) {
        updateData.completed = true;
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

    return NextResponse.json({ 
      profile,
      completion: evaluateProfileCompletion(profile)
    });
  } catch (error: any) {
    console.error('Update interests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
