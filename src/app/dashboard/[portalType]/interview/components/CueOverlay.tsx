'use client';

/**
 * CueOverlay — renders the live, rule-based coaching cues as a non-intrusive overlay on
 * top of the webcam feed. It is purely presentational: it receives the already-evaluated
 * `Cue[]` from the Realtime_Coach (computed locally in the browser) and renders them with
 * zero network access, satisfying the "render cues in the browser without sending data to
 * the backend" boundary (Req 11.7). When the cue set is empty (all metrics within range),
 * nothing is rendered.
 */

import React from 'react';
import type { Cue } from '@/lib/interview/browser/realtime-coach';
import {
  Gauge,
  Turtle,
  MessageCircleWarning,
  EyeOff,
  PersonStanding,
  Frown,
} from 'lucide-react';

interface CuePresentation {
  label: string;
  icon: React.ReactNode;
  /** Tailwind utility classes for the badge accent. */
  accent: string;
}

const CUE_PRESENTATION: Record<Cue, CuePresentation> = {
  'too-fast': {
    label: 'Slow down — speaking too fast',
    icon: <Gauge className="w-4 h-4" />,
    accent: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  },
  'too-slow': {
    label: 'Pick up the pace — speaking too slowly',
    icon: <Turtle className="w-4 h-4" />,
    accent: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  },
  'too-many-fillers': {
    label: 'Too many filler words',
    icon: <MessageCircleWarning className="w-4 h-4" />,
    accent: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  },
  'poor-eye-contact': {
    label: 'Maintain eye contact',
    icon: <EyeOff className="w-4 h-4" />,
    accent: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
  },
  'poor-posture': {
    label: 'Straighten your posture',
    icon: <PersonStanding className="w-4 h-4" />,
    accent: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
  },
  'negative-emotion': {
    label: 'Stay calm and composed',
    icon: <Frown className="w-4 h-4" />,
    accent: 'bg-red-500/15 border-red-500/30 text-red-300',
  },
};

interface CueOverlayProps {
  cues: Cue[];
  className?: string;
}

export function CueOverlay({ cues, className = '' }: CueOverlayProps) {
  if (cues.length === 0) return null;

  // Show only the first (most relevant) cue at a time as requested.
  const activeCue = cues[0];
  const p = CUE_PRESENTATION[activeCue];

  return (
    <div
      className={`flex flex-col items-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        key={activeCue}
        className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide backdrop-blur-md animate-in fade-in zoom-in-95 duration-300 ${p.accent}`}
      >
        {p.icon}
        <span>{p.label}</span>
      </div>
    </div>
  );
}

export default CueOverlay;
