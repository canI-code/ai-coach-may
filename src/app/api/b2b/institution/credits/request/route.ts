import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteRegistry } from '@/lib/b2b/registry';

/**
 * POST /api/b2b/institution/credits/request
 * Institution requests more credits/time from admin.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'institution') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const { requestedCredits, requestedDuration, message } = await request.json();

    if (!requestedCredits || requestedCredits <= 0) {
      return NextResponse.json({ error: 'Requested credits must be greater than 0' }, { status: 400 });
    }

    const registry = await getInstituteRegistry();
    await registry.updateOne(
      { _id: result.institute._id },
      {
        $push: {
          creditRequests: {
            requestedCredits,
            requestedDuration: requestedDuration || '',
            message: message || '',
            status: 'pending',
            createdAt: new Date(),
          },
        } as any,
      }
    );

    return NextResponse.json({ message: 'Credit request submitted. Admin will review shortly.' });
  } catch (error) {
    console.error('Institution credit request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
