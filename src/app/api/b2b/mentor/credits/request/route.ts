import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';

/**
 * POST /api/b2b/mentor/credits/request
 * Mentor requests credits from the institution.
 * Body: { requestedCredits, menteeCount?, message? }
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

    const { requestedCredits, menteeCount, message } = await request.json();

    if (!requestedCredits || requestedCredits <= 0) {
      return NextResponse.json({ error: 'Requested credits must be greater than 0' }, { status: 400 });
    }

    await db.collection('credit_requests').insertOne({
      mentorId: user._id,
      mentorName: user.fullName || user.email,
      requestedCredits,
      menteeCount: menteeCount || 0,
      message: message || '',
      currentCredits: user.credits || { allocated: 0, used: 0, remaining: 0 },
      status: 'pending',
      createdAt: new Date(),
    });

    return NextResponse.json({ message: 'Credit request submitted to institution.' }, { status: 201 });
  } catch (error) {
    console.error('Mentor credit request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/b2b/mentor/credits/request
 * Lists all credit requests by this mentor.
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

    const requests = await db.collection('credit_requests').find(
      { mentorId: user._id }
    ).sort({ createdAt: -1 }).toArray();

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Mentor credit request list error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
