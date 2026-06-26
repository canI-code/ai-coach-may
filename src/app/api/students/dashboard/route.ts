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

    // B2B mentees get auto-populated profiles
    if (user.role === 'mentee') {
      isComplete = true;
      pendingFields = [];
      
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

    // Fetch placement readiness details
    const [coachingReports, assessmentStats, examSessions] = await Promise.all([
      db.collection('coaching_reports').find({ userId: user._id, status: 'ready' }).toArray(),
      db.collection('user_assessment_stats').findOne({ userId: user._id }),
      db.collection('exam_sessions').find({ userId: user._id }).toArray()
    ]);

    const examSessionIds = examSessions.map((es: any) => es._id);
    const examAttempts = examSessionIds.length > 0
      ? await db.collection('exam_attempts').find({ sessionId: { $in: examSessionIds }, completedAt: { $exists: true } }).toArray()
      : [];

    const examSessionsWithAttempts = examSessions.map((es: any) => {
      const attempts = examAttempts.filter((a: any) => a.sessionId.toString() === es._id.toString());
      return {
        ...es,
        attempts
      };
    });

    const { calculatePlacementReadiness } = await import('@/lib/b2b/predictor');
    const placementReadiness = calculatePlacementReadiness(coachingReports, assessmentStats, examSessionsWithAttempts);

    return NextResponse.json({
      profile,
      user: {
        role: user.role || 'student',
        collegeName: user.collegeName || null,
        enabledPortals: user.enabledPortals || null,
      },
      completionStatus: {
        isComplete,
        pendingFields
      },
      placementReadiness
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
