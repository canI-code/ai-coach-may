import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assessmentId, questionId, chosenChoiceId, timeSpentSeconds } = await req.json();

    if (!assessmentId || !questionId || !chosenChoiceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Update the attempt with the new answer
    // Using $pull followed by $push to ensure we don't have duplicate answers for the same question
    await db.collection('user_assessment_attempts').updateOne(
      { _id: new ObjectId(assessmentId), userId: user._id, status: 'draft' },
      { 
        $pull: { answers: { questionId: new ObjectId(questionId) } } as any
      }
    );

    const result = await db.collection('user_assessment_attempts').updateOne(
      { _id: new ObjectId(assessmentId), userId: user._id, status: 'draft' },
      { 
        $push: { 
          answers: { 
            questionId: new ObjectId(questionId), 
            chosenChoiceId, 
            timeSpentSeconds: timeSpentSeconds || 0 
          } 
        } 
      } as any
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Active assessment not found' }, { status: 404 });
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Submit Answer Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
