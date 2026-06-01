/**
 * Cache_Seeder — pre-session Question_Pool seeding with strict 3-tier priority.
 *
 * Task 17.1 scope (this file): `seedPool`, the 3-tier fallback that fills the
 * Question_Pool before Turn 1 (Req 3, 8, 24.3):
 *
 *   Tier 1 (validated)  → `interview_questions` where `status='validated'` matching
 *                         the session role and difficulty range (Req 3.1).
 *   Tier 2 (pending)    → non-rejected `status='pending'` questions, used only when
 *                         the validated tier is exhausted (Req 3.2).
 *   Tier 3 (on_demand)  → LLM_Gateway generation through the Schema_Shield, used only
 *                         when validated + pending are exhausted (Req 3.3). Every
 *                         generated question is persisted to `interview_questions` as
 *                         `status='pending'` / `is_validated=false` even after passing
 *                         the shield (Req 3.6, 8.1, 8.2).
 *
 * Every seeded id is appended to the Exclusion_Array exactly once (Req 3.5). A
 * lower-priority tier is consulted only when all higher tiers are exhausted
 * (Property 8). When on-demand generation cannot meet the target after the
 * Schema_Shield retries are exhausted, the available questions are still seeded and a
 * `shortfallWarning` is recorded (Req 3.7); the orchestrator gates the `active`
 * transition on the minimum pool size (Req 3.8, 24.4).
 *
 * This module fulfills the `SeedPoolFn` contract declared by the Interview_Orchestrator
 * (`orchestrator.ts`); the main route handler wires it via `bindSeeder`.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 8.1, 8.2, 24.3
 */

import type { Db } from 'mongodb';

import type { LLMGateway } from './llm-gateway';
import { buildGenerationPrompt } from './prompt-builder';
import { validateWithShield } from './schema-shield';
import {
  findPendingPoolQuestions,
  findValidatedQuestions,
  insertInterviewQuestion,
} from './session-store';
import { QuestionGenerationSchema } from './schemas';
import type {
  InterviewQuestionDoc,
  PooledQuestion,
  QuestionGeneration,
  QuestionOrigin,
  SessionConfig,
} from './schemas';
import type { SeedPoolFn, SeedResult, SeedTier } from './orchestrator';

/**
 * Hard ceiling on on-demand generation iterations as a defensive guard. The loop
 * already terminates naturally (each iteration either adds one question or breaks on a
 * Schema_Shield failure), but this bounds total LLM traffic if the target is large.
 */
const MAX_ON_DEMAND_ATTEMPTS = 50;

/** Map a stored question document into a `PooledQuestion` with its seeding origin. */
function toPooled(doc: InterviewQuestionDoc, origin: QuestionOrigin): PooledQuestion {
  return {
    id: doc._id.toHexString(),
    questionText: doc.questionText,
    idealAnswer: doc.idealAnswer,
    difficulty: doc.difficulty,
    tags: doc.tags,
    origin,
  };
}

/**
 * Persist an LLM-generated question to `interview_questions` as a pending audit record
 * (`status='pending'`, `is_validated=false`) — even though it just passed the
 * Schema_Shield — and return it as a `PooledQuestion` carrying the new id
 * (Req 3.6, 8.1, 8.2).
 */
async function persistGenerated(
  db: Db,
  gen: QuestionGeneration,
  role: string,
): Promise<PooledQuestion> {
  const doc: Omit<InterviewQuestionDoc, '_id'> = {
    questionText: gen.questionText,
    idealAnswer: gen.idealAnswer,
    role,
    difficulty: gen.difficulty,
    tags: gen.tags,
    status: 'pending',
    is_validated: false,
    source: 'on_demand',
    createdAt: new Date(),
  };
  const id = await insertInterviewQuestion(db, doc);
  return {
    id: id.toHexString(),
    questionText: gen.questionText,
    idealAnswer: gen.idealAnswer,
    difficulty: gen.difficulty,
    tags: gen.tags,
    origin: 'generated',
  };
}

/**
 * Fill the Question_Pool ahead of Turn 1 using the strict validated → pending →
 * on-demand fallback. Returns the ordered pool, the matching Exclusion_Array (pool ids,
 * no duplicates), the tiers actually consumed (in order), and a shortfall warning when
 * on-demand generation could not reach the target.
 */
export const seedPool: SeedPoolFn = async (
  db: Db,
  gateway: LLMGateway,
  config: SessionConfig,
  minPoolSize: number,
): Promise<SeedResult> => {
  const { role, difficulty, difficultyMin, difficultyMax, questionCount, aiPersona } = config;

  // Target satisfies both the question count (Req 3.4) and the activation gate (Req 3.8).
  const required = Math.max(questionCount, minPoolSize);

  const pool: PooledQuestion[] = [];
  const exclusion: string[] = [];
  const seen = new Set<string>();
  const tiersUsed: SeedTier[] = [];
  let shortfallWarning: string | undefined;

  /** Add a question to the pool and exclusion array exactly once (Req 3.5, Property 7). */
  const addToPool = (question: PooledQuestion): void => {
    if (seen.has(question.id) || pool.length >= required) return;
    seen.add(question.id);
    pool.push(question);
    exclusion.push(question.id);
  };

  const remaining = (): number => required - pool.length;

  const isTargeted = config.sessionType === 'targeted';
  const focusTags = isTargeted ? config.focusTags : undefined;

  // ── Tier 1: validated (role + difficulty range) — Req 3.1 ──────────────────
  if (remaining() > 0) {
    const before = pool.length;
    const validated = await findValidatedQuestions(
      db,
      role,
      difficultyMin,
      difficultyMax,
      remaining(),
      focusTags,
    );
    for (const doc of validated) {
      if (remaining() <= 0) break;
      addToPool(toPooled(doc, 'validated'));
    }
    if (pool.length > before) tiersUsed.push('validated');
  }

  // ── Tier 2: pending, non-rejected — only when validated is exhausted (Req 3.2) ──
  if (remaining() > 0) {
    const before = pool.length;
    const pending = await findPendingPoolQuestions(
      db,
      role,
      difficultyMin,
      difficultyMax,
      remaining(),
      focusTags,
    );
    for (const doc of pending) {
      if (remaining() <= 0) break;
      addToPool(toPooled(doc, 'pending'));
    }
    if (pool.length > before) tiersUsed.push('pending');
  }

  // ── Tier 3: on-demand LLM generation — only when validated + pending exhausted ──
  if (remaining() > 0) {
    const before = pool.length;
    let attempts = 0;

    while (remaining() > 0 && attempts < MAX_ON_DEMAND_ATTEMPTS) {
      attempts++;

      // Constrain the LLM with the question texts already pooled to reduce duplicates
      // (Req 3.3); the id-based Exclusion_Array is tracked separately for SeedResult.
      const prompt = buildGenerationPrompt({
        role,
        difficulty,
        windowTranscripts: [],
        excludedQuestions: pool.map((q) => q.questionText),
        persona: aiPersona,
        focusTags,
      });

      const result = await validateWithShield(QuestionGenerationSchema, gateway, prompt);

      // Schema_Shield retries exhausted for this generation: seed what we have and
      // record the shortfall (Req 3.7). No further on-demand attempts.
      if (!result.ok) {
        shortfallWarning = `on-demand generation exhausted Schema_Shield retries after ${result.error.attempts} attempt(s); seeded ${pool.length}/${required} questions (last error: ${result.error.lastError})`;
        break;
      }

      addToPool(await persistGenerated(db, result.value, role));
    }

    if (pool.length > before) tiersUsed.push('on_demand');

    // Reached the defensive attempt ceiling without filling the target.
    if (remaining() > 0 && !shortfallWarning) {
      shortfallWarning = `on-demand generation stopped after ${attempts} attempt(s); seeded ${pool.length}/${required} questions`;
    }
  }

  return {
    pool,
    exclusion,
    tiersUsed,
    ...(shortfallWarning ? { shortfallWarning } : {}),
  };
};
