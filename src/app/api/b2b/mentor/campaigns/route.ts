import { NextResponse } from 'next/server';
import { getCurrentUserWithContext } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { PracticeCampaignDoc } from '@/lib/b2b/campaign-schema';

/**
 * GET /api/b2b/mentor/campaigns
 * Retrieves all practice campaigns for batches managed by the mentor.
 */
export async function GET(request: Request) {
  try {
    const context = await getCurrentUserWithContext();
    if (!context || !context.isB2B || context.user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = context;

    // Find batches owned by this mentor
    const batches = await db.collection('batches').find({ mentorId: context.user._id }).toArray();
    const batchIds = batches.map((b: any) => b._id);

    const { searchParams } = new URL(request.url);
    const batchIdParam = searchParams.get('batchId');

    let query: any = {};
    if (batchIdParam) {
      const targetBatchId = new ObjectId(batchIdParam);
      // Ensure the mentor actually owns this batch
      if (!batchIds.some(id => id.toString() === targetBatchId.toString())) {
        return NextResponse.json({ error: 'Unauthorized batch access' }, { status: 403 });
      }
      query.batchId = targetBatchId;
    } else {
      query.batchId = { $in: batchIds };
    }

    const campaigns = await db.collection('practice_campaigns')
      .find(query)
      .sort({ startTime: -1 })
      .toArray();

    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign: any) => {
        let completedCount = 0;
        if (campaign.type === 'interview') {
          completedCount = await db.collection('interview_sessions').countDocuments({
            campaignId: campaign._id,
            status: 'completed'
          });
        } else if (campaign.type === 'exam') {
          completedCount = await db.collection('exam_sessions').countDocuments({
            campaignId: campaign._id,
            status: 'completed'
          });
        }

        return {
          ...campaign,
          completedCount
        };
      })
    );

    return NextResponse.json(campaignsWithStats);
  } catch (error) {
    console.error('GET mentor campaigns error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/b2b/mentor/campaigns
 * Creates a new practice campaign for a batch.
 */
export async function POST(request: Request) {
  try {
    const context = await getCurrentUserWithContext();
    if (!context || !context.isB2B || context.user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = context;
    const body = await request.json();
    const { title, type, batchId, startTime, endTime, durationMinutes, config } = body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (type !== 'interview' && type !== 'exam') {
      return NextResponse.json({ error: 'Type must be interview or exam' }, { status: 400 });
    }

    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }

    let batchObjectId: ObjectId;
    try {
      batchObjectId = new ObjectId(batchId);
    } catch {
      return NextResponse.json({ error: 'Invalid batchId format' }, { status: 400 });
    }

    // Verify batch existence and ownership
    const batch = await db.collection('batches').findOne({ _id: batchObjectId, mentorId: context.user._id });
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found or unauthorized' }, { status: 404 });
    }

    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'Start and end times are required' }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid start or end date format' }, { status: 400 });
    }

    if (start >= end) {
      return NextResponse.json({ error: 'Start time must be before end time' }, { status: 400 });
    }

    if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
      return NextResponse.json({ error: 'Duration minutes must be a positive number' }, { status: 400 });
    }

    // Prepare config
    const validatedConfig: any = {};
    if (config) {
      if (config.role) validatedConfig.role = String(config.role);
      if (config.difficulty !== undefined) validatedConfig.difficulty = Number(config.difficulty);
      if (config.tags) {
        validatedConfig.tags = Array.isArray(config.tags) ? config.tags.map(String) : [];
      }
    }

    const campaignDoc: PracticeCampaignDoc = {
      title,
      type,
      batchId: batchObjectId,
      startTime: start,
      endTime: end,
      durationMinutes,
      config: validatedConfig,
      createdAt: new Date()
    };

    const insertResult = await db.collection('practice_campaigns').insertOne(campaignDoc);

    return NextResponse.json({
      message: 'Campaign created successfully',
      campaign: { _id: insertResult.insertedId, ...campaignDoc }
    }, { status: 201 });
  } catch (error) {
    console.error('POST mentor campaigns error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
