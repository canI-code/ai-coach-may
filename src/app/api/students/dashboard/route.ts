import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { evaluateProfileCompletion } from '@/lib/profile';

import { getDbForUser } from '@/lib/db-selector';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await getDbForUser(user._id);

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
    let { isComplete, pendingFields } = evaluateProfileCompletion(profile);

    if (user.role === 'mentee') {
      isComplete = true;
      pendingFields = [];
      
      // Auto-populate missing details if needed
      const updateFields: any = {};
      let needsUpdate = false;

      if (!profile.username) {
        profile.username = user.email ? user.email.split('@')[0] : 'user_' + Math.random().toString(36).substring(7);
        updateFields.username = profile.username;
        needsUpdate = true;
      }
      if (!profile.education) {
        profile.education = {
          degree: user.degree || 'B.Tech',
          course: user.subject || 'Computer Science',
          currentMarks: 'N/A'
        };
        updateFields.education = profile.education;
        needsUpdate = true;
      }
      if (!profile.interests) {
        profile.interests = ['Software Engineering', 'Behavioral Interviews', 'Problem Solving'];
        updateFields.interests = profile.interests;
        needsUpdate = true;
      }
      if (!profile.completed) {
        updateFields.completed = true;
        profile.completed = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        updateFields.updatedAt = new Date();
        await db.collection('user_profile').updateOne(
          { _id: profile._id },
          { $set: updateFields }
        );
      }
    } else {
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
    }

    return NextResponse.json({
      profile,
      user: {
        role: user.role || 'student',
        collegeName: user.collegeName || null
      },
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
