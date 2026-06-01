'use client';

import React from 'react';
import { Info, AlertTriangle, AlertOctagon, Clock } from 'lucide-react';
import type { TimelineEntry, Severity } from '@/lib/interview/schemas';

/**
 * BehavioralTimeline (Req 20)
 *
 * Renders the session's Behavioral_Timeline entries as `mm:ss → event` rows with
 * severity styling. Entries are produced in the browser when coaching cues fire
 * (Req 20.1) and embedded in the `coaching_reports` record at compilation time
 * (Req 20.3). The component is a pure presentational client component — it receives
 * the already-compiled entries from {@link ReportView} and does no fetching itself.
 */

/**
 * Format a timestamp in seconds as `mm:ss` (Req 20.2). The formatted value
 * corresponds exactly to the entry's timestamp in seconds: minutes are the integer
 * number of whole minutes and seconds are the remainder, each zero-padded to two
 * digits. Negative/fractional inputs are floored to the nearest non-negative second
 * so the display never shows malformed values. Sessions longer than an hour keep a
 * monotonically increasing minute count (e.g. `72:05`).
 */
export function formatTimestamp(tSeconds: number): string {
  const safe = Number.isFinite(tSeconds) ? Math.max(0, Math.floor(tSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Per-severity visual treatment for a timeline row. */
const SEVERITY_STYLES: Record<
  Severity,
  { dot: string; badge: string; label: string; icon: React.ReactNode }
> = {
  info: {
    dot: 'bg-teal-400',
    badge: 'text-teal-300 border-teal-400/20 bg-teal-400/10',
    label: 'Info',
    icon: <Info size={14} />,
  },
  warning: {
    dot: 'bg-amber-400',
    badge: 'text-amber-300 border-amber-400/20 bg-amber-400/10',
    label: 'Warning',
    icon: <AlertTriangle size={14} />,
  },
  critical: {
    dot: 'bg-red-400',
    badge: 'text-red-300 border-red-400/20 bg-red-400/10',
    label: 'Critical',
    icon: <AlertOctagon size={14} />,
  },
};

function severityStyle(severity: Severity) {
  return SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;
}

interface BehavioralTimelineProps {
  entries: TimelineEntry[];
  className?: string;
}

export function BehavioralTimeline({ entries, className = '' }: BehavioralTimelineProps) {
  if (!entries || entries.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] py-10 text-center ${className}`}
      >
        <Clock className="mb-3 h-8 w-8 text-[#a1a1aa]" />
        <p className="text-sm text-[#a1a1aa]">
          No notable coaching moments were recorded during this session.
        </p>
      </div>
    );
  }

  // Render ordered by non-decreasing timestamp without mutating the source array.
  const ordered = [...entries].sort((a, b) => a.tSeconds - b.tSeconds);

  return (
    <ol className={`relative space-y-3 ${className}`} aria-label="Behavioral timeline">
      {ordered.map((entry, index) => {
        const style = severityStyle(entry.severity);
        return (
          <li
            key={`${entry.tSeconds}-${index}`}
            className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3 transition-colors hover:bg-white/[0.06]"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
              aria-hidden="true"
            />
            <time className="w-16 shrink-0 font-mono text-sm font-semibold text-white tabular-nums">
              {formatTimestamp(entry.tSeconds)}
            </time>
            <span className="shrink-0 text-[#a1a1aa]" aria-hidden="true">
              →
            </span>
            <span className="flex-1 text-sm text-white/90">{entry.label}</span>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}
            >
              {style.icon}
              {style.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default BehavioralTimeline;
