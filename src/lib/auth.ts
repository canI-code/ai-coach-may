import { cookies } from 'next/headers';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function getCurrentUser() {
  try {
    if (process.env.TEST_USER_ID) {
      const client = await clientPromise;
      const db = client.db('aicoach');
      return await db.collection('users').findOne({ _id: new ObjectId(process.env.TEST_USER_ID) });
    }
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) return null;

    // Use pipe '|' as a safer separator since IDs might contain underscores
    const [prefix, userId, sessionId] = token.split('|');

    if (prefix !== 'token' || !userId || !sessionId) {
      console.error('Invalid token format');
      return null;
    }

    const client = await clientPromise;
    const db = client.db('aicoach');

    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(userId),
      'sessions.id': sessionId 
    });

    if (!user) {
      console.error(`No user found for ID ${userId} and session ${sessionId}`);
      return null;
    }

    return user;
  } catch (err: any) {
    console.error('Auth check error:', err.message);
    return null;
  }
}
