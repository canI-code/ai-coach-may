import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mentor = await getCurrentUser();
    if (!mentor || mentor.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      fullName: mentor.fullName,
      email: mentor.email,
      role: mentor.role,
      collegeName: mentor.collegeName,
      phone: mentor.phone || '',
      dob: mentor.dob || '',
      gender: mentor.gender || '',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const mentor = await getCurrentUser();
    if (!mentor || mentor.role !== 'mentor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fullName, phone, dob, gender, password } = body;

    const client = await clientPromise;
    const db = client.db('aicoach_institutional');

    const updateDoc: any = {};
    if (fullName) updateDoc.fullName = fullName;
    if (phone) updateDoc.phone = phone;
    if (dob) updateDoc.dob = dob;
    if (gender) updateDoc.gender = gender;
    
    if (password && password.trim().length > 0) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      updateDoc.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updateDoc).length === 0) {
      return NextResponse.json({ message: 'No changes to update' });
    }

    await db.collection('users').updateOne(
      { email: mentor.email, role: 'mentor' },
      { $set: updateDoc }
    );

    return NextResponse.json({ message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Mentor profile update error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
