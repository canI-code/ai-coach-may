import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || (admin.role !== 'admin' && admin.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, reason } = await request.json();

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');

    const institution = await db.collection('institutions').findOne({ _id: new ObjectId(id) });

    if (!institution) {
      return NextResponse.json({ error: 'Institution not found' }, { status: 404 });
    }

    if (institution.status === 'approved') {
      return NextResponse.json({ error: 'Cannot reject an already approved partner' }, { status: 400 });
    }

    // Update status to rejected and log reason
    await db.collection('institutions').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'rejected', 
          rejectionReason: reason, 
          rejectedAt: new Date() 
        } 
      }
    );

    // Simulate sending email to mentor
    console.log(`✉️ [SIMULATED EMAIL] To: ${institution.mentorEmail}
Subject: AI Coach Prep - Institutional Registration Rejected
Body: Dear ${institution.mentorName},
Your request to register "${institution.collegeName}" on our B2B platform has been rejected for the following reason:
"${reason}"

If you believe this is an error or have resolved the issue, please submit a new request.
Best regards,
AI Prep Coach Administration`);

    return NextResponse.json({ message: 'Institution registration rejected, email notification simulated' });

  } catch (error: any) {
    console.error('Rejection Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
