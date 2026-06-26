import { NextResponse } from 'next/server';
import { getCurrentUserWithContext } from '@/lib/auth';
import { ObjectId } from 'mongodb';

/**
 * GET /api/students/campaigns
 * Retrieves all active campaigns for the current mentee's batch(es).
 */
export async function GET() {
  try {
    const context = await getCurrentUserWithContext();
    if (!context || context.user.role !== 'mentee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db, user } = context;
    
    const batchIds: ObjectId[] = [];
    if (user.batchId) batchIds.push(new ObjectId(user.batchId));
    if (user.batchIds && Array.isArray(user.batchIds)) {
      user.batchIds.forEach((id: any) => {
        if (ObjectId.isValid(id)) {
          batchIds.push(new ObjectId(id));
        }
      });
    }

    if (batchIds.length === 0) {
      return NextResponse.json([]);
    }

    // Find active campaigns for the user's batches where endTime > now
    const now = new Date();
    const campaigns = await db.collection('practice_campaigns')
      .find({
        batchId: { $in: batchIds },
        endTime: { $gt: now }
      })
      .sort({ startTime: 1 })
      .toArray();

    if (campaigns.length === 0) {
      return NextResponse.json([]);
    }

    // Check if the user has completed each campaign
    const campaignIds = campaigns.map(c => c._id);
    
    const [interviewSessions, examSessions] = await Promise.all([
      db.collection('interview_sessions').find({
        userId: user._id,
        campaignId: { $in: campaignIds },
        status: 'completed'
      }).toArray(),
      db.collection('exam_sessions').find({
        userId: user._id,
        campaignId: { $in: campaignIds },
        status: 'completed'
      }).toArray()
    ]);

    const completedInterviewCampaignIds = new Set(interviewSessions.map(s => s.campaignId?.toString()));
    const completedExamCampaignIds = new Set(examSessions.map(s => s.campaignId?.toString()));

    const campaignsWithCompletion = campaigns.map(camp => {
      let completed = false;
      const cIdStr = camp._id.toString();
      
      if (camp.type === 'interview') {
        completed = completedInterviewCampaignIds.has(cIdStr);
      } else if (camp.type === 'exam') {
        completed = completedExamCampaignIds.has(cIdStr);
      }

      return {
        ...camp,
        completed
      };
    });

    return NextResponse.json(campaignsWithCompletion);
  } catch (error) {
    console.error('GET student campaigns error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
