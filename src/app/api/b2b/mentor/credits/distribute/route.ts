import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';
import { allocateCredits, distributeCreditsEqually } from '@/lib/b2b/access';

/**
 * POST /api/b2b/mentor/credits/distribute
 * Distribute credits from mentor to mentees.
 * Body: { mode: 'equal' | 'manual', totalAmount?, mentees?: [{ id, amount }] }
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

    const body = await request.json();
    const { mode, totalAmount, mentees: menteeAllocations } = body;

    if (mode === 'equal') {
      // Distribute equally to all active mentees under this mentor
      if (!totalAmount || totalAmount <= 0) {
        return NextResponse.json({ error: 'Total amount must be greater than 0' }, { status: 400 });
      }

      const mentees = await db.collection('users').find(
        { mentorId: user._id, role: 'mentee', status: 'active' }
      ).toArray();

      if (mentees.length === 0) {
        return NextResponse.json({ error: 'No active mentees found' }, { status: 400 });
      }

      const menteeIds = mentees.map(m => m._id);
      const result = await distributeCreditsEqually(db, user._id, menteeIds, totalAmount);

      if (!result.success) {
        return NextResponse.json({ error: result.reason }, { status: 400 });
      }

      return NextResponse.json({
        message: `Distributed ${result.perUser} credits to each of ${mentees.length} mentees`,
        perUser: result.perUser,
        totalMentees: mentees.length,
      });
    } else if (mode === 'manual') {
      // Manual per-mentee allocation
      if (!menteeAllocations || !Array.isArray(menteeAllocations) || menteeAllocations.length === 0) {
        return NextResponse.json({ error: 'Mentee allocations required for manual mode' }, { status: 400 });
      }

      const results = [];
      for (const { id, amount } of menteeAllocations) {
        if (!id || !amount || amount <= 0) continue;
        const r = await allocateCredits(db, user._id, id, amount);
        results.push({ menteeId: id, amount, ...r });
      }

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        return NextResponse.json({
          message: `${results.length - failed.length}/${results.length} allocations succeeded`,
          results,
        }, { status: 207 });
      }

      return NextResponse.json({
        message: `All ${results.length} allocations succeeded`,
        results,
      });
    } else {
      return NextResponse.json({ error: "Invalid mode. Use 'equal' or 'manual'." }, { status: 400 });
    }
  } catch (error) {
    console.error('Mentor credit distribute error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
