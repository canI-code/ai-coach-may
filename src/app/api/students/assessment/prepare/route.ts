import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { getQuestionsForAssessment } from '@/lib/ai-generator';
import { ObjectId } from 'mongodb';
import { getDbForUser } from '@/lib/db-selector';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const { db } = await getDbForUser(user._id);
    const mainDb = client.db(DB_NAME);

    const profile = await db.collection('user_profile').findOne({ userId: user._id });
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.interests || !Array.isArray(profile.interests) || profile.interests.length === 0) {
      return NextResponse.json({ error: 'No interests selected in profile' }, { status: 400 });
    }

    // Check if there's already an active draft attempt
    let existingAttempt = await db.collection('user_assessment_attempts').findOne({
      userId: user._id,
      status: 'draft'
    });

    if (existingAttempt) {
      const questions = await mainDb.collection('questions_non_ai').find({ _id: { $in: existingAttempt.questionIds } }).toArray();
      const aiQuestions = await mainDb.collection('questions_ai').find({ _id: { $in: existingAttempt.questionIds } }).toArray();
      
      const allQs = [...questions, ...aiQuestions].map(q => ({
        _id: q._id,
        text: q.text,
        choices: q.choices.map((c: any) => ({ id: c.id, text: c.text })), // Strip 'correct' flag
        interest: q.interest
      }));

      // FIX: If the existing attempt has 0 valid questions, delete it and allow a fresh start
      if (allQs.length === 0) {
        console.log(`🗑️ Deleting stale draft attempt ${existingAttempt._id} with 0 questions.`);
        await db.collection('user_assessment_attempts').deleteOne({ _id: existingAttempt._id });
        existingAttempt = null;
      } else {
        return NextResponse.json({
          assessmentId: existingAttempt._id,
          questionCount: allQs.length,
          questions: allQs
        });
      }
    }

    // Prepare new assessment
    // Fetch exactly 4 questions for EVERY selected interest
    const allQuestionIds: ObjectId[] = [];
    console.log(`🚀 Preparing strict assessment for user ${user._id} with interests: ${profile.interests.join(', ')}`);

    for (const interest of profile.interests) {
      const ids = await getQuestionsForAssessment([interest], 4);
      allQuestionIds.push(...ids);
    }
    
    const expectedCount = profile.interests.length * 4;
    if (allQuestionIds.length < expectedCount) {
      console.error(`❌ Incomplete assessment preparation. Expected ${expectedCount}, got ${allQuestionIds.length}.`);
      return NextResponse.json({ 
        error: 'INCOMPLETE_GENERATION', 
        message: 'There is some issue preparing your complete assessment. Please try again after some time.' 
      }, { status: 503 });
    }

    const newAttempt = {
      userId: user._id,
      status: 'draft',
      questionIds: allQuestionIds,
      answers: [],
      startedAt: new Date(),
    };

    const result = await db.collection('user_assessment_attempts').insertOne(newAttempt);
    console.log(`📝 Created draft attempt ${result.insertedId} with ${allQuestionIds.length} questions.`);

    // Fetch question details for UI
    const questions = await mainDb.collection('questions_non_ai').find({ _id: { $in: allQuestionIds } }).toArray();
    const aiQuestions = await mainDb.collection('questions_ai').find({ _id: { $in: allQuestionIds } }).toArray();
    
    // Combine and sort by the original allQuestionIds order
    const qsMap = new Map([...questions, ...aiQuestions].map(q => [q._id.toString(), q]));
    const orderedQs = allQuestionIds.map(id => {
      const q = qsMap.get(id.toString());
      if (!q) return null;
      return {
        _id: q._id,
        text: q.text,
        choices: q.choices.map((c: any) => ({ id: c.id, text: c.text })), // Strip 'correct'
        interest: q.interest
      };
    }).filter((q): q is any => q !== null);

    return NextResponse.json({
      assessmentId: result.insertedId,
      questionCount: orderedQs.length,
      questions: orderedQs
    });

  } catch (error: any) {
    console.error('Assessment Prepare Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
