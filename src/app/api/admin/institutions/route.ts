import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('aicoach');

    const institutions = await db.collection('institutions').find({}).toArray();

    return NextResponse.json(institutions);
  } catch (error) {
    console.error('Admin Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
