import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (token) {
    try {
      const [prefix, userId, sessionId] = token.split('|');
      
      if (prefix === 'token' && userId && sessionId) {
        const client = await clientPromise;
        
        // Remove from both potential databases to be thorough
        const dbs = ['aicoach', 'aicoach_institutional'];
        
        for (const dbName of dbs) {
          const db = client.db(dbName);
          await db.collection('users').updateOne(
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
