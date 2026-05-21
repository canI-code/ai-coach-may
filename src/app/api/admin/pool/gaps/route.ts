import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { GapAnalyzer } from '@/lib/pool-warmer/gap-analyzer';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gaps = await GapAnalyzer.analyzeGaps();

    return NextResponse.json({
      success: true,
      count: gaps.length,
      gaps: gaps.slice(0, 50) // Return top 50 gaps
    });

  } catch (error: any) {
    console.error('Admin Pool Gaps Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
