import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listActiveInstitutes } from '@/lib/b2b/registry';

/**
 * GET /api/admin/b2b/institutes
 * Lists all active institutes.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const institutes = await listActiveInstitutes();
    return NextResponse.json(institutes);
  } catch (error) {
    console.error('Admin B2B institutes error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
