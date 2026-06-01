import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';

// Transcription is disabled on the server path to bypass Groq AI and prevent lags/failures.
// The browser-native offline transcription via the Web Speech API is used instead.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/interview/transcribe
 *
 * Simple offline fallback endpoint that returns a success indicator.
 * Bypasses Groq completely to prevent live audio lags and rate limit issues.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true, 
      transcript: 'Offline fallback transcription placeholder' 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Interview transcribe fallback error:', message);
    return NextResponse.json(
      { error: 'Internal Server Error', message },
      { status: 500 },
    );
  }
}
