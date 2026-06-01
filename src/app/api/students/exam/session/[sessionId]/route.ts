import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getUserOpenFlaggedQuestionIds } from '@/lib/question-flags';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

function toObjectId(value: unknown) {
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && ObjectId.isValid(value)) return new ObjectId(value);
  throw new Error('Invalid object id');
}

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const sessionObjectId = toObjectId(sessionId);
    const userObjectId = toObjectId(user._id);
    const blockedQuestionIds = await getUserOpenFlaggedQuestionIds(db, user._id);

    const session = await db.collection('exam_sessions').findOne({
      _id: sessionObjectId,
      userId: userObjectId
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const attempt = await db.collection('exam_attempts').findOne({
      sessionId: sessionObjectId,
      userId: userObjectId
    }, { sort: { attemptNumber: -1 } }); // Get latest attempt

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    // Fetch question details for UI
    const allowedQuestionIds = attempt.questionIds.filter((id: ObjectId) => !blockedQuestionIds.some(flagId => flagId.equals(id)));
    const questions = await db.collection('questions_ai').find({ _id: { $in: allowedQuestionIds } }).toArray();
    
    // Map by id for ordering
    const qsMap = new Map(questions.map(q => [q._id.toString(), q]));
    const orderedQs = allowedQuestionIds.map((id: any) => {
      const q = qsMap.get(id.toString());
      if (!q) return null;
      const correctChoice = q.choices.find((c: any) => c.correct);
      return {
        _id: q._id,
        text: q.text,
        choices: q.choices.map((c: any) => ({ id: c.id, text: c.text })),
        interest: q.interest,
        difficulty: q.difficulty,
        explanation: q.explanation || null,
        correctChoiceId: correctChoice?.id || null
      };
    }).filter((q: any): q is any => q !== null);

    return NextResponse.json({
      sessionId: session._id,
      attemptId: attempt._id,
      status: session.status,
      totalQuestionCount: session.totalQuestionCount || session.questionCount,
      questionCount: orderedQs.length,
      questions: orderedQs,
      answeredCount: attempt.answers.length
    });

  } catch (error: any) {
    console.error('Practice Exam Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
