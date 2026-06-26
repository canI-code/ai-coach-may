import { NextResponse } from 'next/server';
import { getCurrentUserWithContext } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/b2b/student/campaigns
 * Retrieves all practice campaigns for batches the student is enrolled in,
 * including completion status and score.
 */
export async function GET() {
  try {
    const context = await getCurrentUserWithContext();
    if (!context || !context.isB2B || context.user.role !== 'mentee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db, user } = context;

    // Fetch latest user info to get batch association
    const mentee = await db.collection('users').findOne({ _id: user._id });
    if (!mentee) {
      return NextResponse.json({ error: 'Mentee not found' }, { status: 404 });
    }

    const batchIds = mentee.batchIds || (mentee.batchId ? [mentee.batchId] : []);
    if (batchIds.length === 0) {
      return NextResponse.json([]);
    }

    const batchObjectIds = batchIds.map((id: any) => new ObjectId(id));

    // Get campaigns associated with the student's batches
    const campaigns = await db.collection('practice_campaigns')
      .find({ batchId: { $in: batchObjectIds } })
      .toArray();

    const now = new Date();

    const results = await Promise.all(
      campaigns.map(async (campaign: any) => {
        const start = new Date(campaign.startTime);
        const end = new Date(campaign.endTime);

        let status: 'upcoming' | 'active' | 'past' = 'upcoming';
        if (now < start) {
          status = 'upcoming';
        } else if (now >= start && now <= end) {
          status = 'active';
        } else {
          status = 'past';
        }

        let isCompleted = false;
        let score: number | null = null;

        if (campaign.type === 'interview') {
          let session = await db.collection('interview_sessions').findOne({
            userId: user._id,
            campaignId: campaign._id
          });

          if (!session) {
            // Fallback: search for matching session in the time window
            const candidateSessions = await db.collection('interview_sessions').find({
              userId: user._id,
              createdAt: { $gte: start, $lte: end }
            }).toArray();

            session = candidateSessions.find((s: any) => {
              if (campaign.config?.role && s.config?.role !== campaign.config.role) return false;
              if (campaign.config?.tags && campaign.config.tags.length > 0) {
                const sessionTags = s.config?.tags || [];
                const hasMatchingTag = campaign.config.tags.some((t: string) => sessionTags.includes(t));
                if (!hasMatchingTag) return false;
              }
              return true;
            }) || null;
          }

          if (session) {
            isCompleted = session.status === 'completed';
            if (isCompleted) {
              const report = await db.collection('coaching_reports').findOne({
                $or: [
                  { _id: session.reportId },
                  { sessionId: session._id }
                ]
              });
              const rawScore = report ? (report.ciScore !== undefined ? report.ciScore : report.overallScore !== undefined ? report.overallScore : report.confidenceIndex) : null;
              score = (rawScore !== undefined && rawScore !== null) ? Math.round(Number(rawScore)) : null;
            }
          }
        } else if (campaign.type === 'exam') {
          let session = await db.collection('exam_sessions').findOne({
            userId: user._id,
            campaignId: campaign._id
          });

          if (!session) {
            // Fallback: search for matching session in the time window
            const candidateSessions = await db.collection('exam_sessions').find({
              userId: user._id,
              startedAt: { $gte: start, $lte: end }
            }).toArray();

            session = candidateSessions.find((s: any) => {
              if (campaign.config?.tags && campaign.config.tags.length > 0) {
                const sessionInterests = s.interests || [];
                const hasMatchingTag = campaign.config.tags.some((t: string) => sessionInterests.includes(t));
                if (!hasMatchingTag) return false;
              }
              return true;
            }) || null;
          }

          if (session) {
            isCompleted = session.status === 'completed';
            if (isCompleted) {
              const attempt = await db.collection('exam_attempts').findOne({
                sessionId: session._id
              });
              score = (attempt?.scorePercentage !== undefined && attempt.scorePercentage !== null) ? Math.round(attempt.scorePercentage) : null;
            }
          }
        }

        return {
          campaign,
          status,
          isCompleted,
          score
        };
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET student campaigns error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
