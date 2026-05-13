import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('aicoach');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await db.collection('users').updateOne(
      { email },
      { 
        $set: { 
          password: hashedPassword,
          sessions: [] // Discard old sessions after password reset for security
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Password updated successfully' });

  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
