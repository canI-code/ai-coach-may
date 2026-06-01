'use client';

import type { JSX } from 'react';
import React from 'react';
import { FileText, PlayCircle, Video, MessageSquare } from 'lucide-react';
import { GlassCard, CardTitle } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import type { DashboardSessionSummary } from '@/lib/interview/dashboard-metrics';

export interface RecentInterviewsProps {
  sessions: DashboardSessionSummary[];
  /** Parent navigates (report or resume) for the chosen session. */
  onView: (session: DashboardSessionSummary) => void;
  className?: string;
}

/** Visual config per session status — pill colors + label. */
const STATUS_STYLES: Record<
  DashboardSessionSummary['status'],
  { label: string; pill: string }
> = {
  completed: {
    label: 'Completed',
    pill: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
  active: {
    label: 'Active',
    pill: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
  },
  seeding: {
    label: 'Preparing',
    pill: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
  },
  abandoned: {
    label: 'Abandoned',
    pill: 'bg-white/5 text-[#a1a1aa] border border-white/10',
  },
};

/** "May 31, 2:30 PM" */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function RecentInterviews({
  sessions,
  onView,
  className = '',
}: RecentInterviewsProps): JSX.Element {
  return (
    <GlassCard padding="lg" className={`bg-[#0a0a0b]/40 border-white/5 ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <CardTitle className="text-lg">Recent Interviews</CardTitle>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-10">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-[#a1a1aa]/60 mb-3">
            <Video size={22} />
          </div>
          <p className="text-sm text-[#a1a1aa]">No interviews yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const status = STATUS_STYLES[session.status];
            const canResume = session.status === 'active' || session.status === 'seeding';
            const canView = session.status === 'completed';

            return (
              <div
                key={session.sessionId}
                className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                    <MessageSquare size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white truncate">
                        {session.role}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0 ${status.pill}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="text-xs text-[#a1a1aa] truncate">
                      {formatCreatedAt(session.createdAt)}
                      {session.durationMinutes != null && (
                        <> &bull; {Number(session.durationMinutes.toFixed(3))} min</>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-500">
                      {session.ciScore != null ? Number(session.ciScore.toFixed(3)) : '—'}
                    </div>
                    <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider">
                      CI
                    </div>
                  </div>

                  {canView && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<FileText size={14} />}
                      iconPosition="left"
                      onClick={() => onView(session)}
                    >
                      View Report
                    </Button>
                  )}
                  {canResume && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<PlayCircle size={14} />}
                      iconPosition="left"
                      onClick={() => onView(session)}
                    >
                      Resume
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
