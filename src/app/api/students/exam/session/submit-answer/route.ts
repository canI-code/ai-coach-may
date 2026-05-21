import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ProficiencyEngine } from '@/lib/proficiency/proficiency-engine';
import { ObjectId } from 'mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attemptId, questionId, chosenChoiceId, timeSpentSeconds = 0 } = await req.json();

    if (!attemptId || !questionId || !chosenChoiceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch the question from the unified questions_ai
    const question = await db.collection('questions_ai').findOne({ _id: new ObjectId(questionId) });
      
    if (!question) {
      return NextResponse.json({ error: 'Question not found in pool' }, { status: 404 });
    }

    const difficulty_at_time = question.difficulty || 'Medium';
    const difficultyNumeric = question.difficultyNumeric || 2.0;

    // Check if the answer is correct
    const correctChoice = question.choices.find((c: any) => c.correct);
    const isSkipped = chosenChoiceId === 'skipped';
    const isCorrect = !isSkipped && correctChoice && chosenChoiceId === correctChoice.id;

    // Trigger continuous dynamic Elo and proficiency updates in real-time!
    let updatedProfile = null;
    if (!isSkipped) {
      updatedProfile = await ProficiencyEngine.updateRating(
        user._id,
        question.interest,
        difficultyNumeric,
        isCorrect,
        timeSpentSeconds,
        question.topics || []
      );
      
      // Update question analytics in the background (times served, times correct, average time)
      const updateFields: any = {
        $inc: { timesServed: 1 },
        $set: { lastServedAt: new Date() }
      };
      if (isCorrect) {
        updateFields.$inc.timesCorrect = 1;
      }
      
      // Compute a rolling average for response time (weighting new response at 10%)
      const currentAvgTime = question.avgTimeToAnswer || 30;
      const newAvgTime = (currentAvgTime * 0.9) + (timeSpentSeconds * 0.1);
      updateFields.$set.avgTimeToAnswer = Number(newAvgTime.toFixed(1));

      // Asynchronously update question metrics to keep serving loop lightning fast
      db.collection('questions_ai').updateOne({ _id: question._id }, updateFields).catch((err) => {
        console.error('Failed to update question pool statistics:', err.message);
      });
    }

    // Remove any existing answer for this question in this attempt (allows changing answer before completion)
    await db.collection('exam_attempts').updateOne(
      { _id: new ObjectId(attemptId), userId: user._id },
      { 
        $pull: { answers: { questionId: new ObjectId(questionId) } } as any
      }
    );

    // Add the new answer with calculated correctness and scores
    const result = await db.collection('exam_attempts').updateOne(
      { _id: new ObjectId(attemptId), userId: user._id },
      { 
        $push: { 
          answers: { 
            questionId: new ObjectId(questionId), 
            chosenChoiceId, 
            timeSpentSeconds,
            difficulty_at_time,
            isCorrect,
            isSkipped
          } 
        } 
      } as any
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Exam attempt not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      received: true, 
      isCorrect,
      currentElo: updatedProfile ? updatedProfile.interestProfiles[question.interest]?.abilityRating : null
    });

  } catch (error: any) {
    console.error('Practice Submit Answer Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
