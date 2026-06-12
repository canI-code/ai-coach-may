import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';

/**
 * GET /api/b2b/institution/overview
 * Returns dashboard overview stats: total mentors, mentees, credits used/remaining, recent activity.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'institution') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) {
      return NextResponse.json({ error: 'Institute not found' }, { status: 404 });
    }

    const { institute } = result;
    const db = await getInstituteDb(institute._id!);
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Aggregate stats
    const [mentorCount, menteeCount, recentSessions] = await Promise.all([
      db.collection('users').countDocuments({ role: 'mentor' }),
      db.collection('users').countDocuments({ role: 'mentee' }),
      db.collection('credit_transactions').find()
        .sort({ createdAt: -1 }).limit(10).toArray(),
    ]);

    return NextResponse.json({
      stats: {
        totalMentors: mentorCount,
        totalMentees: menteeCount,
        creditsTotal: institute.plan?.totalCredits || 0,
        creditsUsed: institute.plan?.usedCredits || 0,
        creditsRemaining: (institute.plan?.totalCredits || 0) - (institute.plan?.usedCredits || 0),
        enabledPortals: institute.plan?.enabledPortals || [],
        expiresAt: institute.plan?.expiresAt,
      },
      recentActivity: recentSessions.map(s => ({
        type: s.type,
        amount: s.amount,
        reason: s.reason,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('Institution overview error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
