/**
 * B2B Institute Registry — Central registry mapping institute IDs to their
 * isolated MongoDB databases.
 *
 * The `institute_registry` collection lives in the main `aicoach` database
 * and is the single source of truth for all B2B institute metadata.
 */

import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { Collection, Db } from 'mongodb';

// ── Types ────────────────────────────────────────────────────────────────────

export interface InstitutePlan {
  totalCredits: number;
  usedCredits: number;
  enabledPortals: ('interview' | 'exam' | 'recommendation' | 'resume')[];
  expiresAt: Date | null;
  duration: string; // e.g. "1 year"
}

export interface InstituteDocuments {
  documentType: string;
  documentName: string;
  aadhaarNumber?: string;
  aadhaarLocalPath?: string;
  documentLocalPath?: string;
  selfieLocalPath?: string;
}

export interface InstituteBranding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  welcomeBannerText?: string;
}

export interface InstituteRegistryDoc {
  _id?: ObjectId;
  collegeName: string;
  dbName: string; // e.g. "aicoach_inst_iit_delhi"
  location: string;
  status: 'pending' | 'active' | 'suspended';
  plan: InstitutePlan;
  representativeEmail: string;
  representativePhone: string;
  representativeName: string;
  documents: InstituteDocuments;
  websiteUrl?: string;
  consent?: boolean;
  loginCredentials?: {
    email: string;
    passwordHash: string;
  };
  /** Maps user ObjectId strings → role for fast lookup */
  userLookup: Record<string, 'institution' | 'mentor' | 'mentee'>;
  createdAt: Date;
  activatedAt: Date | null;
  createdBy: ObjectId | null; // admin who activated
  branding?: InstituteBranding;
  departments?: string[];
}

// ── Collection accessor ──────────────────────────────────────────────────────

export async function getInstituteRegistry(): Promise<Collection<InstituteRegistryDoc>> {
  const client = await clientPromise;
  return client.db('aicoach').collection<InstituteRegistryDoc>('institute_registry');
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get the MongoDB Db handle for a specific institute by its registry _id. */
export async function getInstituteDb(instituteId: string | ObjectId): Promise<Db | null> {
  const registry = await getInstituteRegistry();
  const objectId = typeof instituteId === 'string' ? new ObjectId(instituteId) : instituteId;
  const doc = await registry.findOne({ _id: objectId, status: 'active' });
  if (!doc) return null;
  const client = await clientPromise;
  return client.db(doc.dbName);
}

/** Get institute registry doc by its database name. */
export async function getInstituteByDbName(dbName: string): Promise<InstituteRegistryDoc | null> {
  const registry = await getInstituteRegistry();
  return registry.findOne({ dbName });
}

/** Find which institute a user belongs to using the userLookup map. */
export async function findInstituteByUserId(
  userId: string
): Promise<{ institute: InstituteRegistryDoc; role: 'institution' | 'mentor' | 'mentee' } | null> {
  const registry = await getInstituteRegistry();
  const key = `userLookup.${userId}`;
  const doc = await registry.findOne({ [key]: { $exists: true } });
  if (!doc) return null;
  return { institute: doc, role: doc.userLookup[userId] };
}

/** Get the Db handle for a user's institute (combines findInstituteByUserId + getInstituteDb). */
export async function getInstituteDbForUser(
  userId: string
): Promise<{ db: Db; institute: InstituteRegistryDoc; role: 'institution' | 'mentor' | 'mentee' } | null> {
  const result = await findInstituteByUserId(userId);
  if (!result) return null;
  const client = await clientPromise;
  const db = client.db(result.institute.dbName);
  return { db, institute: result.institute, role: result.role };
}

/** List all active institutes. */
export async function listActiveInstitutes(): Promise<InstituteRegistryDoc[]> {
  const registry = await getInstituteRegistry();
  return registry.find({ status: 'active' }).sort({ activatedAt: -1 }).toArray();
}

/** List all pending institute requests. */
export async function listPendingInstitutes(): Promise<InstituteRegistryDoc[]> {
  const registry = await getInstituteRegistry();
  return registry.find({ status: 'pending' }).sort({ createdAt: -1 }).toArray();
}

/** Register a new institute request (status = 'pending'). */
export async function registerInstitute(
  data: Omit<InstituteRegistryDoc, '_id' | 'status' | 'plan' | 'userLookup' | 'activatedAt' | 'createdBy' | 'loginCredentials'>
): Promise<ObjectId> {
  const registry = await getInstituteRegistry();
  const doc: InstituteRegistryDoc = {
    ...data,
    status: 'pending',
    plan: {
      totalCredits: 0,
      usedCredits: 0,
      enabledPortals: [],
      expiresAt: null,
      duration: '',
    },
    userLookup: {},
    activatedAt: null,
    createdBy: null,
  };
  const result = await registry.insertOne(doc);
  return result.insertedId;
}

/** Activate an institute: set plan, mark active, store activation metadata. */
export async function activateInstitute(
  instituteId: string | ObjectId,
  plan: InstitutePlan,
  loginCredentials: { email: string; passwordHash: string },
  adminId: ObjectId
): Promise<boolean> {
  const registry = await getInstituteRegistry();
  const objectId = typeof instituteId === 'string' ? new ObjectId(instituteId) : instituteId;
  const result = await registry.updateOne(
    { _id: objectId, status: 'pending' },
    {
      $set: {
        status: 'active',
        plan,
        loginCredentials,
        activatedAt: new Date(),
        createdBy: adminId,
      },
    }
  );
  return result.modifiedCount === 1;
}

/** Reject an institute request. */
export async function rejectInstitute(
  instituteId: string | ObjectId,
  reason: string
): Promise<boolean> {
  const registry = await getInstituteRegistry();
  const objectId = typeof instituteId === 'string' ? new ObjectId(instituteId) : instituteId;
  const result = await registry.updateOne(
    { _id: objectId, status: 'pending' },
    {
      $set: {
        status: 'suspended' as const,
        rejectionReason: reason,
        rejectedAt: new Date(),
      },
    }
  );
  return result.modifiedCount === 1;
}

/** Add a user to an institute's lookup map. */
export async function addUserToInstitute(
  instituteId: string | ObjectId,
  userId: string,
  role: 'institution' | 'mentor' | 'mentee'
): Promise<void> {
  const registry = await getInstituteRegistry();
  const objectId = typeof instituteId === 'string' ? new ObjectId(instituteId) : instituteId;
  await registry.updateOne(
    { _id: objectId },
    { $set: { [`userLookup.${userId}`]: role } }
  );
}

/** Remove a user from an institute's lookup map. */
export async function removeUserFromInstitute(
  instituteId: string | ObjectId,
  userId: string
): Promise<void> {
  const registry = await getInstituteRegistry();
  const objectId = typeof instituteId === 'string' ? new ObjectId(instituteId) : instituteId;
  await registry.updateOne(
    { _id: objectId },
    { $unset: { [`userLookup.${userId}`]: '' } }
  );
}

/** Update credits used in an institute's plan. */
export async function updateInstituteCreditsUsed(
  instituteId: string | ObjectId,
  increment: number
): Promise<void> {
  const registry = await getInstituteRegistry();
  const objectId = typeof instituteId === 'string' ? new ObjectId(instituteId) : instituteId;
  await registry.updateOne(
    { _id: objectId },
    { $inc: { 'plan.usedCredits': increment } }
  );
}
