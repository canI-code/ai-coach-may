import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export interface DBSelectorResult {
  db: any;
  dbName: string;
  user: any;
  isB2B: boolean;
}

/**
 * Returns the correct database instance ('aicoach' or 'aicoach_institutional')
 * by checking if the user exists in either database collection.
 */
export async function getDbForUser(userId: string | ObjectId): Promise<DBSelectorResult> {
  const client = await clientPromise;
  const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

  // 1. Check aicoach (B2C/Personal) database first
  const b2cDb = client.db('aicoach');
  const b2cUser = await b2cDb.collection('users').findOne({ _id: objectId });
  if (b2cUser) {
    return {
      db: b2cDb,
      dbName: 'aicoach',
      user: b2cUser,
      isB2B: false
    };
  }

  // 2. Check aicoach_institutional (B2B/Institutional) database
  const b2bDb = client.db('aicoach_institutional');
  const b2bUser = await b2bDb.collection('users').findOne({ _id: objectId });
  if (b2bUser) {
    return {
      db: b2bDb,
      dbName: 'aicoach_institutional',
      user: b2bUser,
      isB2B: true
    };
  }

  throw new Error(`User not found in any database (ID: ${objectId.toString()})`);
}
