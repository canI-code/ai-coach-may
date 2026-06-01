import { describe, it, expect } from 'vitest';
import {
  durationToMaxQuestions,
  isValidDuration,
  isInterviewOver,
  DURATION_OPTIONS,
} from '@/lib/interview/duration';

describe('duration.ts — durationToMaxQuestions', () => {
  it('maps 10 -> 10', () => expect(durationToMaxQuestions(10)).toBe(10));
  it('maps 15 -> 15', () => expect(durationToMaxQuestions(15)).toBe(15));
  it('maps 30 -> 25', () => expect(durationToMaxQuestions(30)).toBe(25));
  it('maps 45 -> 35', () => expect(durationToMaxQuestions(45)).toBe(35));

  it('unknown durations fall back to ~0.7 * minutes', () => {
    expect(durationToMaxQuestions(20)).toBe(14);
    expect(durationToMaxQuestions(5)).toBe(4);
  });
});

describe('duration.ts — isValidDuration', () => {
  it('returns true for all DURATION_OPTIONS', () => {
    for (const d of DURATION_OPTIONS) expect(isValidDuration(d)).toBe(true);
  });

  it('returns false for non-option values', () => {
    expect(isValidDuration(0)).toBe(false);
    expect(isValidDuration(20)).toBe(false);
    expect(isValidDuration(60)).toBe(false);
    expect(isValidDuration(-1)).toBe(false);
  });
});

describe('duration.ts — isInterviewOver', () => {
  const base = { startedAtMs: 0, durationMinutes: 10, maxQuestions: 10 };

  it('returns {over:true, reason:"max_questions"} when answeredCount >= maxQuestions', () => {
    const result = isInterviewOver({ ...base, nowMs: 1000, answeredCount: 10 });
    expect(result).toEqual({ over: true, reason: 'max_questions' });

    const over = isInterviewOver({ ...base, nowMs: 1000, answeredCount: 12 });
    expect(over).toEqual({ over: true, reason: 'max_questions' });
  });

  it('returns {over:true, reason:"time"} when elapsed >= durationMinutes * 60000', () => {
    const result = isInterviewOver({ ...base, nowMs: 10 * 60_000, answeredCount: 3 });
    expect(result).toEqual({ over: true, reason: 'time' });

    const over = isInterviewOver({ ...base, nowMs: 15 * 60_000, answeredCount: 3 });
    expect(over).toEqual({ over: true, reason: 'time' });
  });

  it('returns {over:false} when neither condition is met', () => {
    const result = isInterviewOver({ ...base, nowMs: 5 * 60_000, answeredCount: 3 });
    expect(result).toEqual({ over: false });
  });

  it('max_questions takes priority over time when both conditions are met', () => {
    const result = isInterviewOver({ ...base, nowMs: 20 * 60_000, answeredCount: 10 });
    expect(result).toEqual({ over: true, reason: 'max_questions' });
  });
});
