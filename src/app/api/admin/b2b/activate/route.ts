import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  getInstituteRegistry,
  activateInstitute, 
  addUserToInstitute,
  type InstitutePlan 
} from '@/lib/b2b/registry';
import { createInstituteDatabase } from '@/lib/b2b/db-factory';
import { generateDbName, generatePassword } from '@/lib/b2b/utils';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import clientPromise from '@/lib/mongodb';

/**
 * POST /api/admin/b2b/activate
 * Activates a pending institute: creates its isolated database,
 * sets the plan, creates the institution rep user, and returns credentials.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { instituteId, totalCredits, duration, enabledPortals } = await request.json();

    if (!instituteId || !totalCredits || !duration || !enabledPortals?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the pending institute
    const registry = await getInstituteRegistry();
    const institute = await registry.findOne({ _id: new ObjectId(instituteId), status: 'pending' });
    if (!institute) {
      return NextResponse.json({ error: 'Institute not found or already activated' }, { status: 404 });
    }

    // Generate database name
    const dbName = generateDbName(institute.collegeName);

    // Update registry with dbName
    await registry.updateOne(
      { _id: new ObjectId(instituteId) },
      { $set: { dbName } }
    );

    // Create the institute's isolated database with all collections + indexes
    const instDb = await createInstituteDatabase(dbName);

    // Generate login credentials for the institution representative
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    // Create the plan
    const durationMs: Record<string, number> = {
      '3 months': 90 * 24 * 60 * 60 * 1000,
      '6 months': 180 * 24 * 60 * 60 * 1000,
      '1 year': 365 * 24 * 60 * 60 * 1000,
      '2 years': 730 * 24 * 60 * 60 * 1000,
    };

    const plan: InstitutePlan = {
      totalCredits,
      usedCredits: 0,
      enabledPortals,
      expiresAt: new Date(Date.now() + (durationMs[duration] || durationMs['1 year'])),
      duration,
    };

    // Activate in registry
    const activated = await activateInstitute(
      instituteId,
      plan,
      { email: institute.representativeEmail, passwordHash },
      user._id
    );

    if (!activated) {
      return NextResponse.json({ error: 'Failed to activate institute' }, { status: 500 });
    }

    // Create the institution rep user in the institute's database
    const instUser = {
      role: 'institution' as const,
      fullName: institute.representativeName,
      email: institute.representativeEmail,
      phone: institute.representativePhone,
      password: passwordHash,
      collegeName: institute.collegeName,
      status: 'active' as const,
      credits: {
        allocated: totalCredits,
        used: 0,
        remaining: totalCredits,
      },
      enabledPortals,
      mentorId: null,
      batchId: null,
      sessions: [],
      createdAt: new Date(),
      createdBy: user._id,
    };

    const insertResult = await instDb.collection('users').insertOne(instUser);

    // Register user in the institute's userLookup for fast auth resolution
    await addUserToInstitute(instituteId, insertResult.insertedId.toString(), 'institution');

    console.log(`✅ Institute "${institute.collegeName}" activated. DB: ${dbName}, User: ${insertResult.insertedId}`);

    return NextResponse.json({
      message: 'Institute activated successfully',
      dbName,
      credentials: {
        email: institute.representativeEmail,
        password: plainPassword, // Shown once — admin will share this
      },
    });
  } catch (error) {
    console.error('Admin B2B activate error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
