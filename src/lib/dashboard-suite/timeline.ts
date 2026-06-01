// Feature: candidate-dashboard-suite
// Timeline formatting and ordering (pure)

import type { TimelineEntry } from './types';

export function formatTimestamp(tSeconds: number): string {
  const mm = Math.floor(tSeconds / 60);
  const ss = tSeconds % 60;
  const mmStr = mm.toString().padStart(2, '0');
  const ssStr = ss.toString().padStart(2, '0');
  return `${mmStr}:${ssStr}`;
}

export function orderTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => {
    if (a.tSeconds !== b.tSeconds) {
      return a.tSeconds - b.tSeconds;
    }
    // Stable sort: preserve original order for ties
    return 0;
  });
}
