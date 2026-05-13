import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('aicoach');

    const approved = await db.collection('institutions')
      .find({ status: 'approved' }, { projection: { collegeName: 1 } })
      .toArray();

    return NextResponse.json(approved);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch institutions' }, { status: 500 });
  }
}
