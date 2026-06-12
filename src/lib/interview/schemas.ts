import { z } from 'zod';
import type { ObjectId } from 'mongodb';

// ── LLM-output schemas (validated by Schema_Shield) ─────────────────────────

export const QuestionGenerationSchema = z.strictObject({
  questionText: z.string().min(1),
  idealAnswer: z.string().min(1),
  tags: z.array(z.string()),
  difficulty: z.number(),
});

export const QuestionEvaluationSchema = z.strictObject({
  technicalAccuracy: z.number().min(0).max(100),
  communication: z.number().min(0).max(100),
  voiceCi: z.number().min(0).max(100),
  bodyCi: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  difficultyAdjustment: z.enum(['increase', 'same', 'decrease']),
});

export const ReportNarrativeSchema = z.strictObject({
  narrative: z.string(),
  recommendations: z.array(
    z.strictObject({
      title: z.string(),
      url: z.string(),
      rationale: z.string(),
      weaknessTag: z.string(),
    }),
  ),
});

// ── Answer-submit payload (privacy boundary, Req 15) ────────────────────────
// `.strict()` rejects any unknown/binary/media field server- and client-side.

export const PaceSchema = z.enum(['slow', 'normal', 'fast']);

export const AggregatedMetricsSchema = z.strictObject({
  wpmArr: z.array(z.number()),
  fillerCount: z.number().min(0),
  eyeContactArr: z.array(z.number()),
  postureArr: z.array(z.number()),
  pitchVariance: z.number(),
  loudnessVariance: z.number(),
  sentiment: z.number(),
  dominantEmotion: z.string(),
  composure: z.number().min(0).max(100),
  pace: PaceSchema,
});

export const AnswerSubmitPayloadSchema = z.strictObject({
  questionIndex: z.number().int().min(0),
  transcript: z.string(),
  metrics: AggregatedMetricsSchema,
});

// ── Inferred types (single source of truth, shared client/server) ───────────

export type QuestionGeneration = z.infer<typeof QuestionGenerationSchema>;
export type QuestionEvaluation = z.infer<typeof QuestionEvaluationSchema>;
export type ReportNarrative = z.infer<typeof ReportNarrativeSchema>;
export type AggregatedMetrics = z.infer<typeof AggregatedMetricsSchema>;
export type AnswerSubmitPayload = z.infer<typeof AnswerSubmitPayloadSchema>;
export type Pace = z.infer<typeof PaceSchema>;

// ── Domain types ────────────────────────────────────────────────────────────

export type Persona = 'stress_interviewer' | 'tech_lead' | 'general_recruiter';
export type SessionStatus = 'seeding' | 'active' | 'completed' | 'abandoned';
export type QuestionOrigin = 'validated' | 'pending' | 'generated';
export type Severity = 'info' | 'warning' | 'critical';

export interface SessionConfig {
  role: string;
  difficulty: number;
  /** Backend-derived question cap (= durationToMaxQuestions(durationMinutes)), not user-supplied. */
  questionCount: number;
  durationMinutes: number;
  aiPersona: Persona;
  difficultyMin: number;
  difficultyMax: number;
  institutionCode?: string;
  sessionType?: 'full' | 'targeted';
  focusTags?: string[];
  parentSessionId?: string;
  attemptNumber?: number;
}

export interface ServedQuestion {
  sessionId: string;
  questionText: string;
  currentQuestionIndex: number;
  totalQuestions: number;
}

export interface ReportRef {
  reportId: string;
  status: 'pending' | 'ready' | 'failed';
}

export interface Entities {
  name?: string;
  experience?: string;
  techStack?: string;
}

export interface PooledQuestion {
  id: string;
  questionText: string;
  idealAnswer: string;
  difficulty: number;
  tags: string[];
  origin: QuestionOrigin;
}

export interface TimelineEntry {
  tSeconds: number;
  label: string;
  severity: Severity;
}

export interface TurnRecord {
  index: number;
  questionId: string;
  questionText?: string;
  questionOrigin?: 'generated' | 'database' | 'cover';
  transcript: string;
  metrics: AggregatedMetrics;
  evaluation?: QuestionEvaluation;
  difficultyAfter: number;
  createdAt: Date;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  tags: string[];
  institutionCode?: string;
  rationale?: string;
}

// ── Result / error unions ───────────────────────────────────────────────────

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type OrchestratorError =
  | { kind: 'validation_error'; message: string }
  | { kind: 'authorization_error' }
  | { kind: 'not_found' }
  | { kind: 'seeding_failed'; message: string }
  | { kind: 'evaluation_failed' }
  | { kind: 'pool_exhausted' };

// ── MongoDB collection document shapes (database `aicoach`) ──────────────────

export interface InterviewSessionDoc {
  _id: ObjectId;
  userId: ObjectId;
  status: SessionStatus;
  config: Omit<SessionConfig, 'institutionCode'>;
  institutionCode?: string;
  currentQuestionIndex: number;
  currentDifficulty: number;
  pool: PooledQuestion[];
  exclusion: string[];
  turns: TurnRecord[];
  behavioralTimeline: TimelineEntry[];
  seedingShortfallWarning?: string;
  earlyExitReason?: string;
  reportId?: ObjectId;
  batchId?: ObjectId;
  startedAt?: Date;
  parentSessionId?: ObjectId;
  attemptNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewQuestionDoc {
  _id: ObjectId;
  questionText: string;
  idealAnswer: string;
  role: string;
  difficulty: number;
  tags: string[];
  status: 'validated' | 'pending';
  is_validated: boolean;
  rejected?: boolean;
  source: 'seed' | 'on_demand' | 'deep_dive';
  createdAt: Date;
  validatedAt?: Date;
  validatedBy?: ObjectId;
}

export interface CoachingReportDoc {
  _id: ObjectId;
  sessionId: ObjectId;
  userId: ObjectId;
  status: 'pending' | 'ready' | 'failed';
  ciScore: number;
  categoryScores: {
    technicalAccuracy: number;
    communication: number;
    voiceCi: number;
    bodyCi: number;
  };
  weaknessTags: string[];
  resources: Resource[];
  narrative?: string;
  behavioralTimeline: TimelineEntry[];
  batchId?: ObjectId;
  persistenceError?: string;
  resourcesError?: boolean;
  createdAt: Date;
  readyAt?: Date;
}
