import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findInstituteByUserId, getInstituteDb } from '@/lib/b2b/registry';

/**
 * GET /api/b2b/institution/profile
 * Returns the institution rep's profile and plan info.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'institution') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await findInstituteByUserId(user._id.toString());
    if (!result) {
      return NextResponse.json({ error: 'Institute not found' }, { status: 404 });
    }

    const { institute } = result;

    // Calculate actual credits used across all mentees in the tenant DB
    const db = await getInstituteDb(institute._id!);
    let actualCreditsUsed = 0;
    if (db) {
      const allMentees = await db.collection('users').find({ role: 'mentee' }, { projection: { 'credits.used': 1 } }).toArray();
      actualCreditsUsed = allMentees.reduce((sum, mentee) => sum + (mentee.credits?.used || 0), 0);
    }

    const plan = {
      ...institute.plan,
      usedCredits: actualCreditsUsed
    };

    return NextResponse.json({
      collegeName: institute.collegeName,
      location: institute.location,
      representativeName: institute.representativeName,
      representativeEmail: institute.representativeEmail,
      representativePhone: institute.representativePhone,
      plan: plan,
      dbName: institute.dbName,
      activatedAt: institute.activatedAt,
      status: institute.status,
      branding: institute.branding || null,
      documents: institute.documents || null,
    });
  } catch (error) {
    console.error('Institution profile error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
