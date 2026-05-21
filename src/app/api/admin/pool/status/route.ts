import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    // In production we would check if user has admin role (e.g. user.role === 'admin')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const poolCol = db.collection('questions_pool');

    const totalCount = await poolCol.countDocuments({});
    
    // Aggregation of difficulty sizes
    const difficultyCounts = await poolCol.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]).toArray();

    // Aggregation of source breakdown
    const sourceCounts = await poolCol.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]).toArray();

    // Aggregation of top interests
    const interestCounts = await poolCol.aggregate([
      { $group: { _id: '$interest', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    // Recent activity counts
    const underReviewCount = await poolCol.countDocuments({ status: 'review' });
    const activeCount = await poolCol.countDocuments({ status: 'active' });

    return NextResponse.json({
      success: true,
      status: {
        totalQuestions: totalCount,
        activeQuestions: activeCount,
        underReviewQuestions: underReviewCount,
        byDifficulty: difficultyCounts.reduce((acc: any, cur: any) => {
          acc[cur._id || 'Unknown'] = cur.count;
          return acc;
        }, {}),
        bySource: sourceCounts.reduce((acc: any, cur: any) => {
          acc[cur._id || 'Unknown'] = cur.count;
          return acc;
        }, {}),
        topInterests: interestCounts.map((item: any) => ({
          interest: item._id,
          count: item.count
        }))
      }
    });

  } catch (error: any) {
    console.error('Admin Pool Status Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
