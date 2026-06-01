'use client';

import React from 'react';
import type { JSX } from 'react';
import { Target, BookOpen, ExternalLink } from 'lucide-react';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import type { WeaknessTagCount, DashboardResource } from '@/lib/interview/dashboard-metrics';

/**
 * FocusAreas
 *
 * Dashboard panel surfacing the candidate's most frequent weakness areas and the
 * learning resources matched to them. It consumes the aggregated shapes produced by
 * `dashboard-metrics` (`topWeaknessTags` + `recommendedResources`) and is a pure
 * presentational client component — no fetching or state of its own.
 *
 * Two stacked sections in one glass card:
 *   1. Focus Areas — weakness tags as amber pills (humanized label + subtle count).
 *   2. Recommended Resources — external links with title, tags, and an external-link icon.
 */

export interface FocusAreasProps {
  weaknessTags: WeaknessTagCount[];
  resources: DashboardResource[];
  className?: string;
}

const MUTED = '#a1a1aa';

/** Known CI category keys → human-readable labels. */
const KNOWN_TAG_LABELS: Record<string, string> = {
  technicalAccuracy: 'Technical Accuracy',
  communication: 'Communication',
  voiceCi: 'Voice Confidence',
  bodyCi: 'Body Confidence',
};

/**
 * Humanize a raw weakness tag: use the known category mapping when available,
 * otherwise title-case the raw tag (handles camelCase, snake_case, and kebab-case).
 */
function humanizeTag(tag: string): string {
  const known = KNOWN_TAG_LABELS[tag];
  if (known) return known;

  const words = tag
    // split camelCase / PascalCase boundaries
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // normalize separators to spaces
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return tag;

  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function FocusAreas({ weaknessTags, resources, className = '' }: FocusAreasProps): JSX.Element {
  return (
    <GlassCard className={className}>
      {/* Section 1: Focus Areas */}
      <div className="mb-4 flex items-center gap-2">
        <Target size={18} className="text-amber-400" />
        <CardTitle>Focus Areas</CardTitle>
      </div>

      {weaknessTags.length === 0 ? (
        <CardDescription>No weak areas — great, balanced performance.</CardDescription>
      ) : (
        <div className="flex flex-wrap gap-2">
          {weaknessTags.map(({ tag, count }) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300"
            >
              {humanizeTag(tag)}
              <span className="text-[10px] font-medium" style={{ color: MUTED }}>
                ×{count}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="my-6 h-px w-full bg-white/5" />

      {/* Section 2: Recommended Resources */}
      <div className="mb-4 flex items-center gap-2">
        <BookOpen size={18} className="text-amber-400" />
        <CardTitle>Recommended Resources</CardTitle>
      </div>

      {resources.length === 0 ? (
        <CardDescription>No resources matched yet.</CardDescription>
      ) : (
        <ul className="space-y-3">
          {resources.map((resource) => (
            <li key={resource.id}>
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3 transition-colors hover:border-amber-400/30 hover:bg-white/[0.07]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{resource.title}</p>
                  {resource.tags.length > 0 && (
                    <p className="mt-1 truncate text-xs" style={{ color: MUTED }}>
                      {resource.tags.map(humanizeTag).join(' · ')}
                    </p>
                  )}
                </div>
                <ExternalLink size={16} className="shrink-0" style={{ color: MUTED }} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

export default FocusAreas;
