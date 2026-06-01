import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const flags = await db.collection('question_flags').aggregate([
      { $match: { status: 'open' } },
      {
        $group: {
          _id: '$questionId',
          flagCount: { $sum: 1 },
          reasons: { $push: '$reasonType' },
          samples: { $push: '$reasonText' },
          users: { $addToSet: '$userId' },
          latestFlagAt: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'questions_ai',
          localField: '_id',
          foreignField: '_id',
          as: 'question'
        }
      },
      { $unwind: '$question' },
      {
        $project: {
          _id: 0,
          questionId: '$_id',
          questionText: '$question.text',
          interest: '$question.interest',
          difficulty: '$question.difficulty',
          flagCount: 1,
          reasons: 1,
          samples: 1,
          latestFlagAt: 1,
          users: { $size: '$users' }
        }
      },
      { $sort: { latestFlagAt: -1 } }
    ]).toArray();

    return NextResponse.json({ flags });
  } catch (error: any) {
    console.error('Admin Question Flags GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { questionId, action } = await req.json();

    if (!questionId || !action) {
      return NextResponse.json({ error: 'questionId and action are required' }, { status: 400 });
    }

    if (action !== 'mark-safe') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    await db.collection('question_flags').updateMany(
      { questionId: new ObjectId(questionId), status: 'open' },
      {
        $set: {
          status: 'safe',
          resolvedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin Question Flags POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
