import { NextResponse } from 'next/server';
import { addUserToInstitute, getInstituteDb } from '@/lib/b2b/registry';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

import { getCurrentUser } from '@/lib/auth';

/**
 * POST /api/b2b/mentee/join
 * Mentee joins an institution via invite code.
 * Body: { code, fullName, email, password, phone, dob?, gender? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, password, dob, gender } = body;
    let { fullName, email, phone } = body;

    // Check if the user is already logged in
    const loggedInUser = await getCurrentUser().catch(() => null);
    if (loggedInUser) {
      if (!fullName) fullName = loggedInUser.fullName;
      if (!email) email = loggedInUser.email;
      if (!phone) phone = loggedInUser.phone;
    }

    if (!code || !fullName || !email || !password || !phone) {
      return NextResponse.json({ error: 'Missing required fields: code, fullName, email, password, phone' }, { status: 400 });
    }

    // Find the invite code across all institute databases
    // We need to search the registry for the institute that has this code
    const { getInstituteRegistry } = await import('@/lib/b2b/registry');
    const registry = await getInstituteRegistry();
    const institutes = await registry.find({ status: 'active' }).toArray();

    let foundCode: any = null;
    let foundDb: any = null;
    let foundInstitute: any = null;

    for (const inst of institutes) {
      const { default: clientPromise } = await import('@/lib/mongodb');
      const client = await clientPromise;
      const db = client.db(inst.dbName);
      const inviteCode = await db.collection('invite_codes').findOne({
        code: code.toUpperCase(),
        status: 'active',
        expiresAt: { $gt: new Date() },
      });
      if (inviteCode) {
        foundCode = inviteCode;
        foundDb = db;
        foundInstitute = inst;
        break;
      }
    }

    if (!foundCode || !foundDb || !foundInstitute) {
      return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 404 });
    }

    // Check max uses
    if (foundCode.usedBy.length >= foundCode.maxUses) {
      return NextResponse.json({ error: 'This invite code has reached maximum uses' }, { status: 400 });
    }

    // Check duplicate email in this institute's DB
    const existing = await foundDb.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.role !== 'mentee') {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
      }

      const match = await bcrypt.compare(password, existing.password);
      if (!match) {
        return NextResponse.json({ error: 'Incorrect password for this existing account' }, { status: 401 });
      }

      // Join new batch
      const currentBatchIds = existing.batchIds || (existing.batchId ? [existing.batchId] : []);
      const nextBatchId = foundCode.batchId;
      let updatedBatchIds = [...currentBatchIds];
      if (nextBatchId && !updatedBatchIds.some((id: any) => id.toString() === nextBatchId.toString())) {
        updatedBatchIds.push(nextBatchId);
      }

      await foundDb.collection('users').updateOne(
        { _id: existing._id },
        {
          $set: {
            batchId: nextBatchId || null,
            batchIds: updatedBatchIds,
            enabledPortals: Array.from(new Set([
              ...(existing.enabledPortals || []),
              ...(foundCode.enabledPortals || foundInstitute.plan?.enabledPortals || [])
            ]))
          }
        }
      );

      // Register in userLookup if not already there
      await addUserToInstitute(foundInstitute._id!.toString(), existing._id.toString(), 'mentee');

      // Mark invite code as used by this mentee
      await foundDb.collection('invite_codes').updateOne(
        { _id: foundCode._id },
        { $addToSet: { usedBy: existing._id } as any }
      );

      return NextResponse.json({
        message: 'Successfully joined the new batch! Redirecting to login...',
        collegeName: foundInstitute.collegeName,
      }, { status: 200 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const menteeDoc = {
      role: 'mentee' as const,
      fullName,
      email: email.toLowerCase(),
      phone,
      password: passwordHash,
      dob: dob || '',
      gender: gender || '',
      collegeName: foundInstitute.collegeName,
      mentorId: foundCode.mentorId,
      batchId: foundCode.batchId || null,
      status: 'active' as const,
      credits: {
        allocated: 0,
        used: 0,
        remaining: 0,
      },
      enabledPortals: foundCode.enabledPortals || foundInstitute.plan?.enabledPortals || [],
      inviteCode: code.toUpperCase(),
      createdAt: new Date(),
    };

    const insertResult = await foundDb.collection('users').insertOne(menteeDoc);

    // Register in institute's userLookup
    await addUserToInstitute(foundInstitute._id!.toString(), insertResult.insertedId.toString(), 'mentee');

    // Mark invite code as used by this mentee
    await foundDb.collection('invite_codes').updateOne(
      { _id: foundCode._id },
      { $push: { usedBy: insertResult.insertedId } as any }
    );

    // Also create a user_profile for the mentee (reusing B2C profile structure)
    await foundDb.collection('user_profile').insertOne({
      userId: insertResult.insertedId,
      fullName,
      email: email.toLowerCase(),
      phone,
      dob,
      gender,
      education: null,
      interests: [],
      completed: false,
      createdAt: new Date(),
    });

    return NextResponse.json({
      message: 'Registration successful! Please login to access your dashboard.',
      collegeName: foundInstitute.collegeName,
    }, { status: 201 });
  } catch (error) {
    console.error('Mentee join error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
