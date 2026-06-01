'use client';

/**
 * Interview history page (`/dashboard/b2c/interview-history`).
 *
 * Lists the candidate's past interview sessions (from `GET /api/interview/sessions`)
 * and links each to its Confidence Index report (completed) or back into the live
 * session (resumable). Strictly read-only over the user's own sessions.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  History,
  Loader2,
  Video,
  ChevronRight,
  FileText,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';

interface SessionItem {
  sessionId: string;
  role: string;
  aiPersona: string;
  questionCount: number;
  status: 'seeding' | 'active' | 'completed' | 'abandoned';
  reportId: string | null;
  earlyExitReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<SessionItem['status'], string> = {
  seeding: 'text-amber-300 border-amber-400/20 bg-amber-400/10',
  active: 'text-teal-300 border-teal-400/20 bg-teal-400/10',
  completed: 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10',
  abandoned: 'text-[#a1a1aa] border-white/10 bg-white/5',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InterviewHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/interview/sessions', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.message ?? data?.error ?? 'Failed to load interview history.');
          setLoading(false);
          return;
        }
        setSessions(data.sessions ?? []);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError('Network error loading your interview history.');
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
      <AmbientGlow color="teal" size="lg" />

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400">
              <History size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Interview History</h1>
              <p className="text-[#a1a1aa]">Review past sessions and their Confidence Index reports.</p>
            </div>
          </div>
          <Button icon={<Video size={16} />} onClick={() => router.push('/dashboard/b2c/interview')}>
            New Interview
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-teal-400" />
            <p className="text-sm text-[#a1a1aa]">Loading your interview history…</p>
          </div>
        ) : sessions.length === 0 && !error ? (
          <GlassCard padding="lg" className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/10 text-teal-400">
              <Video size={26} />
            </div>
            <CardTitle className="mb-2">No interviews yet</CardTitle>
            <CardDescription className="mb-6">
              Start your first mock interview to build your Confidence Index history.
            </CardDescription>
            <div className="flex justify-center">
              <Button icon={<ChevronRight size={16} />} onClick={() => router.push('/dashboard/b2c/interview')}>
                Start your first interview
              </Button>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const isCompleted = s.status === 'completed';
              const isResumable = s.status === 'active' || s.status === 'seeding';
              return (
                <GlassCard
                  key={s.sessionId}
                  padding="md"
                  className="flex items-center justify-between gap-4 hover:bg-white/[0.06] transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400 shrink-0">
                      <Video size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-white truncate">{s.role}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[s.status]}`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <div className="text-xs text-[#a1a1aa]">
                        {formatDate(s.createdAt)} · {s.questionCount} questions ·{' '}
                        {s.aiPersona.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isCompleted && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<FileText size={14} />}
                        onClick={() =>
                          router.push(`/dashboard/b2c/interview/${s.sessionId}/report`)
                        }
                      >
                        View Report
                      </Button>
                    )}
                    {isResumable && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<PlayCircle size={14} />}
                        onClick={() => router.push(`/dashboard/b2c/interview/${s.sessionId}`)}
                      >
                        Resume
                      </Button>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
