import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb, addUserToInstitute } from '@/lib/b2b/registry';
import { generatePassword } from '@/lib/b2b/utils';
import bcrypt from 'bcryptjs';

/**
 * GET /api/b2b/institution/mentors
 * Lists all mentors under this institution.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'institution') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const db = await getInstituteDb(result.institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const mentors = await db.collection('users').find(
      { role: 'mentor' },
      {
        projection: {
          password: 0, // never expose password
        },
      }
    ).sort({ createdAt: -1 }).toArray();

    // Fetch all mentees to calculate actual credit usage per mentor
    const mentees = await db.collection('users').find(
      { role: 'mentee' },
      { projection: { mentorId: 1, 'credits.used': 1 } }
    ).toArray();

    // Map mentee usage to mentors
    const usageByMentor: Record<string, number> = {};
    for (const mentee of mentees) {
      if (mentee.mentorId) {
        const mentorIdStr = mentee.mentorId.toString();
        usageByMentor[mentorIdStr] = (usageByMentor[mentorIdStr] || 0) + (mentee.credits?.used || 0);
      }
    }

    const mentorsWithUsage = mentors.map(m => ({
      ...m,
      menteesUsedCredits: usageByMentor[m._id.toString()] || 0
    }));

    return NextResponse.json(mentorsWithUsage);
  } catch (error) {
    console.error('Institution mentors list error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/b2b/institution/mentors
 * Creates a new mentor under this institution.
 * Body: { fullName, email, department?, year?, credits? }
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'institution') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) return NextResponse.json({ error: 'Institute not found' }, { status: 404 });

    const { institute } = result;
    const db = await getInstituteDb(institute._id!);
    if (!db) return NextResponse.json({ error: 'Database not available' }, { status: 500 });

    const body = await request.json();
    const { fullName, email, department, year, credits: allocatedCredits, phone } = body;

    if (!fullName || !email) {
      return NextResponse.json({ error: 'Full name and email are required' }, { status: 400 });
    }

    // Check duplicate email
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists in this institution' }, { status: 409 });
    }

    // Generate password
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    // Determine credits to assign
    const creditsToAllocate = allocatedCredits || 0;

    // If allocating credits, check institution rep has enough
    if (creditsToAllocate > 0) {
      const instUser = await db.collection('users').findOne({ role: 'institution' });
      const remaining = instUser?.credits?.remaining || 0;
      if (remaining < creditsToAllocate) {
        return NextResponse.json({
          error: `Insufficient credits. You have ${remaining} remaining but tried to allocate ${creditsToAllocate}.`,
        }, { status: 400 });
      }

      // Deduct from institution
      await db.collection('users').updateOne(
        { role: 'institution' },
        { $inc: { 'credits.remaining': -creditsToAllocate } }
      );
    }

    // Determine which portals to enable — inherit from institution plan
    const enabledPortals = institute.plan?.enabledPortals || [];

    const mentorDoc = {
      role: 'mentor' as const,
      fullName,
      email: email.toLowerCase(),
      phone: phone || '',
      password: passwordHash,
      rawPassword: plainPassword,
      collegeName: institute.collegeName,
      department: department || '',
      year: year || '',
      status: 'active' as const,
      credits: {
        allocated: creditsToAllocate,
        used: 0,
        remaining: creditsToAllocate,
      },
      enabledPortals,
      menteeCount: 0,
      batchIds: [],
      createdAt: new Date(),
      createdBy: user._id,
    };

    const insertResult = await db.collection('users').insertOne(mentorDoc);

    // Register in institute's userLookup
    await addUserToInstitute(institute._id!.toString(), insertResult.insertedId.toString(), 'mentor');

    return NextResponse.json({
      message: 'Mentor created successfully',
      mentor: {
        _id: insertResult.insertedId,
        fullName,
        email: email.toLowerCase(),
        department,
        year,
        credits: mentorDoc.credits,
      },
      credentials: {
        email: email.toLowerCase(),
        password: plainPassword,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Institution create mentor error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
