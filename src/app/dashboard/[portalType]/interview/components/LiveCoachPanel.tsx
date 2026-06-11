'use client';

/**
 * LiveCoachPanel — the side panel that surfaces the candidate's live, browser-computed
 * delivery metrics and the accruing Behavioral_Timeline during an answer. It is purely
 * presentational and reads only the numeric metrics + timeline the Realtime_Coach has
 * aggregated locally; it never touches the network (Req 11.7) and never handles raw
 * audio/video (Req 15) — the page only ever passes it derived numbers.
 */

import React from 'react';
import type { Cue } from '@/lib/interview/browser/realtime-coach';
import type { TimelineEntry, Pace } from '@/lib/interview/schemas';
import { Activity, Eye, PersonStanding, Smile, Timer } from 'lucide-react';

export interface LiveMetricsView {
  wpm: number;
  pace: Pace;
  fillerCount: number;
  eyeContact: number; // 0..100
  composure: number; // 0..100
  postureDistortion: boolean;
  emotion: string;
}

interface LiveCoachPanelProps {
  /** Live numeric metrics for the current answer (browser-derived). */
  metrics: LiveMetricsView;
  /** Cues currently active (already evaluated by the Realtime_Coach). */
  activeCues: Cue[];
  /** Behavioral_Timeline entries accrued so far this session. */
  timeline: TimelineEntry[];
  /** Whether capture is live (mic/webcam streaming). */
  capturing: boolean;
  className?: string;
}

const SEVERITY_DOT: Record<TimelineEntry['severity'], string> = {
  info: 'bg-teal-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};

/** mm:ss for a timestamp in seconds (mirrors the coach's formatter). */
function formatTimestamp(tSeconds: number): string {
  const total = Math.max(0, Math.floor(tSeconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function MetricRow({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass = {
    neutral: 'text-white',
    good: 'text-teal-300',
    warn: 'text-amber-300',
    bad: 'text-red-300',
  }[tone];

  return (
    <div className="flex items-center justify-between py-2">
      <span className="flex items-center gap-2 text-sm text-muted">
        {icon}
        {label}
      </span>
      <span className={`text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

export function LiveCoachPanel({
  metrics,
  activeCues,
  timeline,
  capturing,
  className = '',
}: LiveCoachPanelProps) {
  const paceTone = metrics.pace === 'normal' ? 'good' : 'warn';
  const eyeTone = metrics.eyeContact < 60 ? 'bad' : metrics.eyeContact < 80 ? 'warn' : 'good';
  const composureTone =
    metrics.composure < 50 ? 'bad' : metrics.composure < 75 ? 'warn' : 'good';
  const fillerTone = metrics.fillerCount > 3 ? 'bad' : 'neutral';

  return (
    <aside
      className={`glass-card p-6 flex flex-col gap-6 ${className}`}
      aria-label="Live coaching panel"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">Live Coach</h3>
        <span
          className={`flex items-center gap-2 text-xs font-medium ${
            capturing ? 'text-teal-300' : 'text-muted'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              capturing ? 'bg-teal-400 animate-pulse' : 'bg-[rgba(255,255,255,0.2)]'
            }`}
          />
          {capturing ? 'Analyzing' : 'Idle'}
        </span>
      </div>

      <div className="divide-y divide-[rgba(255,255,255,0.06)]">
        <MetricRow
          icon={<Activity className="w-4 h-4" />}
          label="Pace"
          value={`${Math.round(metrics.wpm)} WPM · ${metrics.pace}`}
          tone={paceTone}
        />
        <MetricRow
          icon={<Timer className="w-4 h-4" />}
          label="Filler words"
          value={String(metrics.fillerCount)}
          tone={fillerTone}
        />
        <MetricRow
          icon={<Eye className="w-4 h-4" />}
          label="Eye contact"
          value={`${Math.round(metrics.eyeContact)}%`}
          tone={eyeTone}
        />
        <MetricRow
          icon={<PersonStanding className="w-4 h-4" />}
          label="Posture"
          value={metrics.postureDistortion ? 'Adjust' : 'Good'}
          tone={metrics.postureDistortion ? 'warn' : 'good'}
        />
        <MetricRow
          icon={<Smile className="w-4 h-4" />}
          label="Composure"
          value={`${Math.round(metrics.composure)}% · ${metrics.emotion}`}
          tone={composureTone}
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-white mb-3">
          Behavioral Timeline
          {timeline.length > 0 && (
            <span className="ml-2 text-xs text-muted">({timeline.length})</span>
          )}
        </h4>
        {timeline.length === 0 ? (
          <p className="text-xs text-muted">
            No coaching events yet. Notable moments appear here as you answer.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {timeline.map((entry, i) => (
              <li
                key={`${entry.tSeconds}-${entry.label}-${i}`}
                className="flex items-center gap-3 text-xs"
              >
                <span className="font-mono text-muted tabular-nums">
                  {formatTimestamp(entry.tSeconds)}
                </span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[entry.severity]}`} />
                <span className="text-white/90">{entry.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {activeCues.length > 0 && (
        <p className="text-xs text-amber-300/80" aria-live="polite">
          {activeCues.length} active cue{activeCues.length > 1 ? 's' : ''} — adjust your delivery.
        </p>
      )}
    </aside>
  );
}

export default LiveCoachPanel;
