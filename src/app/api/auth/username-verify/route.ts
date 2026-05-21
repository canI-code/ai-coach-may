import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(req: Request) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Ensure username is a string and trim it
    const trimmedUsername = String(username).trim();
    if (!trimmedUsername) {
       return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB_NAME || 'aicoach');

    const existingUser = await db.collection('user_profile').findOne({ 
      username: { $regex: new RegExp(`^${trimmedUsername}$`, 'i') } 
    });

    return NextResponse.json({ exists: !!existingUser });
  } catch (error: any) {
    console.error('Username verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
