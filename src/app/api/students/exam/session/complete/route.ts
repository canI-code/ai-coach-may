import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { ProficiencyLevel } from '@/lib/assessment';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';
const MAX_TIME_PER_QUESTION = 120; // 2 minutes

function getDifficultyWeight(diffStr: string): number {
  switch (diffStr.toLowerCase()) {
    case 'easy': return 0.5;
    case 'medium': return 0.75;
    case 'hard': return 1.0;
    case 'expert': return 1.25;
    default: return 0.75;
  }
}

function getDifficultyNumeric(diffStr: string): number {
  switch (diffStr.toLowerCase()) {
    case 'easy': return 1;
    case 'medium': return 2;
    case 'hard': return 3;
    case 'expert': return 4;
    default: return 2;
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attemptId } = await req.json();
    if (!attemptId) {
      return NextResponse.json({ error: 'Missing attemptId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const attempt = await db.collection('exam_attempts').findOne({
      _id: new ObjectId(attemptId),
      userId: user._id
    });

    if (!attempt) {
      return NextResponse.json({ error: 'Exam attempt not found' }, { status: 404 });
    }

    // Fetch all questions from unified questions_ai
    const poolQuestions = await db.collection('questions_ai')
      .find({ _id: { $in: attempt.questionIds } })
      .toArray();
      
    const qsMap = new Map(poolQuestions.map(q => [q._id.toString(), q]));

    let totalScore = 0;
    let maxPossibleScore = 0;
    let totalDifficultyNumeric = 0;
    let questionsCorrect = 0;
    let questionsWrong = 0;
    let questionsSkipped = 0;

    const enrichedAnswers = attempt.answers.map((ans: any) => {
      const q = qsMap.get(ans.questionId.toString());
      if (!q) return ans;

      const correctChoice = q.choices.find((c: any) => c.correct);
      const isSkipped = ans.chosenChoiceId === 'skipped';
      const isCorrect = !isSkipped && correctChoice && ans.chosenChoiceId === correctChoice.id;
      
      const diffMultiplier = getDifficultyWeight(ans.difficulty_at_time);
      const diffNumeric = getDifficultyNumeric(ans.difficulty_at_time);
      totalDifficultyNumeric += diffNumeric;

      // Max possible score for THIS specific question (assuming 0 seconds taken)
      maxPossibleScore += (1.0 * diffMultiplier);
      
      let score = 0;
      if (isCorrect) {
        questionsCorrect++;
        // Strict Time Rules Apply Here
        const timeBonus = Math.max(0, 1.0 - (ans.timeSpentSeconds / MAX_TIME_PER_QUESTION));
        score = Number((timeBonus * diffMultiplier).toFixed(2));
        totalScore += score;
      } else if (isSkipped) {
        questionsSkipped++;
      } else {
        questionsWrong++;
      }

      return { ...ans, isCorrect, isSkipped, score };
    });

    // Handle questions not even answered
    const unansweredCount = attempt.questionIds.length - enrichedAnswers.length;
    questionsSkipped += unansweredCount;
    // Add medium difficulty weighting for unanswered questions to maxPossibleScore
    maxPossibleScore += (unansweredCount * 0.75); 

    const scorePercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    const avgDifficultyAchieved = attempt.questionIds.length > 0 ? (totalDifficultyNumeric / attempt.questionIds.length) : 0;

    // Strict Level Determination: Combines high accuracy thresholds WITH difficulty averages
    let level: ProficiencyLevel = 'Beginner';
    
    if (scorePercentage >= 86 && avgDifficultyAchieved >= 3.0) {
      level = 'Expert';
    } else if (scorePercentage >= 71 && avgDifficultyAchieved >= 2.0) {
      level = 'Advanced';
    } else if (scorePercentage >= 46 && avgDifficultyAchieved >= 1.5) {
      level = 'Intermediate';
    }

    const completedAt = new Date();

    // 1. Update attempt
    await db.collection('exam_attempts').updateOne(
      { _id: attempt._id },
      { 
        $set: { 
          answers: enrichedAnswers,
          totalScore,
          scorePercentage,
          levelAchieved: level,
          avgDifficultyAchieved,
          completedAt
        } 
      }
    );

    // 2. Update session status
    await db.collection('exam_sessions').updateOne(
      { _id: attempt.sessionId },
      { $set: { status: 'completed', completedAt } }
    );

    // 3. Update overall user_assessment_stats rolling average for backward compatibility with existing profile/dashboard
    await db.collection('user_assessment_stats').updateOne(
      { userId: user._id },
      { 
        $set: { 
          currentLevel: level, 
          lastAssessmentAt: completedAt,
          updatedAt: completedAt
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      levelAchieved: level,
      scorePercentage,
      avgDifficultyAchieved,
      totalScore,
      maxPossibleScore
    });

  } catch (error: any) {
    console.error('Practice Exam Complete Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
