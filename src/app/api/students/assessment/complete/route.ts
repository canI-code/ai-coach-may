import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { ProficiencyLevel } from '@/lib/assessment';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';
const MAX_TIME_PER_QUESTION = 120; // 2 minutes

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assessmentId } = await req.json();
    if (!assessmentId) {
      return NextResponse.json({ error: 'Missing assessmentId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const attempt = await db.collection('user_assessment_attempts').findOne({
      _id: new ObjectId(assessmentId),
      userId: user._id,
      status: 'draft'
    });

    if (!attempt) {
      return NextResponse.json({ error: 'Draft assessment not found' }, { status: 404 });
    }

    // Fetch all questions to verify answers
    const questions = await db.collection('questions_non_ai').find({ _id: { $in: attempt.questionIds } }).toArray();
    const aiQuestions = await db.collection('questions_ai').find({ _id: { $in: attempt.questionIds } }).toArray();
    const qsMap = new Map([...questions, ...aiQuestions].map(q => [q._id.toString(), q]));

    let totalScore = 0;
    let questionsCorrect = 0;
    let questionsWrong = 0;
    let questionsSkipped = 0;
    let totalTimeSpent = 0;
    const scoreByInterest: Record<string, number> = {};

    const enrichedAnswers = attempt.answers.map((ans: any) => {
      const q = qsMap.get(ans.questionId.toString());
      if (!q) return ans;

      const correctChoice = q.choices.find((c: any) => c.correct);
      const isSkipped = ans.chosenChoiceId === 'skipped';
      const isCorrect = !isSkipped && correctChoice && ans.chosenChoiceId === correctChoice.id;
      
      let score = 0;
      if (isCorrect) {
        questionsCorrect++;
        const timeBonus = Math.max(0, 1.0 - (ans.timeSpentSeconds / MAX_TIME_PER_QUESTION));
        score = Number((1.0 * timeBonus).toFixed(2));
        totalScore += score;
      } else if (isSkipped) {
        questionsSkipped++;
      } else {
        questionsWrong++;
      }

      totalTimeSpent += ans.timeSpentSeconds;
      
      // Track score by interest
      if (!scoreByInterest[q.interest]) scoreByInterest[q.interest] = 0;
      scoreByInterest[q.interest] += score;

      return { ...ans, isCorrect, isSkipped, score };
    });

    // Handle questions not even answered (if the attempt was abandoned)
    questionsSkipped += attempt.questionIds.length - enrichedAnswers.length;
    const scorePercentage = (totalScore / attempt.questionIds.length) * 100;

    let level: ProficiencyLevel = 'Beginner';
    if (scorePercentage >= 86) level = 'Expert';
    else if (scorePercentage >= 71) level = 'Advanced';
    else if (scorePercentage >= 46) level = 'Intermediate';

    const completedAt = new Date();

    // 1. Update attempt
    await db.collection('user_assessment_attempts').updateOne(
      { _id: attempt._id },
      { 
        $set: { 
          status: 'completed',
          answers: enrichedAnswers,
          totalScore,
          scorePercentage,
          levelDetermined: level,
          completedAt
        } 
      }
    );

    // 2. Update user_assessment_stats
    const stats = {
      userId: user._id,
      currentLevel: level,
      totalScore,
      scorePercentage,
      scoreByInterest,
      questionsAttempted: enrichedAnswers.length,
      questionsCorrect,
      questionsWrong,
      questionsSkipped,
      averageTimePerQuestion: enrichedAnswers.length > 0 ? totalTimeSpent / enrichedAnswers.length : 0,
      lastAssessmentAt: completedAt,
      attemptId: attempt._id
    };

    await db.collection('user_assessment_stats').updateOne(
      { userId: user._id },
      { $set: stats },
      { upsert: true }
    );

    // 3. Update user_profile
    await db.collection('user_profile').updateOne(
      { userId: user._id },
      { $set: { assessmentCompleted: true, updatedAt: new Date() } }
    );

    return NextResponse.json({
      levelDetermined: level,
      scorePercentage,
      stats
    });

  } catch (error: any) {
    console.error('Assessment Complete Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
