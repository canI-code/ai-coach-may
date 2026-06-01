/**
 * Feedback_Orchestrator — per-turn answer evaluation and adaptive difficulty.
 *
 * Task 19.1 scope (this file): `evaluateTurn`, `movingAverage`, and `applyDifficulty`.
 *
 *  - Validate the incoming `AnswerSubmitPayload` with the strict Zod guard so raw
 *    media never reaches the backend or the LLM (Req 12.1, 15.3, 15.4).
 *  - Compute moving averages for WPM, eye-contact, and posture from the submitted
 *    metric arrays (Req 12.2, Property 25).
 *  - Build the evaluation Sandwich Prompt (active question text + ideal gold-standard
 *    answer + aggregated numeric metrics + compressed prior-turn scoring history) and
 *    dispatch it through the LLM_Gateway, validating the response with the Schema_Shield
 *    (Req 12.3, 12.4).
 *  - On a validated result, apply adaptive difficulty within the configured bounds,
 *    persist the turn metrics and the clamped difficulty to `interview_sessions`, and
 *    return the feedback payload (Req 12.5, 12.7, 14.1–14.6).
 *  - On a Schema_Shield failure, return a typed `evaluation_failed` error and NO
 *    feedback payload (Req 12.6, Property 27).
 *  - The v1 `Tier_Gate` grants full access, so feedback / strengths / improvements are
 *    always included (Req 22.2, 22.3).
 *
 * I/O is decoupled behind injectable seams (`gateway`, `store`) following the same
 * pattern as `orchestrator.ts` / `cache-seeder.ts`, so the pure logic stays testable
 * without a live LLM or MongoDB. `applyDifficulty` and `movingAverage` are pure and are
 * property-tested in isolation (Properties 25, 30). The main answer route (task 21.1)
 * wires the live gateway + store via `createMongoFeedbackStore` and binds the next
 * question selection / index persistence on top.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7,
 *               14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 22.2, 22.3
 */

import type { Db } from 'mongodb';

import { getLLMGateway, type LLMGateway } from './llm-gateway';
import { buildEvaluationPrompt, type TurnScoreSummary } from './prompt-builder';
import { validateWithShield } from './schema-shield';
import { tierGate } from './tier-gate';
import { findSession, updateSession } from './session-store';
import { movingAverage } from './browser/metrics';
import { AnswerSubmitPayloadSchema, QuestionEvaluationSchema } from './schemas';
import type {
  AnswerSubmitPayload,
  Persona,
  QuestionEvaluation,
  Result,
  TurnRecord,
} from './schemas';

// Re-export the single `movingAverage` implementation (pure metric math lives in
// `browser/metrics.ts`; it is browser-independent and safe to use server-side) so this
// module exposes the `feedback.ts` surface declared in the design (Req 12.2).
export { movingAverage };

// ── Difficulty step ───────────────────────────────────────────────────────────

/** Adaptive difficulty adjusts by a single step per turn; clamped to the bounds. */
const DIFFICULTY_STEP = 1;

/** The difficulty adjustment signal produced by a validated evaluation. */
export type DifficultyAdjustment = QuestionEvaluation['difficultyAdjustment'];

/**
 * Apply an adaptive difficulty adjustment, constrained to the configured bounds
 * (Req 14.1, 14.2, 14.3, 14.5, 14.6, Property 30).
 *
 *  - `same`     → identity: returns `current` unchanged, with no clamping, so the
 *                 before/after values are always equal (Req 14.3, Property 30).
 *  - `increase` → `current + step`, clamped into `[min, max]` (Req 14.1, 14.5).
 *  - `decrease` → `current - step`, clamped into `[min, max]` (Req 14.2, 14.5).
 *
 * When the configured minimum and maximum are equal, any increase/decrease clamps back
 * to that single value, leaving the difficulty effectively unchanged (Req 14.6). Bounds
 * supplied in either order are normalized.
 */
export function applyDifficulty(
  current: number,
  adjustment: DifficultyAdjustment,
  min: number,
  max: number,
): number {
  if (adjustment === 'same') return current;

  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const delta = adjustment === 'increase' ? DIFFICULTY_STEP : -DIFFICULTY_STEP;
  return Math.min(hi, Math.max(lo, current + delta));
}

/**
 * Derive the difficulty adjustment DETERMINISTICALLY from the validated evaluation
 * scores rather than trusting the LLM's self-reported `difficultyAdjustment` field
 * (Req 14.1, 14.2, 14.3). In practice the model reliably scores the answer but
 * frequently returns `'same'` regardless of those scores, leaving the adaptive loop
 * inert. Computing the signal in code from `technicalAccuracy` + `communication`
 * guarantees the interview actually adapts:
 *
 *  - `increase` when the candidate performed strongly (both >= 75).
 *  - `decrease` when the candidate struggled (either < 50).
 *  - `same` otherwise.
 *
 * The thresholds mirror the rubric stated in the evaluation prompt so the in-code
 * decision and the model's reasoning stay aligned.
 */
export function deriveDifficultyAdjustment(
  evaluation: Pick<QuestionEvaluation, 'technicalAccuracy' | 'communication'>,
): DifficultyAdjustment {
  const { technicalAccuracy, communication } = evaluation;
  if (technicalAccuracy >= 75 && communication >= 75) return 'increase';
  if (technicalAccuracy < 50 || communication < 50) return 'decrease';
  return 'same';
}

// ── Prior-turn scoring history ─────────────────────────────────────────────────

/**
 * Compress the prior answered turns into the numeric scoring history fed to the
 * evaluation prompt (Req 12.3). Turns without a validated evaluation (e.g. an earlier
 * Schema_Shield failure) carry no scores and are omitted.
 */
export function summarizePriorTurns(turns: TurnRecord[]): TurnScoreSummary[] {
  const summaries: TurnScoreSummary[] = [];
  for (const turn of turns) {
    if (!turn.evaluation) continue;
    summaries.push({
      index: turn.index,
      technicalAccuracy: turn.evaluation.technicalAccuracy,
      communication: turn.evaluation.communication,
      voiceCi: turn.evaluation.voiceCi,
      bodyCi: turn.evaluation.bodyCi,
    });
  }
  return summaries;
}

// ── Persistence seam ────────────────────────────────────────────────────────────

/** Persistence operations `evaluateTurn` needs. Decoupled for testability. */
export interface FeedbackStore {
  /**
   * Append the evaluated turn to `interview_sessions.turns` and persist the clamped
   * current difficulty in a single update (Req 12.5, 14.4). Mongo is the source of
   * truth; the answer route mirrors the Redis pool cache via the orchestrator.
   */
  persistTurn(sessionId: string, turn: TurnRecord, currentDifficulty: number): Promise<void>;
}

/**
 * Production `FeedbackStore` built from the `session-store` helpers and a live `Db`.
 * Reads the session to append to its existing `turns` array (the Redis wrapper exposes
 * only JSON get/set, and the session document is the authoritative turn log).
 */
export function createMongoFeedbackStore(db: Db): FeedbackStore {
  return {
    async persistTurn(sessionId, turn, currentDifficulty) {
      const session = await findSession(db, sessionId);
      const turns = session ? [...session.turns, turn] : [turn];
      await updateSession(db, sessionId, { turns, currentDifficulty });
    },
  };
}

// ── evaluateTurn ──────────────────────────────────────────────────────────────

/** The active question being answered this turn. */
export interface ActiveQuestion {
  id: string;
  questionText: string;
  idealAnswer: string;
}

export interface EvaluateTurnArgs {
  /** Authenticated candidate id — routed through the v1 `Tier_Gate` (Req 22). */
  userId: string;
  /** Session whose turn log and difficulty are updated on success. */
  sessionId: string;
  /** Untrusted `AnswerSubmitPayload`; validated by the strict schema before use. */
  payload: unknown;
  /** The question being evaluated (text + gold-standard ideal answer). */
  activeQuestion: ActiveQuestion;
  /** Interviewer persona, woven into the evaluation prompt. */
  persona: Persona;
  /** Difficulty before this turn's adjustment. */
  currentDifficulty: number;
  /** Configured difficulty bounds; adjustments are clamped within them (Req 14.5). */
  difficultyMin: number;
  difficultyMax: number;
  /** Prior answered turns, compressed into the prompt's scoring history (Req 12.3). */
  priorTurns: TurnRecord[];
  /** Origin tag indicating if question was AI generated, DB retrieved, or template. */
  questionOrigin?: 'generated' | 'database' | 'cover';
}

export interface EvaluateTurnDeps {
  /** LLM call site; defaults to the configured provider gateway. */
  gateway?: LLMGateway;
  /** Persistence seam (Mongo in production). */
  store: FeedbackStore;
  /** Clock injection for deterministic timestamps in tests. */
  now?: () => Date;
  /** Forwarded to the Schema_Shield (default 3 re-prompts → ≤4 total LLM calls). */
  maxRetries?: number;
}

/** Moving averages computed from the submitted metric arrays (Req 12.2). */
export interface MovingAverages {
  wpm: number;
  eyeContact: number;
  posture: number;
}

/**
 * Successful per-turn feedback. The `evaluation` is the validated, schema-bounded
 * `QuestionEvaluation` returned to the candidate (Req 12.7); `difficultyAfter` is the
 * clamped difficulty persisted for the next question selection; `movingAverages` are
 * the aggregated speech/vision metrics.
 */
export interface TurnFeedback {
  evaluation: QuestionEvaluation;
  difficultyAfter: number;
  movingAverages: MovingAverages;
}

/** Typed errors. `evaluation_failed` carries no feedback payload (Req 12.6). */
export type FeedbackError =
  | { kind: 'validation_error'; message: string }
  | { kind: 'evaluation_failed' };

/**
 * Evaluate a submitted answer and compute the adaptive difficulty for the next turn.
 *
 * 1. Validate the `AnswerSubmitPayload` with the strict guard — a payload carrying any
 *    unknown/binary/media field is rejected before any processing (Req 12.1, 15.3,
 *    15.4), returning a typed `validation_error`.
 * 2. Compute moving averages for WPM, eye-contact, and posture from the submitted
 *    arrays (Req 12.2, Property 25).
 * 3. Build the evaluation Sandwich Prompt with the active question text, ideal answer,
 *    aggregated numeric metrics, and the compressed prior-turn scoring history
 *    (Req 12.3) — transcripts and numeric metrics only, never raw media (Req 15.5).
 * 4. Dispatch through the LLM_Gateway and validate the response with the Schema_Shield
 *    (Req 12.4). On failure, return `evaluation_failed` with NO feedback payload
 *    (Req 12.6, Property 27).
 * 5. On success, apply adaptive difficulty within the configured bounds (Req 14.1–14.6),
 *    persist the turn metrics and the clamped difficulty to `interview_sessions`
 *    (Req 12.5, 14.4), and return the bounded feedback (Req 12.7). The v1 `Tier_Gate`
 *    grants full access, so feedback is always returned in full (Req 22.2, 22.3).
 */
export async function evaluateTurn(
  args: EvaluateTurnArgs,
  deps: EvaluateTurnDeps,
): Promise<Result<TurnFeedback, FeedbackError>> {
  const now = deps.now ?? (() => new Date());
  const gateway = deps.gateway ?? getLLMGateway();

  // v1 Tier_Gate — full access, feedback retained in full (Req 22.2, 22.3). Computed
  // from the tier object (not a literal) so the feedback-stripping seam stays live for
  // later versions without changing this call site.
  const tier = tierGate(args.userId);
  const includeFeedback = tier.fullAccess && !tier.stripFeedback;

  // 1. Validate the payload — strict schema rejects raw media (Req 12.1, 15.3, 15.4).
  const parsed = AnswerSubmitPayloadSchema.safeParse(args.payload);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return { ok: false, error: { kind: 'validation_error', message } };
  }
  const payload: AnswerSubmitPayload = parsed.data;

  // 2. Moving averages from the submitted metric arrays (Req 12.2, Property 25).
  const movingAverages: MovingAverages = {
    wpm: movingAverage(payload.metrics.wpmArr),
    eyeContact: movingAverage(payload.metrics.eyeContactArr),
    posture: movingAverage(payload.metrics.postureArr),
  };

  // 3. Build the evaluation prompt (Req 12.3) — numeric metrics + transcript only.
  const prompt = buildEvaluationPrompt({
    questionText: args.activeQuestion.questionText,
    idealAnswer: args.activeQuestion.idealAnswer,
    metrics: payload.metrics,
    priorHistory: summarizePriorTurns(args.priorTurns),
    transcript: payload.transcript,
    persona: args.persona,
  });

  // 4. Dispatch through the gateway, validate via the Schema_Shield (Req 12.4).
  const shielded = await validateWithShield(
    QuestionEvaluationSchema,
    gateway,
    prompt,
    deps.maxRetries !== undefined ? { maxRetries: deps.maxRetries } : undefined,
  );

  // Shield failure → typed evaluation_failed, no feedback payload (Req 12.6, Property 27).
  if (!shielded.ok) {
    return { ok: false, error: { kind: 'evaluation_failed' } };
  }

  // The validated result satisfies QuestionEvaluationSchema: every score field is
  // already bounded 0..100 and the difficulty adjustment is a valid enum (Req 12.7).
  // Derive the difficulty signal DETERMINISTICALLY from the validated scores rather
  // than trusting the LLM's self-reported value, which is unreliably always 'same'
  // (BUG 2). The returned evaluation carries the corrected, authoritative adjustment.
  const difficultyAdjustment = deriveDifficultyAdjustment(shielded.value);
  const baseEvaluation: QuestionEvaluation = { ...shielded.value, difficultyAdjustment };
  const evaluation: QuestionEvaluation = includeFeedback
    ? baseEvaluation
    : { ...baseEvaluation, strengths: [], improvements: [] };

  // 5. Adaptive difficulty, clamped to the configured bounds (Req 14.1–14.6).
  const difficultyAfter = applyDifficulty(
    args.currentDifficulty,
    difficultyAdjustment,
    args.difficultyMin,
    args.difficultyMax,
  );

  // Persist the turn metrics + clamped difficulty to `interview_sessions` (Req 12.5, 14.4).
  const turn: TurnRecord = {
    index: payload.questionIndex,
    questionId: args.activeQuestion.id,
    questionText: args.activeQuestion.questionText,
    questionOrigin: args.questionOrigin ?? (payload.questionIndex <= 1 ? 'cover' : 'database'),
    transcript: payload.transcript,
    metrics: payload.metrics,
    evaluation,
    difficultyAfter,
    createdAt: now(),
  };
  await deps.store.persistTurn(args.sessionId, turn, difficultyAfter);

  return { ok: true, value: { evaluation, difficultyAfter, movingAverages } };
}
