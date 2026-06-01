import type { Pace } from '../schemas';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

// ── Speech metrics ──────────────────────────────────────────────────────────

/** Words per minute. Returns 0 for non-positive durations. */
export function computeWpm(wordCount: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.round(((wordCount / durationSeconds) * 60) * 1000) / 1000;
}

export const FILLER_REGEX = /\b(um|uh|like|basically|actually|you know)\b/gi;

/** Count of filler-word matches. */
export function countFillers(transcript: string): number {
  const matches = transcript.match(FILLER_REGEX);
  return matches ? matches.length : 0;
}

/** slow when 0 < wpm < 90, fast when wpm > 170, normal otherwise. */
export function classifyPace(wpm: number): Pace {
  if (wpm > 160) return 'fast';
  if (wpm > 0 && wpm < 55) return 'slow';
  return 'normal';
}

// ── Vision-derived math ─────────────────────────────────────────────────────

/**
 * Eye-contact score: 100 while |yaw| and |pitch| are below 10°, decaying
 * linearly to 0 at 30°, optionally reduced by a gaze factor in [0,1].
 */
export function eyeContactScore(yawDeg: number, pitchDeg: number, gazeFactor = 1): number {
  const angle = Math.max(Math.abs(yawDeg), Math.abs(pitchDeg));
  let score: number;
  if (angle <= 10) score = 100;
  else if (angle >= 30) score = 0;
  else score = 100 * (1 - (angle - 10) / 20);
  score *= clamp(gazeFactor, 0, 1);
  return Math.round(clamp(score, 0, 100) * 1000) / 1000;
}

/** Composure = 100·(1 − (angry% + confused%)); fractions in [0,1]. */
export function composureScore(angryFraction: number, confusedFraction: number): number {
  const score = clamp(100 * (1 - (angryFraction + confusedFraction)), 0, 100);
  return Math.round(score * 1000) / 1000;
}

// ── Aggregation ─────────────────────────────────────────────────────────────

/** Arithmetic mean; always within [min, max] of a non-empty source array. */
export function movingAverage(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = arr.reduce((sum, n) => sum + n, 0) / arr.length;
  return Math.round(avg * 1000) / 1000;
}
