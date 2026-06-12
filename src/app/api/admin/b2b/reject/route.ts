import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rejectInstitute } from '@/lib/b2b/registry';

/**
 * POST /api/admin/b2b/reject
 * Rejects a pending institute request with a reason.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, reason } = await request.json();

    if (!id || !reason?.trim()) {
      return NextResponse.json({ error: 'Institute ID and rejection reason required' }, { status: 400 });
    }

    const rejected = await rejectInstitute(id, reason);
    if (!rejected) {
      return NextResponse.json({ error: 'Institute not found or already processed' }, { status: 404 });
    }

    // TODO: Send rejection email to representative (simulated for now)
    console.log(`[SIMULATION] Rejection email sent for institute ${id}: ${reason}`);

    return NextResponse.json({ message: 'Institute request rejected' });
  } catch (error) {
    console.error('Admin B2B reject error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
