import {
  AnswerSubmitPayloadSchema,
  type AggregatedMetrics,
  type AnswerSubmitPayload,
  type Result,
  type Severity,
  type TimelineEntry,
} from '../schemas';
import { classifyPace } from './metrics';

export type Cue =
  | 'too-fast'
  | 'too-slow'
  | 'too-many-fillers'
  | 'poor-eye-contact'
  | 'poor-posture'
  | 'negative-emotion';

export interface CueInput {
  wpm: number;
  fillerCount: number;
  eyeContact: number;
  postureDistortion: boolean;
  emotion: string;
}

const NEGATIVE_EMOTIONS = ['angry', 'sad', 'confused'];

/** Cues for every breached threshold; empty when all metrics are within range. */
export function evaluateCues(m: CueInput): Cue[] {
  const cues: Cue[] = [];
  if (m.wpm > 160) cues.push('too-fast');
  if (m.wpm > 0 && m.wpm < 55) cues.push('too-slow');
  if (m.fillerCount > 3) cues.push('too-many-fillers');
  if (m.eyeContact < 60) cues.push('poor-eye-contact');
  if (m.postureDistortion) cues.push('poor-posture');
  if (NEGATIVE_EMOTIONS.includes(m.emotion)) cues.push('negative-emotion');
  return cues;
}

// ── Behavioral timeline ─────────────────────────────────────────────────────

const CUE_SEVERITY: Record<Cue, Severity> = {
  'too-fast': 'warning',
  'too-slow': 'warning',
  'too-many-fillers': 'warning',
  'poor-eye-contact': 'warning',
  'poor-posture': 'warning',
  'negative-emotion': 'critical',
};

const CUE_LABEL: Record<Cue, string> = {
  'too-fast': 'Speaking too fast',
  'too-slow': 'Speaking too slowly',
  'too-many-fillers': 'Too many filler words',
  'poor-eye-contact': 'Poor eye contact',
  'poor-posture': 'Poor posture',
  'negative-emotion': 'Negative emotion detected',
};

export interface CueEvent {
  tSeconds: number;
  cue: Cue;
}

/** mm:ss for a timestamp in seconds. */
export function formatTimestamp(tSeconds: number): string {
  const total = Math.max(0, Math.floor(tSeconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** Behavioral_Timeline entries ordered by non-decreasing timestamp. */
export function buildTimeline(events: CueEvent[]): TimelineEntry[] {
  return events
    .map((e) => ({ tSeconds: e.tSeconds, label: CUE_LABEL[e.cue], severity: CUE_SEVERITY[e.cue] }))
    .sort((a, b) => a.tSeconds - b.tSeconds);
}

// ── Submit-time aggregation (privacy boundary) ──────────────────────────────

export interface MetricBuffers {
  wpmArr: number[];
  fillerCount: number;
  eyeContactArr: number[];
  postureArr: number[];
  pitchVariance: number;
  loudnessVariance: number;
  sentiment: number;
  dominantEmotion: string;
  composure: number;
}

export function aggregate(buffers: MetricBuffers): AggregatedMetrics {
  const avgWpm = buffers.wpmArr.length
    ? buffers.wpmArr.reduce((a, b) => a + b, 0) / buffers.wpmArr.length
    : 0;
  return { ...buffers, pace: classifyPace(avgWpm) };
}

/**
 * Aggregate buffered numeric metrics into a strict AnswerSubmitPayload. Blocks
 * (returns an error) rather than ever transmitting raw media (Req 15.2).
 */
export function buildAnswerPayload(
  questionIndex: number,
  transcript: string,
  buffers: MetricBuffers,
): Result<AnswerSubmitPayload, { kind: 'aggregation_failed'; message: string }> {
  try {
    const payload = { questionIndex, transcript, metrics: aggregate(buffers) };
    const parsed = AnswerSubmitPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, error: { kind: 'aggregation_failed', message: parsed.error.message } };
    }
    return { ok: true, value: parsed.data };
  } catch (e) {
    return { ok: false, error: { kind: 'aggregation_failed', message: (e as Error).message } };
  }
}

/** Stateful coach used by the live UI to render cues and accrue the timeline. */
export class RealtimeCoach {
  private events: CueEvent[] = [];

  tick(tSeconds: number, input: CueInput): Cue[] {
    const cues = evaluateCues(input);
    for (const cue of cues) this.events.push({ tSeconds, cue });
    return cues;
  }

  timeline(): TimelineEntry[] {
    return buildTimeline(this.events);
  }

  reset(): void {
    this.events = [];
  }
}
