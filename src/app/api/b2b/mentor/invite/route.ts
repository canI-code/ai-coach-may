import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { generateInviteCode } from '@/lib/b2b/utils';
import { ObjectId } from 'mongodb';

/**
 * POST /api/b2b/mentor/invite
 * Generates an invite code or link for mentees to join under this mentor.
 * Body: { batchId? }
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

    const body = await request.json().catch(() => ({}));
    const batchId = body.batchId ? new ObjectId(body.batchId) : null;

    const code = generateInviteCode();

    await db.collection('invite_codes').insertOne({
      code,
      mentorId: user._id,
      batchId,
      instituteId: result.institute._id,
      collegeName: result.institute.collegeName,
      enabledPortals: user.enabledPortals || result.institute.plan?.enabledPortals || [],
      usedBy: [],
      maxUses: 100,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Build invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/join?code=${code}`;

    return NextResponse.json({
      code,
      inviteLink,
      expiresIn: '30 days',
    }, { status: 201 });
  } catch (error) {
    console.error('Mentor invite error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/b2b/mentor/invite
 * Lists all active invite codes for this mentor.
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

    const codes = await db.collection('invite_codes').find(
      { mentorId: user._id }
    ).sort({ createdAt: -1 }).toArray();

    return NextResponse.json(codes);
  } catch (error) {
    console.error('Mentor invite list error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
