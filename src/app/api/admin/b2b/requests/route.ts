import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listPendingInstitutes, listActiveInstitutes } from '@/lib/b2b/registry';

/**
 * GET /api/admin/b2b/requests
 * Lists all pending + active institute requests for the admin dashboard.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [pending, active] = await Promise.all([
      listPendingInstitutes(),
      listActiveInstitutes(),
    ]);

    return NextResponse.json([...pending, ...active]);
  } catch (error) {
    console.error('Admin B2B requests error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
