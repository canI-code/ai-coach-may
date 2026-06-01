// Feature: candidate-dashboard-suite
// Configuration constants for the dashboard suite

export const POLL_INTERVAL_MS = 5000;
export const PENDING_TIMEOUT_MS = 120_000;
export const MAX_CONSECUTIVE_FAILURES = 3;

export const DIFFICULTY_BOUNDS = {
  min: 1,
  max: 5,
} as const;

export const TOP_WEAKNESS_TAG_COUNT = 5;
export const RECENT_SESSIONS_COUNT = 5;
export const MAX_RECOMMENDATION_RESOURCES = 5;
