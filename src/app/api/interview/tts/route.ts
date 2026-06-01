import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { INTERVIEW_VOICE, synthesizeSpeech } from '@/lib/interview/tts';

// edge-tts uses a WebSocket — requires the Node.js runtime; never cached.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_TEXT = 2000;

/**
 * POST /api/interview/tts — synthesize interviewer question text to MP3 audio with the
 * en-IE-EmilyNeural voice. The client plays the returned audio; raw media never persists.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

  try {
    const audio = await synthesizeSpeech(text.slice(0, MAX_TEXT));
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-TTS-Voice': INTERVIEW_VOICE,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Interview TTS error:', message);
    return NextResponse.json({ error: 'tts_failed', message }, { status: 502 });
  }
}
