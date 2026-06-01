'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Loader2,
  FileText,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { ReportView } from '../interview/components/ReportView';

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

interface PageProps {
  searchParams: Promise<{ session?: string }>;
}

export default function ReportsPage({ searchParams }: PageProps) {
  const router = useRouter();
  const resolvedSearchParams = use(searchParams);
  const sessionQuery = resolvedSearchParams.session;

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchedSessionId, setMatchedSessionId] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoading(true);
        const res = await fetch('/api/interview/sessions', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Failed to load sessions.');
        }
        const data = await res.json();
        const allSessions = (data.sessions || []) as SessionItem[];
        setSessions(allSessions);

        if (sessionQuery) {
          // Normalize the query: strip S- prefix and case-insensitive matching
          const cleanQuery = sessionQuery.replace(/^S-/i, '').toLowerCase();

          // Try exact match first
          let matched = allSessions.find(
            (s) => s.sessionId.toLowerCase() === cleanQuery
          );

          // Try suffix match next
          if (!matched) {
            matched = allSessions.find(
              (s) => s.sessionId.toLowerCase().endsWith(cleanQuery)
            );
          }

          if (matched && matched.status === 'completed') {
            setMatchedSessionId(matched.sessionId);
          } else {
            setError(
              matched && matched.status !== 'completed'
                ? 'This interview session was not completed. Reports are only available for completed sessions.'
                : 'Session report not found. Please verify the Session ID.'
            );
          }
        } else {
          setMatchedSessionId(null);
          setError('');
        }
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load reports.');
        setLoading(false);
      }
    }

    loadSessions();
  }, [sessionQuery]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
        <AmbientGlow color="teal" size="lg" />
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-[#a1a1aa] font-medium">Loading reports...</p>
      </div>
    );
  }

  // ── Render single report view ───────────────────────────────────────────
  if (matchedSessionId) {
    return (
      <div className="min-h-screen bg-transparent text-white p-0 relative">
        <AmbientGlow color="teal" size="lg" position="center" className="opacity-15" />
        <div className="max-w-4xl mx-auto relative z-10">
          <ReportView sessionId={matchedSessionId} />
        </div>
      </div>
    );
  }

  // ── Render list of completed reports ────────────────────────────────────
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8 relative">
      <AmbientGlow color="teal" size="lg" />

      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-md">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Interview Reports</h1>
              <p className="text-[#a1a1aa] text-sm mt-1">
                Access deep metrics and confidence breakdowns for your completed interviews.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <GlassCard className="border-red-400/20" padding="md">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div className="text-left">
                <CardTitle className="text-red-400 text-base mb-1">Unable to view report</CardTitle>
                <CardDescription className="text-red-300">{error}</CardDescription>
                {sessionQuery && (
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/dashboard/b2c/reports')}
                    className="mt-3 text-xs"
                  >
                    View All Reports
                  </Button>
                )}
              </div>
            </div>
          </GlassCard>
        )}

        {completedSessions.length === 0 ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <GlassCard className="max-w-md text-center border-amber-400/20" padding="lg">
              <div className="w-16 h-16 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mx-auto mb-4 border border-amber-500/10">
                <FileText size={32} />
              </div>
              <CardTitle className="text-2xl mb-2">No reports ready yet</CardTitle>
              <CardDescription className="mb-6">
                Completing a mock interview triggers automatic behavioral analysis. Complete an interview to see your detailed score report.
              </CardDescription>
              <Button onClick={() => router.push('/dashboard/b2c/interview')}>
                Start Mock Interview
              </Button>
            </GlassCard>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedSessions.map((session) => {
              const displayId = session.sessionId.slice(-3).toUpperCase();
              return (
                <div
                  key={session.sessionId}
                  onClick={() => router.push(`/dashboard/b2c/reports?session=S-${displayId}`)}
                  className="bg-[#111322]/80 hover:bg-[#16182a]/95 border border-white/[0.04] hover:border-amber-500/30 rounded-2xl p-6 transition-all duration-300 shadow-md group cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-all duration-300" />
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="inline-block text-[10px] font-mono font-bold tracking-wider text-amber-400 uppercase bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 mb-2">
                        Session S-{displayId}
                      </span>
                      <h3 className="text-lg font-bold text-white tracking-wide group-hover:text-amber-400 transition-colors">
                        {session.role}
                      </h3>
                      <p className="text-xs text-[#a1a1aa]">
                        Interviewer: {session.aiPersona.replace('_', ' ')}
                      </p>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.03] group-hover:bg-amber-500 group-hover:text-black border border-white/[0.04] text-[#a1a1aa] transition-all duration-300">
                      <ChevronRight size={18} />
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/[0.03] flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>{formatDate(session.createdAt)}</span>
                    <span className="font-medium flex items-center gap-1.5 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Report Ready
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
