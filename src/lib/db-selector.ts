import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { findInstituteByUserId, getInstituteDbForUser } from '@/lib/b2b/registry';

export interface DBSelectorResult {
  db: any;
  dbName: string;
  user: any;
  isB2B: boolean;
  instituteId?: string;
}

/**
 * Returns the correct database instance for a given user.
 *
 * 1. Check the main `aicoach` (B2C) database first.
 * 2. If not found, use the B2B institute registry to locate the user's
 *    isolated institute database.
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
      isB2B: false,
    };
  }

  // 2. Check B2B institute registry for the user
  const result = await getInstituteDbForUser(objectId.toString());
  if (result) {
    const b2bUser = await result.db.collection('users').findOne({ _id: objectId });
    if (b2bUser) {
      return {
        db: result.db,
        dbName: result.institute.dbName,
        user: b2bUser,
        isB2B: true,
        instituteId: result.institute._id?.toString(),
      };
    }
  }

  throw new Error(`User not found in any database (ID: ${objectId.toString()})`);
}
