/**
 * POST /api/interview/[sessionId]/answer — the answer-submit HTTP moment.
 *
 * Task 21.1 scope (this file): authenticate via `getCurrentUser()` + ownership check,
 * validate the `AnswerSubmitPayload` with the strict Zod guard (rejecting any raw-media
 * field before any LLM/DB work — Req 15.1, 15.2, 15.3), run the Feedback_Orchestrator
 * (`evaluateTurn`) for per-turn feedback + adaptive difficulty, then select and serve the
 * next question — advancing Turns 2–6 from the pre-seeded pool (`advanceTurnForSession`)
 * and running the Q6-buffer / Q7 deep-dive race (`raceDeepDive`) on the index-5 submit
 * (Req 5, 24.1). Persists the current index + difficulty after the submit (Req 2.6) and
 * returns `{ feedback, nextQuestion, index, total }`. Typed errors map to HTTP statuses
 * per the design's error table.
 *
 * Active-question resolution invariant: for index ≥ 2, the question served at index `N`
 * lives at `session.pool[N − 2]`. Domain turns (indexes 2–5) consume the seeded pool in
 * order, and each deep-dive Turn (index ≥ 6) is written back into its `pool[N − 2]` slot
 * when served, so the next submit can resolve the active question deterministically
 * without an order-dependent rescan. Turn 1 (intro) and Turn 2 (templated follow-up)
 * carry no gold-standard answer and are reconstructed from the persisted Turn 1
 * transcript.
 *
 * Next.js 16: dynamic `[sessionId]` is awaited via the generated `RouteContext`; POST
 * Route Handlers are uncached by default (`force-dynamic`, Node.js runtime).
 *
 * Requirements: 1.x (lifecycle context), 2.5 (ownership), 12.1 (receive payload),
 *               15.1/15.2/15.3 (strict payload, reject media), 24.1 (loop never stalls).
 */

import { NextResponse, after } from 'next/server';
import type { NextRequest } from 'next/server';
import type { ObjectId } from 'mongodb';

import { getCurrentUser } from '@/lib/auth';
import {
  createReportStub,
  findSession,
  getInterviewDb,
  setPoolCache,
  updateSession,
} from '@/lib/interview/session-store';
import { getLLMGateway } from '@/lib/interview/llm-gateway';
import {
  TURN1_INTRO,
  TURN2_TEMPLATE,
  buildTurn1Intro,
  buildTurn2Template,
  advanceTurnForSession,
  buildTurn2,
  extractEntities,
} from '@/lib/interview/orchestrator';
import {
  createMongoFeedbackStore,
  evaluateTurn,
  type ActiveQuestion,
} from '@/lib/interview/feedback';
import {
  DEEP_DIVE_WINDOW,
  createMongoDeepDiveStore,
  raceDeepDive,
  slidingWindow,
} from '@/lib/interview/deep-dive';
import { isInterviewOver } from '@/lib/interview/duration';
import { runReportJob } from '@/lib/interview/report';
import { AnswerSubmitPayloadSchema } from '@/lib/interview/schemas';
import type {
  InterviewSessionDoc,
  PooledQuestion,
  QuestionEvaluation,
  ServedQuestion,
} from '@/lib/interview/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';



/**
 * Resolve the question the candidate just answered at `index` from persisted session
 * state. Turn 1 / Turn 2 are reconstructed (no gold-standard answer); domain and
 * deep-dive turns (index ≥ 2) are read from their `pool[index − 2]` slot. Returns
 * `null` when no question exists at that index (invalid/over-range submit).
 */
function resolveActiveQuestion(
  session: InterviewSessionDoc,
  index: number,
): ActiveQuestion | null {
  const isTargeted = session.config.sessionType === 'targeted';
  if (!isTargeted) {
    if (index <= 0) {
      return { id: 'intro', questionText: buildTurn1Intro(session.config.role), idealAnswer: '' };
    }
    if (index === 1) {
      const turn1 = session.turns.find((t) => t.index === 0);
      const text = buildTurn2(buildTurn2Template(session.config.role), extractEntities(turn1?.transcript ?? ''));
      return { id: 'turn2', questionText: text, idealAnswer: '' };
    }
  }
  const poolIdx = isTargeted ? index : index - 2;
  const pooled = session.pool[poolIdx];
  if (!pooled) return null;
  return {
    id: pooled.id,
    questionText: pooled.questionText,
    idealAnswer: pooled.idealAnswer,
  };
}

/** The next question to serve, plus an optional deep-dive question to persist in the pool. */
interface NextQuestionPlan {
  served: ServedQuestion | null; // null ⇒ the loop is complete (no further question)
  deepDiveQuestion?: PooledQuestion; // present only when a Turn ≥ 7 was produced
}

/**
 * Run the Q6-buffer / Q7 deep-dive race for the Turn served at `nextIndex` (Req 5, 24.1).
 * The buffer question is the one just answered (`activeQuestion`); the sliding window is
 * Q3–Q5 for the first deep dive (Req 5.2) and the two most recent answers afterwards
 * (Req 6.1). The exclusion passed in is the set of already-served real question ids, so
 * the pool fallback can still find an unserved question and generation avoids repeats.
 */
async function runDeepDive(
  session: InterviewSessionDoc,
  nextIndex: number,
  activeQuestion: ActiveQuestion,
  db: Awaited<ReturnType<typeof getInterviewDb>>,
): Promise<NextQuestionPlan | { error: 'pool_exhausted' }> {
  // Sliding-window transcripts feeding the generation context.
  const sorted = [...session.turns].sort((a, b) => a.index - b.index);
  const windowTranscripts = slidingWindow(
    sorted.map((t) => ({ transcript: t.transcript })),
    DEEP_DIVE_WINDOW,
  );

  // Already-served real question ids drive both the dedupe exclusion and pool fallback.
  const servedPoolIds = session.turns
    .filter((t) => t.index >= 2)
    .map((t) => t.questionId);

  const outcome = await raceDeepDive(
    {
      role: session.config.role,
      difficulty: session.currentDifficulty,
      persona: session.config.aiPersona,
      windowTranscripts,
      exclusion: servedPoolIds,
      bufferQuestionText: activeQuestion.questionText,
      pool: session.pool,
      gateway: getLLMGateway(),
    },
    { store: createMongoDeepDiveStore(db) },
  );

  if (!outcome.ok) {
    return { error: 'pool_exhausted' };
  }

  const served: ServedQuestion = {
    sessionId: session._id.toHexString(),
    questionText: outcome.value.question.questionText,
    currentQuestionIndex: nextIndex,
    totalQuestions: session.config.questionCount,
  };
  return { served, deepDiveQuestion: outcome.value.question };
}

/**
 * Pregenerate the next AI deep-dive question for targetIndex in the background.
 * Overwrites targetIndex - 2 in pool and updates exclusion list.
 */
async function pregenerateNextQuestion(sessionId: string, targetIndex: number) {
  try {
    const db = await getInterviewDb();
    const session = await findSession(db, sessionId);
    if (!session) return;

    const activeQuestion = resolveActiveQuestion(session, targetIndex - 1);
    if (!activeQuestion) return;

    const result = await runDeepDive(session, targetIndex, activeQuestion, db);
    if ('error' in result) {
      console.warn(`[Pregeneration] failed for index ${targetIndex}: pool_exhausted`);
      return;
    }

    if (result.deepDiveQuestion) {
      // Fetch latest state to prevent lost updates
      const latest = (await findSession(db, sessionId)) ?? session;
      const newPool = [...latest.pool];
      newPool[targetIndex - 2] = result.deepDiveQuestion;
      
      let newExclusion = latest.exclusion;
      if (!newExclusion.includes(result.deepDiveQuestion.id)) {
        newExclusion = [...newExclusion, result.deepDiveQuestion.id];
      }

      await updateSession(db, sessionId, {
        pool: newPool,
        exclusion: newExclusion,
      });
      await setPoolCache(sessionId, {
        pool: newPool,
        exclusion: newExclusion,
        currentQuestionIndex: latest.currentQuestionIndex,
        currentDifficulty: latest.currentDifficulty,
      });
      console.log(`[Pregeneration] Pre-generated Q${targetIndex} for session ${sessionId}`);
    }
  } catch (error: any) {
    console.error(`[Pregeneration] Error at index ${targetIndex}:`, error?.message);
  }
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/interview/[sessionId]/answer'>,
) {
  try {
    // 1. Authenticate — reject before any work (401).
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await ctx.params;
    const candidateId = String((user._id as ObjectId));

    // 2. Parse + strictly validate the payload — reject raw media before any LLM/DB
    //    work (Req 15.1, 15.2, 15.3). Strict schema rejects unknown/binary fields → 400.
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = AnswerSubmitPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return NextResponse.json({ error: 'validation_error', message }, { status: 400 });
    }
    const payload = parsed.data;

    // 3. Load the session; enforce ownership before any state change (Req 2.5 → 403).
    const db = await getInterviewDb();
    const session = await findSession(db, sessionId);
    if (!session) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (session.userId.toHexString() !== candidateId) {
      return NextResponse.json({ error: 'authorization_error' }, { status: 403 });
    }

    const totalQuestions = session.config.questionCount;

    // 4. Resolve the question being answered at the submitted index.
    const activeQuestion = resolveActiveQuestion(session, payload.questionIndex);
    if (!activeQuestion) {
      return NextResponse.json(
        { error: 'validation_error', message: 'invalid questionIndex' },
        { status: 400 },
      );
    }

    let questionOrigin: 'generated' | 'database' | 'cover' = 'database';
    const isTargeted = session.config.sessionType === 'targeted';
    if (!isTargeted && payload.questionIndex <= 1) {
      questionOrigin = 'cover';
    } else {
      const pooled = session.pool.find((p) => p.id === activeQuestion.id);
      if (pooled) {
        if (pooled.origin === 'generated') {
          questionOrigin = 'generated';
        } else if (pooled.origin === 'validated' || pooled.origin === 'pending') {
          questionOrigin = 'database';
        }
      }
    }

    // 5. Evaluate the answer + compute adaptive difficulty (Feedback_Orchestrator).
    const feedback = await evaluateTurn(
      {
        userId: candidateId,
        sessionId,
        payload,
        activeQuestion,
        persona: session.config.aiPersona,
        currentDifficulty: session.currentDifficulty,
        difficultyMin: session.config.difficultyMin,
        difficultyMax: session.config.difficultyMax,
        priorTurns: session.turns,
        questionOrigin,
      },
      { gateway: getLLMGateway(), store: createMongoFeedbackStore(db) },
    );

    if (!feedback.ok) {
      if (feedback.error.kind === 'validation_error') {
        return NextResponse.json(
          { error: 'validation_error', message: feedback.error.message },
          { status: 400 },
        );
      }
      // Per-turn evaluation failure — no feedback payload (Req 12.6 → 502).
      return NextResponse.json({ error: 'evaluation_failed' }, { status: 502 });
    }

    const evaluation: QuestionEvaluation = feedback.value.evaluation;
    const currentDifficulty = feedback.value.difficultyAfter;

    // 6. Re-read the session so the just-recorded turn is reflected before selecting next.
    const updated = (await findSession(db, sessionId)) ?? session;
    const nextIndex = payload.questionIndex + 1;

    // 6b. Check time/cap completion BEFORE selecting the next question.
    const completionCheck = isInterviewOver({
      startedAtMs: (updated.startedAt ?? updated.createdAt).getTime(),
      nowMs: Date.now(),
      durationMinutes: updated.config.durationMinutes,
      answeredCount: nextIndex,
      maxQuestions: updated.config.questionCount,
    });

    if (completionCheck.over) {
      // Finalize session exactly like /end route: stub report + schedule compilation.
      const reportObjectId = await createReportStub(db, {
        sessionId: updated._id,
        userId: updated.userId,
      });
      await updateSession(db, sessionId, {
        status: 'completed',
        reportId: reportObjectId,
        currentQuestionIndex: nextIndex,
        currentDifficulty,
      });
      after(() => runReportJob(db, sessionId));

      return NextResponse.json({
        success: true,
        complete: true,
        reason: completionCheck.reason,
        feedback: evaluation,
        nextQuestion: null,
        index: payload.questionIndex,
        total: totalQuestions,
        difficulty: currentDifficulty,
      });
    }

    let plan: NextQuestionPlan;

    if (isTargeted) {
      const advanced = advanceTurnForSession(updated, payload.questionIndex);
      if (!advanced.ok) {
        return NextResponse.json({ error: advanced.error.kind }, { status: 503 });
      }
      plan = {
        served: advanced.value.kind === 'question' ? advanced.value.served : null,
      };
    } else if (nextIndex >= 2) {
      if (nextIndex % 2 === 0) {
        // Even index >= 2: Cover question from pre-seeded database pool
        const advanced = advanceTurnForSession(updated, payload.questionIndex);
        if (!advanced.ok) {
          return NextResponse.json({ error: advanced.error.kind }, { status: 503 });
        }
        plan = {
          served: advanced.value.kind === 'question' ? advanced.value.served : null,
        };
        // Trigger background pre-generation of the next AI question (odd index)
        if (nextIndex + 1 < totalQuestions) {
          after(() => pregenerateNextQuestion(sessionId, nextIndex + 1));
        }
      } else {
        // Odd index >= 3: AI-generated question (retrieve from pre-generated pool slot or fall back)
        const pregenerated = updated.pool[nextIndex - 2];
        if (pregenerated && pregenerated.origin === 'generated') {
          plan = {
            served: {
              sessionId: updated._id.toHexString(),
              questionText: pregenerated.questionText,
              currentQuestionIndex: nextIndex,
              totalQuestions,
            },
            deepDiveQuestion: pregenerated,
          };
        } else {
          // Fallback to synchronous generation
          const result = await runDeepDive(updated, nextIndex, activeQuestion, db);
          if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: 503 });
          }
          plan = result;
        }
      }
    } else {
      // Intro and Templated follow-up
      const advanced = advanceTurnForSession(updated, payload.questionIndex);
      if (!advanced.ok) {
        return NextResponse.json({ error: advanced.error.kind }, { status: 503 });
      }
      plan = {
        served: advanced.value.kind === 'question' ? advanced.value.served : null,
      };
    }

    // 7. Persist the post-submit state (Req 2.6) and mirror the Redis pool cache.
    const persistedIndex = plan.served ? plan.served.currentQuestionIndex : nextIndex;
    let newPool = session.pool;
    let newExclusion = session.exclusion;

    if (plan.deepDiveQuestion) {
      // Write the served deep-dive question into its pool slot so the next submit can
      // resolve it, and record its id in the Exclusion_Array (Req 7.1).
      newPool = [...session.pool];
      newPool[persistedIndex - 2] = plan.deepDiveQuestion;
      if (!newExclusion.includes(plan.deepDiveQuestion.id)) {
        newExclusion = [...newExclusion, plan.deepDiveQuestion.id];
      }
    }

    await updateSession(db, sessionId, {
      currentQuestionIndex: persistedIndex,
      currentDifficulty,
      ...(plan.deepDiveQuestion ? { pool: newPool, exclusion: newExclusion } : {}),
    });
    await setPoolCache(sessionId, {
      pool: newPool,
      exclusion: newExclusion,
      currentQuestionIndex: persistedIndex,
      currentDifficulty,
    });

    // 8. Respond with feedback + the next question (Req 12.5).
    let nextTags: string[] = [];
    if (plan.served) {
      const idx = plan.served.currentQuestionIndex;
      if (!isTargeted) {
        if (idx === 0) {
          nextTags = ['Introduction'];
        } else if (idx === 1) {
          nextTags = ['Personalization', 'Follow-up', 'Project Experience'];
        } else if (plan.deepDiveQuestion) {
          nextTags = plan.deepDiveQuestion.tags;
        } else {
          const matched = updated.pool[idx - 2];
          nextTags = matched ? matched.tags : [];
        }
      } else {
        const matched = updated.pool[idx];
        nextTags = matched ? matched.tags : [];
      }
    }

    return NextResponse.json({
      success: true,
      feedback: evaluation,
      nextQuestion: plan.served ? plan.served.questionText : null,
      index: plan.served ? plan.served.currentQuestionIndex : payload.questionIndex,
      total: totalQuestions,
      complete: false,
      difficulty: currentDifficulty,
      role: updated.config.role,
      aiPersona: updated.config.aiPersona,
      tags: nextTags,
    });
  } catch (error: any) {
    console.error('Interview answer error:', error?.message);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error?.message },
      { status: 500 },
    );
  }
}
