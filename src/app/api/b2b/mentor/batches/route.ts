import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';
import { generateInviteCode } from '@/lib/b2b/utils';

/**
 * GET /api/b2b/mentor/batches
 * Lists all batches created by this mentor with overview analytics and invite details.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const batches = await db.collection('batches').find(
      { mentorId: user._id }
    ).sort({ createdAt: -1 }).toArray();

    // For each batch, get mentee count, health, credits and invite details
    const batchesWithAnalytics = await Promise.all(
      batches.map(async (batch) => {
        // Find mentees that belong to this batch
        const mentees = await db.collection('users').find({
          role: 'mentee',
          $or: [
            { batchId: batch._id },
            { batchIds: batch._id }
          ]
        }, { projection: { _id: 1, credits: 1 } }).toArray();

        const menteeCount = mentees.length;
        const menteeIds = mentees.map(m => m._id);

        // Calculate credits
        let totalAllocated = 0;
        let totalUsed = 0;
        let totalRemaining = 0;
        mentees.forEach(m => {
          totalAllocated += m.credits?.allocated || 0;
          totalUsed += m.credits?.used || 0;
          totalRemaining += m.credits?.remaining || 0;
        });

        // Calculate health
        let health = null;
        if (menteeIds.length > 0) {
          const stats = await db.collection('user_assessment_stats').find({ userId: { $in: menteeIds } }).toArray();
          const reports = await db.collection('coaching_reports').find({ userId: { $in: menteeIds } }).toArray();

          const avgAssessmentScore = stats.length > 0 ? stats.reduce((sum: number, s: any) => sum + (s.scorePercentage || 0), 0) / stats.length : 0;
          const avgConfidenceIndex = reports.length > 0 ? reports.reduce((sum: number, r: any) => sum + (r.confidenceIndex || r.overallScore || 0), 0) / reports.length : 0;

          if (stats.length > 0 && reports.length > 0) {
            health = Math.round((avgAssessmentScore + avgConfidenceIndex) / 2);
          } else if (stats.length > 0) {
            health = Math.round(avgAssessmentScore);
          } else if (reports.length > 0) {
            health = Math.round(avgConfidenceIndex);
          }
        }

        // Fetch or auto-generate invite code for this batch
        let inviteCodeDoc = await db.collection('invite_codes').findOne({
          mentorId: user._id,
          batchId: batch._id,
          status: 'active',
          expiresAt: { $gt: new Date() }
        });
        
        let inviteCode = inviteCodeDoc ? inviteCodeDoc.code : null;
        
        if (!inviteCode) {
          inviteCode = generateInviteCode();
          await db.collection('invite_codes').insertOne({
            code: inviteCode,
            mentorId: user._id,
            batchId: batch._id,
            instituteId: result.institute._id,
            collegeName: result.institute.collegeName,
            enabledPortals: user.enabledPortals || result.institute.plan?.enabledPortals || [],
            usedBy: [],
            maxUses: 100,
            status: 'active',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          });
        }
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const inviteLink = `${baseUrl}/join?code=${inviteCode}`;

        return {
          ...batch,
          menteeCount,
          health,
          credits: {
            allocated: totalAllocated,
            used: totalUsed,
            left: totalRemaining
          },
          inviteCode,
          inviteLink
        };
      })
    );

    return NextResponse.json(batchesWithAnalytics);
  } catch (error) {
    console.error('Mentor batches list error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/b2b/mentor/batches
 * Creates a new batch.
 * Body: { name, department?, year?, enabledPortals? }
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const { name, department, year, enabledPortals } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Batch name is required' }, { status: 400 });
    }

    // Inherit portal access from mentor's enabled portals if not specified
    const mentorPortals = user.enabledPortals || result.institute.plan?.enabledPortals || [];
    const batchPortals = enabledPortals || mentorPortals;

    const batch = {
      name,
      mentorId: user._id,
      department: department || user.department || '',
      year: year || '',
      enabledPortals: batchPortals,
      status: 'active',
      createdAt: new Date(),
    };

    const insertResult = await db.collection('batches').insertOne(batch);

    // Auto-generate invite code for the new batch
    const inviteCode = generateInviteCode();
    await db.collection('invite_codes').insertOne({
      code: inviteCode,
      mentorId: user._id,
      batchId: insertResult.insertedId,
      instituteId: result.institute._id,
      collegeName: result.institute.collegeName,
      enabledPortals: user.enabledPortals || result.institute.plan?.enabledPortals || [],
      usedBy: [],
      maxUses: 100,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    });

    return NextResponse.json({
      message: 'Batch created successfully',
      batch: { _id: insertResult.insertedId, ...batch, inviteCode },
    }, { status: 201 });
  } catch (error) {
    console.error('Mentor create batch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
