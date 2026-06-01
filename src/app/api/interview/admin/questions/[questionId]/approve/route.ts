import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCurrentUser } from '@/lib/auth';
import { approveQuestion, getInterviewDb } from '@/lib/interview/session-store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/interview/admin/questions/[questionId]/approve
 * Approves a pending question: flips status -> 'validated', is_validated -> true,
 * and stamps validatedAt / validatedBy. (Req 8.3)
 * Uses Next.js 16 async RouteContext params.
 */
export async function POST(
  _req: NextRequest,
  ctx: RouteContext<'/api/interview/admin/questions/[questionId]/approve'>,
) {
  try {
    const user = await getCurrentUser();
    // In production we would additionally check an admin role (e.g. user.role === 'admin').
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId } = await ctx.params;

    const approved = await approveQuestion(
      await getInterviewDb(),
      questionId,
      user._id as ObjectId,
    );

    if (!approved) {
      // No pending question matched the id (already validated, missing, or malformed id).
      return NextResponse.json(
        { error: 'Question not found or not pending' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, questionId, status: 'validated' });
  } catch (error: any) {
    console.error('Interview question approve error:', error?.message);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error?.message },
      { status: 500 },
    );
  }
}
