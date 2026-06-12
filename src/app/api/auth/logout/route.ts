import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { findInstituteByUserId } from '@/lib/b2b/registry';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (token) {
    try {
      const [prefix, userId, sessionId] = token.split('|');

      if (prefix === 'token' && userId && sessionId) {
        const client = await clientPromise;

        // 1. Always clean from B2C database
        await client.db('aicoach').collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $pull: { sessions: { id: sessionId } } } as any
        );

        // 2. Check B2B registry and clean from the user's institute DB
        const result = await findInstituteByUserId(userId);
        if (result) {
          const instDb = client.db(result.institute.dbName);
          await instDb.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $pull: { sessions: { id: sessionId } } } as any
          );
        }
      }
    } catch (err) {
      console.error('Logout session cleanup error:', err);
    }
  }

  cookieStore.delete('auth_token');

  return NextResponse.json({ message: 'Logged out successfully' });
}
