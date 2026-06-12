import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getInstituteRegistry, updateInstituteCreditsUsed, getInstituteDb } from '@/lib/b2b/registry';
import { ObjectId } from 'mongodb';

/**
 * POST /api/admin/b2b/institutes/[id]/credits
 * Adds credits to an active institute's plan.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { amount } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const registry = await getInstituteRegistry();
    const institute = await registry.findOne({ _id: new ObjectId(id), status: 'active' });
    if (!institute) {
      return NextResponse.json({ error: 'Institute not found' }, { status: 404 });
    }

    // Add credits to institute plan
    await registry.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { 'plan.totalCredits': amount } }
    );

    // Also add credits to the institution rep user in their DB
    const instDb = await getInstituteDb(id);
    if (instDb) {
      await instDb.collection('users').updateOne(
        { role: 'institution' },
        {
          $inc: {
            'credits.allocated': amount,
            'credits.remaining': amount,
          },
        }
      );
    }

    return NextResponse.json({ 
      message: `Added ${amount} credits to ${institute.collegeName}`,
      newTotal: (institute.plan?.totalCredits || 0) + amount,
    });
  } catch (error) {
    console.error('Admin add credits error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
