import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { getCurrentUser } from '@/lib/auth';
import { getInterviewDb } from '@/lib/interview/session-store';
import { getLLMGateway } from '@/lib/interview/llm-gateway';
import { seedPool } from '@/lib/interview/cache-seeder';
import { bindSeeder, createMongoStore, createSession } from '@/lib/interview/orchestrator';
import type { OrchestratorError } from '@/lib/interview/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

/** Map a typed `OrchestratorError` to its HTTP status (design error table). */
function statusForError(error: OrchestratorError): number {
  switch (error.kind) {
    case 'validation_error':
      return 400;
    case 'authorization_error':
      return 403;
    case 'not_found':
      return 404;
    case 'seeding_failed':
      return 503;
    case 'evaluation_failed':
      return 502;
    case 'pool_exhausted':
      return 503;
    default:
      return 500;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    // 1. Authenticate — reject before any work
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const db = await getInterviewDb();
    const gateway = getLLMGateway();
    const candidateId = user._id.toString();

    // 2. Resolve target session and verify ownership
    const targetId = toObjectId(sessionId);
    if (!targetId) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }

    const targetSession = await db.collection('interview_sessions').findOne({ _id: targetId });
    if (!targetSession) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (targetSession.userId.toHexString() !== candidateId) {
      return NextResponse.json({ error: 'authorization_error' }, { status: 403 });
    }

    // 3. Resolve parent session
    const parentSessionId = targetSession.parentSessionId || targetSession._id;
    const parentSessionDoc = await db.collection('interview_sessions').findOne({ _id: parentSessionId });
    if (!parentSessionDoc) {
      return NextResponse.json({ error: 'Parent session not found' }, { status: 404 });
    }

    // 4. Rate limiting: max 2 retakes per 24 hours per session group
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const retakesCount = await db.collection('interview_sessions').countDocuments({
      parentSessionId: parentSessionDoc._id,
      createdAt: { $gte: twentyFourHoursAgo }
    });

    if (retakesCount >= 2) {
      return NextResponse.json(
        {
          error: 'rate_limit_exceeded',
          message: 'Maximum 2 retakes per 24 hours reached for this interview session group'
        },
        { status: 429 }
      );
    }

    // 5. Fetch all sessions in group to compute attempt number and next difficulty
    const sessionsInGroup = await db.collection('interview_sessions').find({
      $or: [
        { _id: parentSessionDoc._id },
        { parentSessionId: parentSessionDoc._id }
      ]
    }).toArray();

    let maxAttemptNumber = 1;
    for (const s of sessionsInGroup) {
      const att = s.attemptNumber ?? 1;
      if (att > maxAttemptNumber) {
        maxAttemptNumber = att;
      }
    }
    const nextAttemptNumber = maxAttemptNumber + 1;

    // 6. Find the previous completed attempt's report ciScore (if it exists)
    const completedSessions = sessionsInGroup.filter(s => s.status === 'completed');
    completedSessions.sort((a, b) => {
      const attA = a.attemptNumber ?? 0;
      const attB = b.attemptNumber ?? 0;
      return attB - attA;
    });

    let ciScore: number | null = null;
    for (const s of completedSessions) {
      const report = await db.collection('coaching_reports').findOne({
        sessionId: s._id,
        status: 'ready'
      });
      if (report && typeof report.ciScore === 'number') {
        ciScore = report.ciScore;
        break;
      }
    }

    // Map difficulty: < 60: 1, 60-80: 3, >80: 5; fallback to parent original starting difficulty
    let nextDifficulty = parentSessionDoc.config.difficulty;
    if (ciScore !== null) {
      if (ciScore < 60) {
        nextDifficulty = 1;
      } else if (ciScore <= 80) {
        nextDifficulty = 3;
      } else {
        nextDifficulty = 5;
      }
    }

    // 7. Invoke createSession orchestrator flow with the next attempt config
    const nextConfig = {
      role: parentSessionDoc.config.role,
      difficulty: nextDifficulty,
      durationMinutes: parentSessionDoc.config.durationMinutes,
      difficultyMin: parentSessionDoc.config.difficultyMin,
      difficultyMax: parentSessionDoc.config.difficultyMax,
      aiPersona: parentSessionDoc.config.aiPersona,
      sessionType: parentSessionDoc.config.sessionType || 'full',
      focusTags: parentSessionDoc.config.focusTags,
      institutionCode: parentSessionDoc.institutionCode,
      parentSessionId: parentSessionDoc._id.toHexString(),
      attemptNumber: nextAttemptNumber,
    };

    const result = await createSession(candidateId, nextConfig, {
      seed: bindSeeder(seedPool, db, gateway),
      store: createMongoStore(db),
    });

    if (!result.ok) {
      const status = statusForError(result.error);
      const message = 'message' in result.error ? result.error.message : undefined;
      return NextResponse.json(
        { error: result.error.kind, ...(message ? { message } : {}) },
        { status }
      );
    }

    if (user.batchId) {
      try {
        const sessionOid = new ObjectId(result.value.sessionId);
        const batchOid = new ObjectId(user.batchId);
        await db.collection('interview_sessions').updateOne(
          { _id: sessionOid },
          { $set: { batchId: batchOid } }
        );
      } catch (err) {
        console.error('Failed to set batchId on retaken interview session:', err);
      }
    }

    const created = await db.collection('interview_sessions').findOne({ _id: new ObjectId(result.value.sessionId) });
    const startedAt = created?.startedAt ?? created?.createdAt ?? null;
    const durationMinutes = created?.config.durationMinutes ?? 0;

    return NextResponse.json(
      {
        success: true,
        ...result.value,
        durationMinutes,
        startedAt: startedAt ? startedAt.toISOString() : null,
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Interview retake error:', error?.message);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error?.message },
      { status: 500 }
    );
  }
}
