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

    const { degree, course, currentMarks } = await req.json();
    if (!degree || !course || !currentMarks) {
      return NextResponse.json({ error: 'Missing required education fields (degree, course, currentMarks)' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    let profile: any = await db.collection('user_profile').findOne({ userId: user._id });
    
    // Check 78-hour education edit lock
    const EDUCATION_LOCK_MS = 78 * 60 * 60 * 1000;
    if (profile && profile.lastEducationEditAt && profile.education) {
      const lastEdit = new Date(profile.lastEducationEditAt);
      const diffMs = Date.now() - lastEdit.getTime();
      if (diffMs < EDUCATION_LOCK_MS) {
        const remainingMs = EDUCATION_LOCK_MS - diffMs;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return NextResponse.json({ 
          error: `Education details are locked. You can edit them again in ${hours}h ${mins}m.` 
        }, { status: 403 });
      }
    }

    const education = { 
      degree: String(degree).trim(), 
      course: String(course).trim(), 
      currentMarks: String(currentMarks).trim() 
    };

    if (!profile) {
      const newUserProfile: any = {
        userId: user._id,
        fullName: user.fullName,
        dob: user.dob,
        education,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastEducationEditAt: new Date(), // Set lock timestamp
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
        education,
        updatedAt: new Date(),
        lastEducationEditAt: new Date(), // Set lock timestamp
      };
      
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
    console.error('Update education error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
