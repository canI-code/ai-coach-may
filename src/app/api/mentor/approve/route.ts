import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { id, action } = await request.json(); // action: 'approve' | 'reject'
    const mentor = await getCurrentUser();
    
    if (!mentor || mentor.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');

    const mentee = await db.collection('users').findOne({ _id: new ObjectId(id) });
    if (!mentee || mentee.collegeName !== mentor.collegeName) {
      return NextResponse.json({ error: 'Mentee not found' }, { status: 404 });
    }

    if (action === 'reject') {
      await db.collection('users').deleteOne({ _id: new ObjectId(id) });
      return NextResponse.json({ message: 'Request rejected and removed' });
    }

    // Approve: Generate temp password and update status
    const tempPassword = 'Welcome' + Math.floor(1000 + Math.random() * 9000);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'approved', 
          password: hashedPassword,
          approvedBy: mentor._id,
          approvedAt: new Date()
        } 
      }
    );

    console.log(`[SIMULATION] Email sent to ${mentee.email}. Status: Approved. Temp Password: ${tempPassword}`);

    return NextResponse.json({ message: 'Mentee approved. Password generated.', tempPassword });

  } catch (error) {
    console.error('Approve Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
