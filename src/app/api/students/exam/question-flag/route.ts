import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { QuestionSelector } from '@/lib/question-pool/question-selector';
import { ProficiencyEngine } from '@/lib/proficiency/proficiency-engine';
import { getUserOpenFlaggedQuestionIds, QuestionFlagReason } from '@/lib/question-flags';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

const VALID_REASONS: QuestionFlagReason[] = ['incorrect_question', 'incorrect_answer', 'spelling_mistake', 'other'];

function toObjectId(value: unknown) {
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && ObjectId.isValid(value)) return new ObjectId(value);
  throw new Error('Invalid object id');
}

function sanitizeReasonText(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

function countWords(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attemptId, questionId, reasonType, reasonText } = await req.json();

    if (!attemptId || !questionId || !reasonType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!VALID_REASONS.includes(reasonType)) {
      return NextResponse.json({ error: 'Invalid flag reason' }, { status: 400 });
    }

    const cleanReasonText = sanitizeReasonText(reasonText);
    if (reasonType === 'other' && !cleanReasonText) {
      return NextResponse.json({ error: 'Please provide a reason for Other' }, { status: 400 });
    }

    if (countWords(cleanReasonText) > 150) {
      return NextResponse.json({ error: 'Reason must be 150 words or fewer' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const attemptObjectId = toObjectId(attemptId);
    const questionObjectId = toObjectId(questionId);
    const userObjectId = toObjectId(user._id);

    const attempt = await db.collection('exam_attempts').findOne({
      _id: attemptObjectId,
      userId: userObjectId
    });

    if (!attempt) {
      return NextResponse.json({ error: 'Exam attempt not found' }, { status: 404 });
    }

    const currentQuestion = await db.collection('questions_ai').findOne({ _id: questionObjectId });
    if (!currentQuestion) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const openFlaggedIds = await getUserOpenFlaggedQuestionIds(db, user._id);
    const blockedIds = new Set<string>([
      ...attempt.questionIds.map((id: ObjectId) => id.toString()),
      ...openFlaggedIds.map(id => id.toString()),
      questionObjectId.toString()
    ]);

    const profile = await ProficiencyEngine.getUserProficiency(user._id);
    const interest = currentQuestion.interest;
    const interestProfile = profile.interestProfiles?.[interest] || {
      abilityRating: 1000,
      currentLevel: 'Intermediate',
      effectiveRating: 1000
    };

    const difficultyTier = currentQuestion.difficulty === 'Expert'
      ? 'Expert'
      : currentQuestion.difficulty === 'Hard'
        ? 'Hard'
        : currentQuestion.difficulty === 'Medium'
          ? 'Medium'
          : 'Easy';

    await db.collection('question_flags').updateOne(
      {
        questionId: questionObjectId,
        userId: userObjectId,
        status: 'open'
      },
      {
        $set: {
          reasonType,
          reasonText: cleanReasonText || null,
          sessionId: toObjectId(attempt.sessionId),
          attemptId: attemptObjectId,
          updatedAt: new Date()
        },
        $setOnInsert: {
          questionId: questionObjectId,
          userId: userObjectId,
          status: 'open',
          createdAt: new Date(),
          resolvedAt: null,
          resolvedBy: null
        }
      },
      { upsert: true }
    );

    let replacementQuestion: any = null;
    try {
      const replacement = await QuestionSelector.selectQuestions({
        interest,
        userAbilityRating: interestProfile.effectiveRating || interestProfile.abilityRating,
        count: 1,
        excludeQuestionIds: Array.from(blockedIds).map(id => new ObjectId(id)),
        difficultyTier
      });

      if (replacement.length > 0) {
        const richQuestion = await db.collection('questions_ai').findOne({ _id: replacement[0]._id });
        if (richQuestion) {
          replacementQuestion = {
            _id: richQuestion._id,
            text: richQuestion.text,
            choices: richQuestion.choices?.map((choice: any) => ({ id: choice.id, text: choice.text })),
            interest: richQuestion.interest,
            difficulty: richQuestion.difficulty
          };
        }
      }
    } catch (replacementError) {
      console.error('Question replacement failed, but flag was saved:', replacementError);
    }

    return NextResponse.json({
      success: true,
      replacementQuestion
    });
  } catch (error: any) {
    console.error('Question Flag Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
