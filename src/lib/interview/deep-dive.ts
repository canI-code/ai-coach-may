/**
 * Deep_Dive_Generator — Q7 deep-dive race, semantic dedupe, and sliding window.
 *
 * Task 18.2 scope (this file): the Turn 7 deep-dive generation that runs concurrently
 * with the Turn 6 buffer question, guarded by a hard 10-second timeout, plus the pure
 * sliding-window and semantic-duplicate helpers (Req 5, 6, 7, 24).
 *
 *   - `raceDeepDive` runs `Promise.race([generateQ7(), timeout(10000)])` (Req 5.3).
 *       · timeout wins                       → serve the next pool question (Req 5.7, 24.2)
 *       · generation wins + Schema_Shield ok + NOT a semantic duplicate of the Turn 6
 *         buffer                             → inject the generated question (Req 5.4, 5.5)
 *         and persist a clone to `interview_questions` as `status='pending'` /
 *         `is_validated=false` (Req 5.8, 8.1, 8.2)
 *       · generation wins but the result is a semantic duplicate of the buffer
 *                                            → serve the next pool question (Req 5.6)
 *       · generation wins but fails the Schema_Shield within the budget
 *                                            → serve the next pool question (liveness)
 *     In every branch a Turn 7 is produced whose id is guaranteed absent from the
 *     Exclusion_Array before serving (Req 7.1, 7.4, 7.5), and is never a semantic
 *     duplicate of the Turn 6 buffer (Property 16).
 *   - `slidingWindow` returns a contiguous suffix of the answered transcripts (Req 6.2,
 *     Property 18); the orchestrator chooses the window size (3 for the first deep dive
 *     over Q3–Q5, 2 for subsequent milestones — Req 5.2, 6.1).
 *   - `isSemanticDuplicate` compares two question texts via a normalized token-overlap
 *     (Jaccard) threshold.
 *   - The generation prompt always carries the current Exclusion_Array (Req 6.4, 7.3).
 *
 * I/O is decoupled behind injectable seams (`gateway` in args; `store` + `timer` in
 * deps) following the same pattern as `orchestrator.ts` / `feedback.ts`, so the race,
 * dedupe, and fallback logic stay testable with fake timers and a call-counting mock
 * gateway, without a live LLM or MongoDB. The orchestrator / answer route (tasks 18.1,
 * 21.1) wire the live gateway + `createMongoDeepDiveStore` and add the served id to the
 * Exclusion_Array after serving.
 *
 * Deviation note: the design types `raceDeepDive` as `Promise<DeepDiveOutcome>`. To stay
 * consistent with the module-wide "typed result objects, never throw" convention and to
 * let the orchestrator route genuine pool exhaustion to the Cache_Seeder fallback path
 * (Req 24.3 — outside this unit's scope), this implementation returns a `DeepDiveResult`
 * (`Result<DeepDiveOutcome, { kind: 'pool_exhausted' }>`). Every normal outcome (generated,
 * timeout-fallback, duplicate-fallback, generation-failure-fallback) resolves to
 * `{ ok: true }` with a non-duplicate Turn 7; only a pool with no usable fallback yields
 * `{ ok: false, error: { kind: 'pool_exhausted' } }`.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8,
 *               6.1, 6.2, 6.3, 6.4,
 *               7.1, 7.3, 7.4, 7.5,
 *               24.1, 24.2, 24.3
 */

import type { Db } from 'mongodb';

import type { LLMGateway } from './llm-gateway';
import { buildGenerationPrompt } from './prompt-builder';
import { validateWithShield, type ShieldResult } from './schema-shield';
import { insertInterviewQuestion } from './session-store';
import { QuestionGenerationSchema } from './schemas';
import type {
  InterviewQuestionDoc,
  Persona,
  PooledQuestion,
  QuestionGeneration,
  Result,
} from './schemas';

// ── Constants ──────────────────────────────────────────────────────────────

/** Hard timeout guarding Turn 7 generation, implemented as a race (Req 5.3). */
export const DEEP_DIVE_TIMEOUT_MS = 10_000;

/**
 * Window size for the FIRST deep dive (Turn 7): the Q3, Q4, and Q5 transcripts
 * (Req 5.2). Exported so the orchestrator can pass it to `slidingWindow`.
 */
export const DEEP_DIVE_FIRST_WINDOW = 3;

/**
 * Window size for SUBSEQUENT deep-dive milestones: the two most recent answered
 * questions form the context base (Req 6.1).
 */
export const DEEP_DIVE_WINDOW = 2;

/**
 * Jaccard token-overlap threshold above which two question texts are treated as
 * semantic duplicates. Strict by design so only near-identical questions are rejected.
 */
export const SEMANTIC_DUPLICATE_THRESHOLD = 0.8;

/** Sentinel resolved by the timeout arm of the race. */
const TIMEOUT = Symbol('deep-dive-timeout');

// ── Pure helpers (property-tested in isolation) ──────────────────────────────

/** Minimal answered-turn shape consumed by `slidingWindow` (structurally a `TurnRecord`). */
export interface AnsweredTurn {
  transcript: string;
}

/**
 * Return the transcripts of the most recent `size` answered turns — a contiguous
 * suffix of the answered-question sequence (Req 6.2, Property 18). A non-positive size
 * yields an empty window; a size larger than the history yields the whole (still
 * contiguous) suffix.
 */
export function slidingWindow(answered: AnsweredTurn[], size: number): string[] {
  if (size <= 0 || answered.length === 0) return [];
  const start = Math.max(0, answered.length - size);
  return answered.slice(start).map((t) => t.transcript);
}

/** Lowercase, strip non-alphanumerics, and split into a deduped token set. */
function normalizeTokens(text: string): Set<string> {
  return new Set(
    (text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

/**
 * Decide whether two question texts are semantic duplicates using the Jaccard overlap
 * of their normalized token sets against `threshold` (Req 5.5).
 *
 *  - Two empty/whitespace-only texts are identical → duplicate.
 *  - Exactly one empty text → not a duplicate.
 *  - Otherwise: `|A ∩ B| / |A ∪ B| ≥ threshold`.
 */
export function isSemanticDuplicate(
  a: string,
  b: string,
  threshold: number = SEMANTIC_DUPLICATE_THRESHOLD,
): boolean {
  const ta = normalizeTokens(a);
  const tb = normalizeTokens(b);
  if (ta.size === 0 && tb.size === 0) return true;
  if (ta.size === 0 || tb.size === 0) return false;

  let intersection = 0;
  for (const token of ta) {
    if (tb.has(token)) intersection++;
  }
  const union = ta.size + tb.size - intersection;
  return union > 0 && intersection / union >= threshold;
}

/**
 * Select the next pool fallback question: the first pool entry whose id is NOT in the
 * Exclusion_Array (Req 7.2) AND that is NOT a semantic duplicate of the Turn 6 buffer
 * (so every fallback branch upholds Property 16). Returns `null` when no such question
 * exists (genuine pool exhaustion).
 */
function selectPoolFallback(
  pool: PooledQuestion[],
  exclusion: string[],
  bufferQuestionText: string,
  threshold: number,
): PooledQuestion | null {
  const excluded = new Set(exclusion);
  for (const question of pool) {
    if (excluded.has(question.id)) continue;
    if (isSemanticDuplicate(question.questionText, bufferQuestionText, threshold)) continue;
    return question;
  }
  return null;
}

// ── Injectable seams ─────────────────────────────────────────────────────────

/** Persistence operations `raceDeepDive` needs. Decoupled for testability. */
export interface DeepDiveStore {
  /**
   * Persist a clone of the generated Turn 7 question to `interview_questions` as a
   * pending audit record (`status='pending'`, `is_validated=false`, `source='deep_dive'`)
   * even though it just passed the Schema_Shield, and return its new id (Req 5.8, 8.1, 8.2).
   */
  persistDeepDiveClone(gen: QuestionGeneration, role: string): Promise<string>;
}

/** Production `DeepDiveStore` built from the `session-store` helpers and a live `Db`. */
export function createMongoDeepDiveStore(db: Db): DeepDiveStore {
  return {
    async persistDeepDiveClone(gen, role) {
      const doc: Omit<InterviewQuestionDoc, '_id'> = {
        questionText: gen.questionText,
        idealAnswer: gen.idealAnswer,
        role,
        difficulty: gen.difficulty,
        tags: gen.tags,
        status: 'pending',
        is_validated: false,
        source: 'deep_dive',
        createdAt: new Date(),
      };
      const id = await insertInterviewQuestion(db, doc);
      return id.toHexString();
    },
  };
}

/** Cancelable timeout, injectable so the 10s race is deterministic under fake timers. */
export interface DeepDiveTimer {
  timeout(ms: number): { promise: Promise<typeof TIMEOUT>; cancel: () => void };
}

/** Default `setTimeout`-backed timer; cancels its handle when generation wins the race. */
const defaultTimer: DeepDiveTimer = {
  timeout(ms) {
    let handle: ReturnType<typeof setTimeout> | undefined;
    const promise = new Promise<typeof TIMEOUT>((resolve) => {
      handle = setTimeout(() => resolve(TIMEOUT), ms);
    });
    return {
      promise,
      cancel: () => {
        if (handle !== undefined) clearTimeout(handle);
      },
    };
  },
};

// ── raceDeepDive ──────────────────────────────────────────────────────────────

/** The branch that produced the served Turn 7 question. */
export type DeepDiveSource =
  | 'generated'
  | 'pool_fallback_timeout'
  | 'pool_fallback_duplicate'
  | 'pool_fallback_generation_failed';

export interface DeepDiveOutcome {
  source: DeepDiveSource;
  question: PooledQuestion;
}

/** Typed failure: no usable, non-duplicate fallback remained in the pool (Req 24.3 routing). */
export type DeepDiveError = { kind: 'pool_exhausted' };

export type DeepDiveResult = Result<DeepDiveOutcome, DeepDiveError>;

export interface RaceDeepDiveArgs {
  /** Target role for the generated question. */
  role: string;
  /** Target difficulty for the generated question. */
  difficulty: number;
  /** Interviewer persona woven into the generation prompt. */
  persona: Persona;
  /** Sliding-window transcripts forming the generation context (Req 5.2, 6.2). */
  windowTranscripts: string[];
  /** Current Exclusion_Array (question ids), passed into generation (Req 6.4, 7.3). */
  exclusion: string[];
  /** Turn 6 buffer question text, used for the semantic-duplicate check (Req 5.5, 5.6). */
  bufferQuestionText: string;
  /** Pre-seeded Question_Pool, the fallback source (Req 5.6, 5.7, 24.2). */
  pool: PooledQuestion[];
  /** Provider-agnostic LLM call site. */
  gateway: LLMGateway;
  /** Race timeout; defaults to 10 000 ms (Req 5.3). */
  timeoutMs?: number;
}

export interface DeepDiveDeps {
  /** Persistence seam for the generated clone (Mongo in production). */
  store: DeepDiveStore;
  /** Injectable timer for the race; defaults to a `setTimeout`-backed timer. */
  timer?: DeepDiveTimer;
  /** Forwarded to the Schema_Shield (default 3 re-prompts → ≤4 total LLM calls). */
  maxRetries?: number;
  /** Override the semantic-duplicate threshold (defaults to {@link SEMANTIC_DUPLICATE_THRESHOLD}). */
  semanticThreshold?: number;
}

/**
 * Generate and validate one Turn 7 question. Builds the generation prompt with the
 * sliding-window context and the Exclusion_Array constraint (Req 6.4, 7.3) and runs it
 * through the Schema_Shield. Never throws — returns the typed `ShieldResult` so the
 * caller can branch deterministically even when the timeout has already won the race.
 */
async function generateQ7(
  args: RaceDeepDiveArgs,
  maxRetries?: number,
): Promise<ShieldResult<QuestionGeneration>> {
  try {
    const prompt = buildGenerationPrompt({
      role: args.role,
      difficulty: args.difficulty,
      windowTranscripts: args.windowTranscripts,
      excludedQuestions: args.exclusion,
      persona: args.persona,
    });
    return await validateWithShield(
      QuestionGenerationSchema,
      args.gateway,
      prompt,
      maxRetries !== undefined ? { maxRetries } : undefined,
    );
  } catch (err) {
    // Defensive: the gateway + shield return typed results and should not throw, but a
    // floating rejection on the timeout branch must never escape as an unhandled error.
    return {
      ok: false,
      error: {
        kind: 'validation_failed',
        lastError: err instanceof Error ? err.message : String(err),
        attempts: 0,
      },
    };
  }
}

/** Resolve a pool fallback into a typed result, mapping exhaustion to `pool_exhausted`. */
function poolFallback(
  args: RaceDeepDiveArgs,
  source: DeepDiveSource,
  threshold: number,
): DeepDiveResult {
  const fallback = selectPoolFallback(
    args.pool,
    args.exclusion,
    args.bufferQuestionText,
    threshold,
  );
  if (!fallback) return { ok: false, error: { kind: 'pool_exhausted' } };
  return { ok: true, value: { source, question: fallback } };
}

/**
 * Race Turn 7 generation against the 10-second timeout and resolve the Turn 7 question.
 *
 * 1. `Promise.race([generateQ7(), timeout(timeoutMs)])` (Req 5.3). The timer is canceled
 *    as soon as either arm settles so no stray timer leaks.
 * 2. Timeout wins → serve the next pool question (`pool_fallback_timeout`) (Req 5.7, 24.2).
 * 3. Generation wins:
 *      · Schema_Shield failure → pool fallback (`pool_fallback_generation_failed`) so the
 *        loop never stalls (Req 24.1).
 *      · Validated but a semantic duplicate of the Turn 6 buffer → pool fallback
 *        (`pool_fallback_duplicate`) (Req 5.6).
 *      · Validated, unique, and the freshly persisted clone's id is not already excluded
 *        → serve the generated question (`generated`) (Req 5.4, 5.5, 5.8, 7.5). If the new
 *        id somehow collides with the Exclusion_Array, discard and fall back (Req 7.4).
 *
 * The served question's id is guaranteed absent from the Exclusion_Array and the served
 * question is never a semantic duplicate of the buffer (Property 16). The caller adds the
 * served id to the Exclusion_Array after serving (Req 7.1).
 */
export async function raceDeepDive(
  args: RaceDeepDiveArgs,
  deps: DeepDiveDeps,
): Promise<DeepDiveResult> {
  const timeoutMs = args.timeoutMs ?? DEEP_DIVE_TIMEOUT_MS;
  const threshold = deps.semanticThreshold ?? SEMANTIC_DUPLICATE_THRESHOLD;
  const timer = deps.timer ?? defaultTimer;

  const t = timer.timeout(timeoutMs);
  const generation = generateQ7(args, deps.maxRetries);

  // Race generation against the timeout (Req 5.3). Tag each arm to discriminate the winner.
  const winner = await Promise.race([
    generation.then((result) => ({ kind: 'gen' as const, result })),
    t.promise.then(() => ({ kind: 'timeout' as const })),
  ]);
  t.cancel();

  // 2. Timeout won — serve a pre-seeded pool question immediately (Req 5.7, 24.2).
  if (winner.kind === 'timeout') {
    // The still-pending generation promise resolves to a typed result (never throws);
    // attach a no-op catch defensively so it can never surface as an unhandled rejection.
    void generation.catch(() => undefined);
    return poolFallback(args, 'pool_fallback_timeout', threshold);
  }

  const shielded = winner.result;

  // 3a. Generation completed but failed validation within the budget → pool fallback.
  if (!shielded.ok) {
    return poolFallback(args, 'pool_fallback_generation_failed', threshold);
  }

  // 3b. Validated — reject a semantic duplicate of the Turn 6 buffer (Req 5.5, 5.6).
  if (isSemanticDuplicate(shielded.value.questionText, args.bufferQuestionText, threshold)) {
    return poolFallback(args, 'pool_fallback_duplicate', threshold);
  }

  // 3c. Unique — persist the clone (Req 5.8, 8.1) and serve it, guaranteeing the new id
  // is absent from the Exclusion_Array (Req 7.1, 7.4, 7.5).
  const newId = await deps.store.persistDeepDiveClone(shielded.value, args.role);
  if (args.exclusion.includes(newId)) {
    // The generated id collides with an already-served/seeded id — discard and fall back
    // to the next unique pool question (Req 7.4).
    return poolFallback(args, 'pool_fallback_duplicate', threshold);
  }

  const question: PooledQuestion = {
    id: newId,
    questionText: shielded.value.questionText,
    idealAnswer: shielded.value.idealAnswer,
    difficulty: shielded.value.difficulty,
    tags: shielded.value.tags,
    origin: 'generated',
  };
  return { ok: true, value: { source: 'generated', question } };
}
