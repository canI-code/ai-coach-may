/**
 * Interview_Orchestrator — session creation, lifecycle, and pure selection helpers.
 *
 * Task 16.1 scope (this file): `createSession` (config validation, persona default,
 * unique id, `seeding` record, seeder invocation, `active` transition gated on the
 * minimum pool size, Turn 1) plus the pure helpers `selectNext`, `canTransition`,
 * `buildTurn2`, and `extractEntities`. Task 16.2 (this file) adds `resume` and
 * per-submit state persistence; the Turns 1–5 loop (18.1) extends this module later.
 *
 * The Cache_Seeder (`cache-seeder.ts`) is implemented in task 17.1. To compile and
 * stay testable now, the orchestrator depends on the seeder through the thin
 * `SeedPoolFn` contract (mirrored from the design) injected via `CreateSessionDeps`,
 * rather than importing the not-yet-existing module. Task 17.1 fulfills `SeedPoolFn`;
 * the main route handler (21.1) wires the real seeder + store with `bindSeeder` /
 * `createMongoStore`.
 *
 * Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.8, 7.2, 24.4 (task 16.1);
 *               2.1, 2.2, 2.3, 2.4, 2.5, 2.6 (task 16.2 — resume + per-submit persistence)
 */

import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';
import { z } from 'zod';

import { durationToMaxQuestions, isValidDuration } from './duration';
import type { LLMGateway } from './llm-gateway';
import {
  findReport,
  findSession,
  getPoolCache,
  insertSession,
  setPoolCache,
  updateSession,
  type PoolCache,
} from './session-store';
import type {
  CoachingReportDoc,
  Entities,
  InterviewSessionDoc,
  OrchestratorError,
  Persona,
  PooledQuestion,
  ReportRef,
  Result,
  ServedQuestion,
  SessionConfig,
  SessionStatus,
} from './schemas';

// ── Constants ────────────────────────────────────────────────────────────────

/** Default interviewer persona applied when the config omits `aiPersona` (Req 1.8). */
export const DEFAULT_PERSONA: Persona = 'general_recruiter';

/** Static intro served as Turn 1 the moment a session becomes `active` (Req 4.1). */
export const TURN1_INTRO =
  'Welcome! To get started, please introduce yourself — tell me your name, your years of experience, and the main technologies you work with.';

export function buildTurn1Intro(role?: string): string {
  if (!role) return TURN1_INTRO;
  return `Welcome! To get started, please introduce yourself — tell me your name, your years of experience, and the main technologies you work with as a ${role}.`;
}

/**
 * Default Turn 2 follow-up template. `buildTurn2` fills the `{name}`, `{experience}`,
 * and `{techStack}` slots from extracted entities and guarantees no slot is left
 * unfilled, degrading gracefully to an unpersonalized question (Req 4.2, 4.5).
 */
export const TURN2_TEMPLATE =
  'Thanks {name}. With {experience} working across {techStack}, can you walk me through a challenging project where you applied {techStack}?';

export function buildTurn2Template(role?: string): string {
  if (!role) return TURN2_TEMPLATE;
  return `Thanks {name}. With {experience} working across {techStack}, can you walk me through a challenging project where you applied {techStack} in your work as a ${role}?`;
}

/** Neutral fillers so a missing entity never leaves an empty/placeholder slot. */
const TURN2_FALLBACKS: Required<Entities> = {
  name: 'there',
  experience: 'your background',
  techStack: 'the technologies you work with',
};

// ── Seeder contract (thin internal interface; Task 17.1 fulfills it) ──────────

export type SeedTier = 'validated' | 'pending' | 'on_demand';

export interface SeedResult {
  /** Ordered Question_Pool; every id distinct. */
  pool: PooledQuestion[];
  /** Exclusion_Array — equals the set of pool ids (no duplicates). */
  exclusion: string[];
  /** Recorded when on-demand generation could not fully meet the count (Req 3.7). */
  shortfallWarning?: string;
  /** Tiers consulted, in consumption order. */
  tiersUsed: SeedTier[];
}

/** Matches the design's `seedPool(db, gateway, config, minPoolSize)` signature. */
export type SeedPoolFn = (
  db: Db,
  gateway: LLMGateway,
  config: SessionConfig,
  minPoolSize: number,
) => Promise<SeedResult>;

// ── Dependency injection seams ────────────────────────────────────────────────

/** Persistence operations `createSession` needs. Decoupled for testability. */
export interface OrchestratorStore {
  insertSession(doc: InterviewSessionDoc): Promise<void>;
  updateSession(sessionId: string, patch: Partial<InterviewSessionDoc>): Promise<void>;
  setPoolCache(sessionId: string, cache: PoolCache): Promise<void>;
}

/**
 * Read operations `resume` (16.2) needs. Req 2.1 mandates rebuilding the active state
 * from the persisted index/difficulty stored in `interview_sessions` (Mongo is the
 * authoritative source), plus the `coaching_reports` lookup for the completed-session
 * report reference (Req 2.4). Kept separate from `OrchestratorStore` so existing
 * `createSession` store fakes stay valid without the read methods.
 */
export interface ResumeStore {
  findSession(sessionId: string): Promise<InterviewSessionDoc | null>;
  findReport(reportId: string): Promise<CoachingReportDoc | null>;
}

/** Cache helpers used to keep the Redis fast-read mirror consistent after a submit. */
export interface PoolCacheStore {
  getPoolCache(sessionId: string): Promise<PoolCache | null>;
}

/** Full store seam covering creation, resume reads, and per-submit persistence. */
export type InterviewStore = OrchestratorStore & ResumeStore & PoolCacheStore;

export interface CreateSessionDeps {
  /** Bound Cache_Seeder call — route binds `db` + `gateway`; tests inject a fake. */
  seed: (config: SessionConfig, minPoolSize: number) => Promise<SeedResult>;
  /** Persistence seam (Mongo + Redis cache in production). */
  store: OrchestratorStore;
  /**
   * Minimum pool size that must be met before transitioning to `active`
   * (Req 3.8, 24.4). Defaults to the configured `questionCount`.
   */
  minPoolSize?: number;
  /** Clock injection for deterministic timestamps in tests. */
  now?: () => Date;
  /** Id generator injection; defaults to a fresh Mongo `ObjectId`. */
  newId?: () => ObjectId;
}

/** Production store built from the `session-store` helpers and a live `Db`. */
export function createMongoStore(db: Db): InterviewStore {
  return {
    insertSession: (doc) => insertSession(db, doc),
    updateSession: (sessionId, patch) => updateSession(db, sessionId, patch),
    setPoolCache: (sessionId, cache) => setPoolCache(sessionId, cache),
    findSession: (sessionId) => findSession(db, sessionId),
    getPoolCache: (sessionId) => getPoolCache(sessionId),
    findReport: (reportId) => findReport(db, reportId),
  };
}

/** Bind a `SeedPoolFn` (Task 17.1) with a live `Db` + gateway for the route handler. */
export function bindSeeder(
  seedPool: SeedPoolFn,
  db: Db,
  gateway: LLMGateway,
): CreateSessionDeps['seed'] {
  return (config, minPoolSize) => seedPool(db, gateway, config, minPoolSize);
}

// ── Config validation ─────────────────────────────────────────────────────────

const PersonaSchema = z.enum(['stress_interviewer', 'tech_lead', 'general_recruiter']);

/**
 * Required config fields (Req 1.1, 1.3). `aiPersona` is optional and defaults to
 * `general_recruiter` (Req 1.8); `institutionCode` is optional.
 */
const SessionConfigInputSchema = z
  .object({
    role: z.string().min(1),
    difficulty: z.number(),
    durationMinutes: z.number(),
    difficultyMin: z.number(),
    difficultyMax: z.number(),
    aiPersona: PersonaSchema.optional().default(DEFAULT_PERSONA),
    institutionCode: z.string().optional(),
    sessionType: z.enum(['full', 'targeted']).optional().default('full'),
    focusTags: z.array(z.string()).optional(),
  })
  .strip();

/**
 * Validate an untrusted config. Returns the normalized `SessionConfig` (persona
 * defaulted) or a typed validation error. No side effects (Req 1.3, Property 4).
 */
export function validateSessionConfig(
  raw: unknown,
): Result<SessionConfig, { kind: 'validation_error'; message: string }> {
  const parsed = SessionConfigInputSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return { ok: false, error: { kind: 'validation_error', message } };
  }
  if (!isValidDuration(parsed.data.durationMinutes)) {
    return { ok: false, error: { kind: 'validation_error', message: 'invalid durationMinutes' } };
  }
  const count = parsed.data.sessionType === 'targeted'
    ? 3
    : durationToMaxQuestions(parsed.data.durationMinutes);
  return {
    ok: true,
    value: { ...parsed.data, questionCount: count },
  };
}

// ── Pure helpers (property-tested in isolation) ───────────────────────────────

/** Legal forward-only lifecycle edges. `completed`/`abandoned` are terminal. */
const ALLOWED_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  seeding: ['active', 'abandoned'],
  active: ['completed', 'abandoned'],
  completed: [],
  abandoned: [],
};

/**
 * State-machine guard. Permits transitions only along `seeding → active → completed`,
 * allows `abandoned` from `seeding` or `active`, and never permits a backward or
 * same-state transition (Req 1.5, 1.6, Property 3).
 */
export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Return the first pool question whose id is absent from the Exclusion_Array, or
 * `null` when none remain (Req 7.2, 7.4, Property 14).
 */
export function selectNext(
  pool: PooledQuestion[],
  exclusion: string[],
): PooledQuestion | null {
  const excluded = new Set(exclusion);
  for (const question of pool) {
    if (!excluded.has(question.id)) return question;
  }
  return null;
}

/**
 * Heuristically extract candidate name, experience, and tech stack from the Turn 1
 * transcript without calling the LLM (Req 4.2). Unmatched fields are simply omitted,
 * yielding `{}` for transcripts with no usable entities (Req 4.5).
 */
export function extractEntities(transcript: string): Entities {
  const entities: Entities = {};
  const text = transcript ?? '';

  // Name: "my name is John", "I am John Doe", "I'm John", "this is John".
  const nameMatch = text.match(
    /(?:[Mm]y name is|I am|I'm|[Tt]his is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
  );
  if (nameMatch) entities.name = nameMatch[1].trim();

  // Experience: "5 years", "3+ years of experience", "10 yrs".
  const expMatch = text.match(/(\d+\+?)\s*(?:years?|yrs?)\b/i);
  if (expMatch) entities.experience = `${expMatch[1]} years`;

  // Tech stack: "work with React and Node", "experience in Python", "using TypeScript".
  const techMatch = text.match(
    /(?:work(?:ing)? with|experience (?:in|with)|using|skilled in|proficient in|specialized? in)\s+([A-Za-z0-9 ,.+#/&-]+?)(?:[.!?]|$)/i,
  );
  if (techMatch) {
    const stack = techMatch[1].trim().replace(/\s+and\s+/gi, ', ');
    if (stack) entities.techStack = stack;
  }

  return entities;
}

/**
 * Fill the Turn 2 follow-up `template` from extracted entities, substituting neutral
 * fillers for missing entities and stripping any residual `{...}` token so the result
 * never contains an unfilled placeholder (Req 4.2, 4.5, Property 12).
 */
export function buildTurn2(template: string, entities: Entities): string {
  const filled = template
    .replace(/\{name\}/g, (entities.name ?? '').trim() || TURN2_FALLBACKS.name)
    .replace(
      /\{experience\}/g,
      (entities.experience ?? '').trim() || TURN2_FALLBACKS.experience,
    )
    .replace(
      /\{techStack\}/g,
      (entities.techStack ?? '').trim() || TURN2_FALLBACKS.techStack,
    );

  // Guarantee no leftover placeholder token of any name survives.
  return filled
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Core question loop — Turns 1–5 (Req 4.1–4.5) ──────────────────────────────

/**
 * Outcome of advancing the question loop after an answer submission.
 *
 *  - `question` — the next question to serve, with its 0-based index, the total
 *    question count, and the pool id consumed this turn (`null` for the templated
 *    Turn 2, which draws no pool question — Req 4.4).
 *  - `complete` — the loop has reached the configured `question_count`; no further
 *    question is served and the caller transitions the session to `completed`
 *    (Req 1.5). Signalling completion here keeps the served-turn count from ever
 *    exceeding `question_count`.
 */
export type AdvancedTurn =
  | { kind: 'question'; served: ServedQuestion; servedPoolId: string | null }
  | { kind: 'complete' };

export interface AdvanceTurnArgs {
  /** Session identifier echoed back in the served question. */
  sessionId: string;
  /**
   * 0-based index of the turn the candidate just answered (Turn N ⇒ index N − 1).
   * The next question is served at `answeredIndex + 1`.
   */
  answeredIndex: number;
  /**
   * The Turn 1 transcript (index 0). Used only when building Turn 2; entity
   * extraction degrades gracefully to the unpersonalized template (Req 4.2, 4.5).
   */
  turn1Transcript: string;
  /** The pre-seeded Question_Pool; Turns 3–5 draw only from here (Req 4.3, Property 13). */
  pool: PooledQuestion[];
  /**
   * Ids of pool questions already served in prior domain turns (turns at index ≥ 2).
   * Pool selection excludes these so each domain turn is distinct (Req 7.2). This is
   * the served-pool set, NOT the seeding Exclusion_Array (which also lists every
   * seeded id and is reserved for the Deep_Dive_Generator's generation constraint).
   */
  servedPoolIds: string[];
  /** Configured `question_count` — the served total and the loop's completion bound. */
  totalQuestions: number;
  /** The selected role / topic of the interview to personalize Turn 1 and 2. */
  role?: string;
  sessionType?: 'full' | 'targeted';
}

function servedQuestion(
  sessionId: string,
  questionText: string,
  index: number,
  totalQuestions: number,
  servedPoolId: string | null,
): Result<AdvancedTurn, OrchestratorError> {
  return {
    ok: true,
    value: {
      kind: 'question',
      served: { sessionId, questionText, currentQuestionIndex: index, totalQuestions },
      servedPoolId,
    },
  };
}

/**
 * Advance the question loop for Turns 1–5 (pure; property-tested in isolation).
 *
 * Given the index just answered, resolve the next question to serve, incrementing the
 * index normally in every branch — including the templated Turn 2 that consumes no
 * pool question (Req 4.4):
 *
 *  - next index ≥ `totalQuestions` → `complete` (the loop reached `question_count`).
 *  - next index 0 → the static Turn 1 intro (Req 4.1). Normally `createSession` serves
 *    Turn 1 directly; handled here so the function is total over its input.
 *  - next index 1 → Turn 2, built by extracting name/experience/tech-stack entities
 *    from the Turn 1 transcript and filling the follow-up template, with NO LLM call;
 *    when no usable entities are found the unpersonalized template is served (Req 4.2,
 *    4.5, Property 12). No pool question is consumed (`servedPoolId = null`).
 *  - next index ≥ 2 → the next distinct pool question (Turns 3–5 target the session
 *    role via the seeded pool — Req 4.3, Property 13). `pool_exhausted` when none
 *    remain.
 *
 * Turn 6 buffering and the Turn 7 deep-dive race (next index ≥ 5) are layered on by the
 * Deep_Dive_Generator (task 18.2); within Turns 1–5 this never triggers.
 */
export function advanceTurn(
  args: AdvanceTurnArgs,
): Result<AdvancedTurn, OrchestratorError> {
  const { sessionId, answeredIndex, totalQuestions } = args;
  const nextIndex = answeredIndex + 1;

  // Loop reached the configured question_count — no further question (Req 1.5).
  if (nextIndex >= totalQuestions) {
    return { ok: true, value: { kind: 'complete' } };
  }

  const isTargeted = args.sessionType === 'targeted';

  if (!isTargeted) {
    // Turn 1 intro (Req 4.1) — total-function safety; createSession serves this directly.
    if (nextIndex <= 0) {
      return servedQuestion(sessionId, buildTurn1Intro(args.role), 0, totalQuestions, null);
    }

    // Turn 2 — templated personalization, no LLM, no pool consumed (Req 4.2, 4.4, 4.5).
    if (nextIndex === 1) {
      const text = buildTurn2(buildTurn2Template(args.role), extractEntities(args.turn1Transcript));
      return servedQuestion(sessionId, text, 1, totalQuestions, null);
    }
  }

  // Turns 3–5 (or targeted Turns 1-3) — next distinct question from the pre-seeded pool (Req 4.3).
  const next = selectNext(args.pool, args.servedPoolIds);
  if (!next) {
    return { ok: false, error: { kind: 'pool_exhausted' } };
  }
  return servedQuestion(sessionId, next.questionText, nextIndex, totalQuestions, next.id);
}

/**
 * Convenience binding of {@link advanceTurn} to a persisted session document. Derives
 * the Turn 1 transcript and the served-pool set from the session's turn records, so the
 * submit flow (tasks 19.1 / 21.1) can advance straight from session state.
 *
 * Call AFTER the just-answered turn has been recorded in `session.turns`, so the served
 * domain-turn ids include the turn at `answeredIndex` and the next pool question is the
 * correct distinct one (mirrors the read convention used by `resolveResumeQuestionText`).
 */
export function advanceTurnForSession(
  session: InterviewSessionDoc,
  answeredIndex: number,
): Result<AdvancedTurn, OrchestratorError> {
  const turn1 = session.turns.find((t) => t.index === 0);
  const isTargeted = session.config.sessionType === 'targeted';
  const servedPoolIds = session.turns
    .filter((t) => isTargeted || t.index >= 2)
    .map((t) => t.questionId);

  return advanceTurn({
    sessionId: session._id.toHexString(),
    answeredIndex,
    turn1Transcript: turn1?.transcript ?? '',
    pool: session.pool,
    servedPoolIds,
    totalQuestions: session.config.questionCount,
    role: session.config.role,
    sessionType: session.config.sessionType,
  });
}

// ── createSession ─────────────────────────────────────────────────────────────

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

/**
 * Create an interview session.
 *
 * 1. Validate the config; on missing/invalid fields return a validation error with
 *    NO session record written (Req 1.3, Property 4). Persona defaults to
 *    `general_recruiter` (Req 1.8).
 * 2. Assign a unique session id (Req 1.7, Property 2) and write the `seeding` record
 *    associated with the authenticated candidate (Req 1.1).
 * 3. Invoke the Cache_Seeder.
 * 4. Transition to `active` and serve the static Turn 1 intro only when the pool meets
 *    the minimum pool size (Req 1.4, 3.8, 24.4); otherwise stay `seeding` and return a
 *    seeding-failure error.
 */
export async function createSession(
  userId: string,
  rawConfig: unknown,
  deps: CreateSessionDeps,
): Promise<Result<ServedQuestion, OrchestratorError>> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => new ObjectId());

  // 1. Validate config — reject without side effects.
  const configResult = validateSessionConfig(rawConfig);
  if (!configResult.ok) {
    return { ok: false, error: configResult.error };
  }
  const config = configResult.value;

  // Resolve the authenticated candidate id — reject before any write.
  const userObjectId = toObjectId(userId);
  if (!userObjectId) {
    return { ok: false, error: { kind: 'validation_error', message: 'invalid userId' } };
  }

  const minPoolSize = deps.minPoolSize ?? config.questionCount;

  // 2. Persist the `seeding` record.
  const _id = newId();
  const sessionId = _id.toHexString();
  const createdAt = now();
  const { institutionCode, ...configCore } = config;

  const sessionDoc: InterviewSessionDoc = {
    _id,
    userId: userObjectId,
    status: 'seeding',
    config: configCore,
    ...(institutionCode ? { institutionCode } : {}),
    currentQuestionIndex: 0,
    currentDifficulty: config.difficulty,
    pool: [],
    exclusion: [],
    turns: [],
    behavioralTimeline: [],
    startedAt: undefined,
    createdAt,
    updatedAt: createdAt,
  };
  await deps.store.insertSession(sessionDoc);

  // 3. Seed the Question_Pool.
  const seed = await deps.seed(config, minPoolSize);

  // 4a. Below minimum — stay `seeding`, persist what we have, return seeding failure.
  if (seed.pool.length < minPoolSize) {
    await deps.store.updateSession(sessionId, {
      pool: seed.pool,
      exclusion: seed.exclusion,
      ...(seed.shortfallWarning ? { seedingShortfallWarning: seed.shortfallWarning } : {}),
    });
    return {
      ok: false,
      error: {
        kind: 'seeding_failed',
        message: `seeded pool ${seed.pool.length} below minimum ${minPoolSize}`,
      },
    };
  }

  // 4b. Minimum met — transition to `active` and serve Turn 1.
  if (!canTransition('seeding', 'active')) {
    return {
      ok: false,
      error: { kind: 'seeding_failed', message: 'illegal lifecycle transition' },
    };
  }

  await deps.store.updateSession(sessionId, {
    status: 'active',
    pool: seed.pool,
    exclusion: seed.exclusion,
    currentQuestionIndex: 0,
    currentDifficulty: config.difficulty,
    startedAt: createdAt,
    ...(seed.shortfallWarning ? { seedingShortfallWarning: seed.shortfallWarning } : {}),
  });

  await deps.store.setPoolCache(sessionId, {
    pool: seed.pool,
    exclusion: seed.exclusion,
    currentQuestionIndex: 0,
    currentDifficulty: config.difficulty,
  });

  const isTargeted = config.sessionType === 'targeted';
  const questionText = isTargeted
    ? seed.pool[0]?.questionText ?? ''
    : buildTurn1Intro(config.role);

  const served: ServedQuestion = {
    sessionId,
    questionText,
    currentQuestionIndex: 0,
    totalQuestions: config.questionCount,
  };
  return { ok: true, value: served };
}

// ── resume (Req 2.1, 2.2, 2.3, 2.4, 2.5) ──────────────────────────────────────

export interface ResumeDeps {
  /** Read seam — Mongo is the authoritative source for resume (Req 2.1). */
  store: ResumeStore;
}

/** A resumed result is either a question to continue with or a finished report ref. */
export type ResumeResult = ServedQuestion | ReportRef;

/** Distinguish the two `resume` success shapes at the call site (route 21.1). */
export function isReportRef(value: ResumeResult): value is ReportRef {
  return (value as ReportRef).reportId !== undefined;
}

/**
 * Reconstruct the question text to re-serve at the session's persisted current
 * question index. Pure and deterministic over persisted state, so repeated resumes
 * without an intervening submit always yield the same question (idempotent resume —
 * Property 5):
 *
 *  - index 0  → the static Turn 1 intro (Req 2.3).
 *  - index 1  → the Turn 2 personalized follow-up, rebuilt from the persisted Turn 1
 *               transcript via the existing template/entity helpers (no LLM call).
 *  - index ≥2 → the next unanswered pool question, i.e. the domain/buffer question
 *               that was served at the current index but not yet answered. Answered
 *               domain turns (index ≥ 2) carry pool ids, so `selectNext` over those
 *               re-serves exactly the current question.
 *
 * Returns `null` when no question can be resolved at the index (e.g. the pool is
 * exhausted), which the caller maps to the completed/report path.
 */
export function resolveResumeQuestionText(session: InterviewSessionDoc): string | null {
  const index = session.currentQuestionIndex;
  const isTargeted = session.config.sessionType === 'targeted';

  if (!isTargeted) {
    if (index <= 0) return buildTurn1Intro(session.config.role);

    if (index === 1) {
      const turn1 = session.turns.find((t) => t.index === 0);
      return buildTurn2(buildTurn2Template(session.config.role), extractEntities(turn1?.transcript ?? ''));
    }
  }

  // For targeted, or index >= 2 of full → re-serve the current (unanswered) pool question.
  const answeredPoolIds = session.turns
    .filter((t) => isTargeted || t.index >= 2)
    .map((t) => t.questionId);
  const next = selectNext(session.pool, answeredPoolIds);
  return next ? next.questionText : null;
}

export function resolveResumeQuestionTags(session: InterviewSessionDoc): string[] {
  const index = session.currentQuestionIndex;
  const isTargeted = session.config.sessionType === 'targeted';

  if (!isTargeted) {
    if (index <= 0) return ['Introduction'];

    if (index === 1) {
      return ['Personalization', 'Follow-up', 'Project Experience'];
    }
  }

  // For targeted, or index >= 2 of full → tags of the current (unanswered) pool question.
  const answeredPoolIds = session.turns
    .filter((t) => isTargeted || t.index >= 2)
    .map((t) => t.questionId);
  const next = selectNext(session.pool, answeredPoolIds);
  return next ? next.tags : [];
}


/**
 * Resume an interrupted session.
 *
 * 1. Load the session from `interview_sessions` (Mongo source of truth); unknown id →
 *    `not_found`.
 * 2. Reject a session that does not belong to the authenticated candidate with an
 *    authorization error (Req 2.5, Property 6) — checked before any state is served.
 * 3. Rebuild the active state from the persisted current question index and current
 *    difficulty (Req 2.1) and serve the question at that index (Req 2.2), serving the
 *    Turn 1 intro when the index is 0 (Req 2.3).
 * 4. For a `completed` session, serve the question at the persisted index if one still
 *    exists (index < questionCount, e.g. an early exit with progress remaining);
 *    otherwise return the existing `coaching_reports` reference (Req 2.4).
 */
export async function resume(
  userId: string,
  sessionId: string,
  deps: ResumeDeps,
): Promise<Result<ResumeResult, OrchestratorError>> {
  const session = await deps.store.findSession(sessionId);
  if (!session) {
    return { ok: false, error: { kind: 'not_found' } };
  }

  // Ownership authorization — reject foreign sessions before serving anything.
  if (session.userId.toHexString() !== userId) {
    return { ok: false, error: { kind: 'authorization_error' } };
  }

  const totalQuestions = session.config.questionCount;
  const hasQuestionAtIndex = session.currentQuestionIndex < totalQuestions;

  // Completed session with no remaining question → return the report reference.
  if (session.status === 'completed' && !hasQuestionAtIndex) {
    if (session.reportId) {
      const reportId = session.reportId.toHexString();
      const report = await deps.store.findReport(reportId);
      return {
        ok: true,
        value: { reportId, status: report?.status ?? 'pending' },
      };
    }
    return { ok: false, error: { kind: 'not_found' } };
  }

  // Serve the question at the persisted index (active, or completed-with-progress).
  const questionText = resolveResumeQuestionText(session);
  if (questionText === null) {
    // No resolvable question — fall back to the report ref when one exists.
    if (session.reportId) {
      const reportId = session.reportId.toHexString();
      const report = await deps.store.findReport(reportId);
      return {
        ok: true,
        value: { reportId, status: report?.status ?? 'pending' },
      };
    }
    return { ok: false, error: { kind: 'pool_exhausted' } };
  }

  const served: ServedQuestion = {
    sessionId,
    questionText,
    currentQuestionIndex: session.currentQuestionIndex,
    totalQuestions,
  };
  return { ok: true, value: served };
}

// ── Per-submit state persistence (Req 2.6) ────────────────────────────────────

export interface PersistSubmitStateArgs {
  /** The index of the next question to serve, persisted as the resume base. */
  currentQuestionIndex: number;
  /** The current (already clamped) difficulty after the adaptive adjustment. */
  currentDifficulty: number;
}

export interface PersistSubmitStateDeps {
  /** Write seam plus the cache reader used to keep the Redis mirror consistent. */
  store: OrchestratorStore & PoolCacheStore;
}

/**
 * Persist the current question index and current difficulty after an answer
 * submission while the session is `active` (Req 2.6). Mongo remains the authoritative
 * resume base; the Redis pool cache is mirrored (preserving pool/exclusion) when
 * present so subsequent fast reads stay consistent. The full submit flow
 * (Feedback_Orchestrator, task 19.1; answer route, task 21.1) calls this after a
 * validated evaluation.
 */
export async function persistSubmitState(
  sessionId: string,
  args: PersistSubmitStateArgs,
  deps: PersistSubmitStateDeps,
): Promise<void> {
  await deps.store.updateSession(sessionId, {
    currentQuestionIndex: args.currentQuestionIndex,
    currentDifficulty: args.currentDifficulty,
  });

  const cache = await deps.store.getPoolCache(sessionId);
  if (cache) {
    await deps.store.setPoolCache(sessionId, {
      ...cache,
      currentQuestionIndex: args.currentQuestionIndex,
      currentDifficulty: args.currentDifficulty,
    });
  }
}
