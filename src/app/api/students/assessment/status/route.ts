import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const stats = await db.collection('user_assessment_stats').findOne({ userId: user._id });

    if (!stats) {
      return NextResponse.json({ canRetake: true, completedAt: null }, { status: 404 });
    }

    return NextResponse.json({
      canRetake: false, // Initial assessment is one-time only as per spec
      completedAt: stats.lastAssessmentAt,
      levelDetermined: stats.currentLevel,
      scorePercentage: stats.scorePercentage
    });

  } catch (error: any) {
    console.error('Assessment Status Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
