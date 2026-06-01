/**
 * Time-based interview configuration. The candidate picks a duration; the backend caps
 * the number of questions that can be asked within it (`maxQuestions`). The interview
 * ends when the time elapses (at whatever question count was reached) OR when the
 * question cap is hit — whichever comes first.
 */

export const DURATION_OPTIONS = [10, 15, 30, 45] as const;
export type DurationMinutes = (typeof DURATION_OPTIONS)[number];

/** Max questions askable within each supported duration. */
const MAX_QUESTIONS_BY_DURATION: Record<DurationMinutes, number> = {
  10: 10,
  15: 15,
  30: 25,
  45: 35,
};

export function isValidDuration(minutes: number): minutes is DurationMinutes {
  return (DURATION_OPTIONS as readonly number[]).includes(minutes);
}

/** Question cap for a duration; unknown durations fall back to ~0.7 questions/minute. */
export function durationToMaxQuestions(minutes: number): number {
  if (isValidDuration(minutes)) return MAX_QUESTIONS_BY_DURATION[minutes];
  return Math.max(1, Math.round(minutes * 0.7));
}

/** Whether the interview should end given elapsed time and questions answered. */
export function isInterviewOver(args: {
  startedAtMs: number;
  nowMs: number;
  durationMinutes: number;
  answeredCount: number;
  maxQuestions: number;
}): { over: boolean; reason?: 'time' | 'max_questions' } {
  if (args.answeredCount >= args.maxQuestions) return { over: true, reason: 'max_questions' };
  if (args.nowMs - args.startedAtMs >= args.durationMinutes * 60_000) {
    return { over: true, reason: 'time' };
  }
  return { over: false };
}
