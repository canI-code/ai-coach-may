import { cookies } from 'next/headers';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { findInstituteByUserId, getInstituteDbForUser } from '@/lib/b2b/registry';

/**
 * Get the currently authenticated user from the auth cookie.
 *
 * Searches B2C (`aicoach`) first, then checks the B2B institute registry
 * to locate the user in their isolated institute database.
 */
export async function getCurrentUser() {
  try {
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

    // 1. Check B2C database first
    const b2cDb = client.db('aicoach');
    let user = await b2cDb.collection('users').findOne({
      _id: new ObjectId(userId),
      'sessions.id': sessionId,
    });

    if (user) return user;

    // 2. Check B2B institute databases via registry
    const result = await getInstituteDbForUser(userId);
    if (result) {
      user = await result.db.collection('users').findOne({
        _id: new ObjectId(userId),
        'sessions.id': sessionId,
      });
      if (user) return user;
    }

    console.error(`No user found for ID ${userId} and session ${sessionId}`);
    return null;
  } catch (err: any) {
    console.error('Auth check error:', err.message);
    return null;
  }
}

/**
 * Extended auth: returns the user along with database context.
 * Useful for B2B routes that need to know which institute DB to use.
 */
export async function getCurrentUserWithContext() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) return null;

    const [prefix, userId, sessionId] = token.split('|');
    if (prefix !== 'token' || !userId || !sessionId) return null;

    const client = await clientPromise;

    // 1. Check B2C
    const b2cDb = client.db('aicoach');
    let user = await b2cDb.collection('users').findOne({
      _id: new ObjectId(userId),
      'sessions.id': sessionId,
    });

    if (user) {
      return { user, db: b2cDb, dbName: 'aicoach', isB2B: false, instituteId: undefined };
    }

    // 2. Check B2B
    const result = await getInstituteDbForUser(userId);
    if (result) {
      user = await result.db.collection('users').findOne({
        _id: new ObjectId(userId),
        'sessions.id': sessionId,
      });
      if (user) {
        return {
          user,
          db: result.db,
          dbName: result.institute.dbName,
          isB2B: true,
          instituteId: result.institute._id?.toString(),
        };
      }
    }

    return null;
  } catch (err: any) {
    console.error('Auth context check error:', err.message);
    return null;
  }
}
