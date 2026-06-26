/**
 * POST /api/interview/start — create an interview session, seed the Question_Pool,
 * and serve Turn 1.
 *
 * Task 21.1 scope (this file): authenticate via `getCurrentUser()`, associate the new
 * session with the authenticated candidate, wire the Interview_Orchestrator's
 * `createSession` to the live Cache_Seeder (`seedPool` via `bindSeeder`), the Mongo +
 * Redis store (`createMongoStore`), and the provider-agnostic LLM_Gateway, then map the
 * typed `OrchestratorError` kinds to HTTP statuses per the design's error table.
 *
 * Privacy boundary: the start request carries only the session configuration — no media.
 * Next.js 16: POST Route Handlers are uncached by default; this handler reads cookies and
 * MongoDB at request time (`force-dynamic`, Node.js runtime).
 *
 * Requirements: 1.1 (create `seeding` record), 1.2 (associate with authenticated
 *               candidate), 1.3 (reject missing/invalid config with no record),
 *               1.4 (seed + serve Turn 1 when the pool meets the minimum).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { getCurrentUser } from '@/lib/auth';
import { findSession, getInterviewDb } from '@/lib/interview/session-store';
import { getLLMGateway } from '@/lib/interview/llm-gateway';
import { seedPool } from '@/lib/interview/cache-seeder';
import { bindSeeder, createMongoStore, createSession } from '@/lib/interview/orchestrator';
import type { OrchestratorError } from '@/lib/interview/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Map a typed `OrchestratorError` to its HTTP status (design error table). */
function statusForError(error: OrchestratorError): number {
  switch (error.kind) {
    case 'validation_error':
      return 400; // Missing/invalid config — no session record created (Req 1.3).
    case 'authorization_error':
      return 403;
    case 'not_found':
      return 404;
    case 'seeding_failed':
      return 503; // Seeded pool below the minimum (Req 3.8, 24.4).
    case 'evaluation_failed':
      return 502;
    case 'pool_exhausted':
      return 503;
    default:
      return 500;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate — reject before any work (design error table, 401).
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Enforce B2B credit limits
    if (user.role === 'mentee') {
      const { checkCreditAvailable, deductCredit } = await import('@/lib/b2b/access');
      const { getDbForUser } = await import('@/lib/db-selector');
      const { db: userDb } = await getDbForUser(String(user._id));
      const creditCheck = await checkCreditAvailable(userDb, user._id, 'interview');
      if (!creditCheck.allowed) {
        return NextResponse.json({ error: 'limit_exceeded', message: creditCheck.reason }, { status: 403 });
      }
      await deductCredit(userDb, user._id, 'interview');
    }

    // 2. Parse the request body (the session configuration only — no media).
    let rawConfig: unknown;
    try {
      rawConfig = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // 3. Wire the orchestrator to the live seeder, store, and LLM gateway.
    const db = await getInterviewDb();
    const gateway = getLLMGateway();
    const candidateId = String((user._id as ObjectId));

    // 4. Create the session (validates config, writes `seeding`, seeds, serves Turn 1
    //    only when the pool meets the minimum — Req 1.1, 1.2, 1.3, 1.4).
    const result = await createSession(candidateId, rawConfig, {
      seed: bindSeeder(seedPool, db, gateway),
      store: createMongoStore(db),
    });

    if (!result.ok) {
      const status = statusForError(result.error);
      const message =
        'message' in result.error ? result.error.message : undefined;
      return NextResponse.json(
        { error: result.error.kind, ...(message ? { message } : {}) },
        { status },
      );
    }

    const parsedBody = rawConfig as any;
    const campaignId = parsedBody?.campaignId;
    let campaignOid: ObjectId | null = null;
    let campaignBatchOid: ObjectId | null = null;
    if (campaignId) {
      try {
        campaignOid = new ObjectId(campaignId);
        const campaign = await db.collection('practice_campaigns').findOne({ _id: campaignOid });
        if (campaign) {
          campaignBatchOid = campaign.batchId;
        }
      } catch (err) {
        console.error('Failed to parse campaignId:', err);
      }
    }

    if (campaignOid || user.batchId) {
      try {
        const sessionOid = new ObjectId(result.value.sessionId);
        const updateFields: any = {};
        if (campaignOid) updateFields.campaignId = campaignOid;

        const finalBatchId = campaignBatchOid || (user.batchId ? new ObjectId(user.batchId) : null);
        if (finalBatchId) updateFields.batchId = finalBatchId;

        if (Object.keys(updateFields).length > 0) {
          await db.collection('interview_sessions').updateOne(
            { _id: sessionOid },
            { $set: updateFields }
          );
        }
      } catch (err) {
        console.error('Failed to set campaignId/batchId on interview session:', err);
      }
    }

    // Augment Turn 1 with the timing fields the browser needs to drive the countdown
    // timer (the user-facing guide for a time-boxed interview). We intentionally do
    // NOT surface the backend `maxQuestions` cap so the candidate cannot pace
    // themselves to the threshold — the timer is the only progress signal they see.
    const created = await findSession(db, result.value.sessionId);
    const startedAt = created?.startedAt ?? created?.createdAt ?? null;
    const durationMinutes = created?.config.durationMinutes ?? 0;

    return NextResponse.json(
      {
        success: true,
        ...result.value,
        durationMinutes,
        startedAt: startedAt ? startedAt.toISOString() : null,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('Interview start error:', error?.message);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error?.message },
      { status: 500 },
    );
  }
}
