import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ProficiencyEngine } from '@/lib/proficiency/proficiency-engine';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await ProficiencyEngine.getUserProficiency(user._id);

    return NextResponse.json({
      success: true,
      profile
    });
  } catch (error: any) {
    console.error('Fetch User Proficiency Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
