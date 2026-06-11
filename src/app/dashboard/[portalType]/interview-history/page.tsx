'use client';

/**
 * Interview history page (`/dashboard/b2c/interview-history`).
 *
 * Lists the candidate's past interview sessions (from `GET /api/interview/sessions`)
 * grouped by original session, showing a sparkline trend, details of each attempt,
 * and linking each to its Confidence Index report or live session.
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  History,
  Loader2,
  Video,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  BookOpen,
  Calendar,
  AlertCircle,
  Eye,
  RefreshCw,
  PlayCircle,
  Trophy,
  Sparkles,
  Award,
  BarChart2,
} from 'lucide-react';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { LineChart } from '../components/charts/LineChart';

interface InterviewAttempt {
  attemptId: string;
  attemptNumber: number;
  date: string;
  ciScore: number;
  reportStatus: 'pending' | 'ready' | 'failed';
  status: 'seeding' | 'active' | 'completed' | 'abandoned';
  startingDifficulty: number;
  durationMinutes: number;
  duration: number; // duration in seconds
  questionCount: number;
  questionsAnswered: number;
}

interface SessionGroup {
  sessionId: string;
  role: string;
  aiPersona: string;
  durationMinutes: number;
  attempts: InterviewAttempt[];
  latestDate: string;
  canRetake: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  seeding: 'text-amber-300 border-amber-400/20 bg-amber-400/10',
  active: 'text-teal-300 border-teal-400/20 bg-teal-400/10',
  completed: 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10',
  abandoned: 'text-[#a1a1aa] border-white/10 bg-white/5',
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Easy',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

function formatDifficulty(level: number): string {
  const label = DIFFICULTY_LABELS[level] ?? 'Intermediate';
  return `${label} (${level})`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const formatDuration = (seconds: number) => {
  if (!seconds || Number.isNaN(seconds)) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

export default function InterviewHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const portalType = (params?.portalType as string) || 'b2c';
  const [sessions, setSessions] = useState<SessionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retakingSessionId, setRetakingSessionId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

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

  const handleRetake = async (group: SessionGroup) => {
    if (retakingSessionId) return;
    setRetakingSessionId(group.sessionId);
    setError('');

    const latestAttempt = group.attempts[group.attempts.length - 1];

    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: group.role,
          difficulty: latestAttempt.startingDifficulty,
          durationMinutes: group.durationMinutes,
          aiPersona: group.aiPersona,
          difficultyMin: 1,
          difficultyMax: 5,
          parentSessionId: group.sessionId,
          attemptNumber: group.attempts.length + 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to trigger retake session');
      }

      router.push(`/dashboard/${portalType}/interview/${data.sessionId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to retake interview');
      setRetakingSessionId(null);
    }
  };

  const toggleExpand = (sessionId: string) => {
    setExpandedSessionId(expandedSessionId === sessionId ? null : sessionId);
  };

  // Metrics computation
  const totalAttemptsCount = sessions.reduce((sum, g) => sum + g.attempts.length, 0);
  const completedAttempts = sessions.flatMap(g => g.attempts).filter(a => a.status === 'completed');
  
  const avgCi = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((sum, a) => sum + a.ciScore, 0) / completedAttempts.length)
    : 0;

  const peakCi = completedAttempts.length > 0
    ? Math.round(Math.max(...completedAttempts.map(a => a.ciScore)))
    : 0;

  const uniqueRolesCount = new Set(sessions.map(g => g.role)).size;

  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
      <AmbientGlow color="teal" size="lg" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400">
              <History size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Interview History</h1>
              <p className="text-[#a1a1aa]">Review past sessions and Confidence Index (CI) progress trends.</p>
            </div>
          </div>
          <Button icon={<Video size={16} />} onClick={() => router.push(`/dashboard/${portalType}/interview`)}>
            New Interview
          </Button>
        </div>

        {/* Global Errors */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-teal-400" />
            <p className="text-sm text-[#a1a1aa]">Loading your interview history…</p>
          </div>
        ) : sessions.length === 0 ? (
          <GlassCard padding="lg" className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/10 text-teal-400">
              <Video size={26} />
            </div>
            <CardTitle className="mb-2">No interviews yet</CardTitle>
            <CardDescription className="mb-6">
              Start your first mock interview to build your Confidence Index history.
            </CardDescription>
            <div className="flex justify-center">
              <Button icon={<ChevronRight size={16} />} onClick={() => router.push(`/dashboard/${portalType}/interview`)}>
                Start your first interview
              </Button>
            </div>
          </GlassCard>
        ) : (
          <>
            {/* Dynamic Metrics Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <GlassCard padding="md" className="bg-[#0a0a0b]/40 border-white/5 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400">
                    <Trophy size={16} />
                  </div>
                  <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider">Average CI</span>
                </div>
                <div className="text-3xl font-bold text-teal-400 mb-1">{avgCi}%</div>
                <div className="text-xs text-[#a1a1aa]">Across all completed attempts</div>
              </GlassCard>

              <GlassCard padding="md" className="bg-[#0a0a0b]/40 border-white/5 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <Sparkles size={16} />
                  </div>
                  <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider">Peak CI</span>
                </div>
                <div className="text-3xl font-bold text-indigo-400 mb-1">{peakCi}%</div>
                <div className="text-xs text-[#a1a1aa]">Your highest Confidence Index</div>
              </GlassCard>

              <GlassCard padding="md" className="bg-[#0a0a0b]/40 border-white/5 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400">
                    <History size={16} />
                  </div>
                  <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider">Total Attempts</span>
                </div>
                <div className="text-3xl font-bold text-violet-400 mb-1">{totalAttemptsCount}</div>
                <div className="text-xs text-[#a1a1aa]">Across all mock sessions</div>
              </GlassCard>

              <GlassCard padding="md" className="bg-[#0a0a0b]/40 border-white/5 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Award size={16} />
                  </div>
                  <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider">Roles Practiced</span>
                </div>
                <div className="text-3xl font-bold text-amber-400 mb-1">{uniqueRolesCount}</div>
                <div className="text-xs text-[#a1a1aa]">Distinct target job roles</div>
              </GlassCard>
            </div>

            {/* Sessions Groups */}
            <div className="space-y-4">
              {sessions.map((group) => {
                const latestAttempt = group.attempts[group.attempts.length - 1];
                const completedCount = group.attempts.filter(a => a.status === 'completed').length;
                const groupAvgCi = completedCount > 0
                  ? Math.round(group.attempts.filter(a => a.status === 'completed').reduce((sum, a) => sum + a.ciScore, 0) / completedCount)
                  : 0;
                const groupPeakCi = completedCount > 0
                  ? Math.round(Math.max(...group.attempts.filter(a => a.status === 'completed').map(a => a.ciScore)))
                  : 0;

                return (
                  <GlassCard 
                    key={group.sessionId} 
                    padding="md" 
                    className="bg-[#0a0a0b]/30 border-white/5 hover:border-white/10 transition-all duration-300 relative"
                  >
                    <div className="flex flex-col gap-6">
                      
                      {/* Group Header Banner */}
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        
                        <div className="space-y-3 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-lg font-bold text-white leading-tight truncate">
                              {group.role}
                            </h2>

                            <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-semibold uppercase tracking-wider">
                              {group.aiPersona.replace(/_/g, ' ')}
                            </span>

                            <span className="px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs font-semibold">
                              {group.durationMinutes} mins
                            </span>

                            <span className="text-xs text-[#a1a1aa] bg-white/5 px-2 py-0.5 rounded-full">
                              {group.attempts.length} {group.attempts.length === 1 ? 'Attempt' : 'Attempts'}
                            </span>

                            <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                              <Calendar size={13} />
                              {formatDate(group.latestDate)}
                            </div>
                          </div>
                        </div>

                        {/* Average & Peak CI scores */}
                        {completedCount > 0 && (
                          <div className="flex flex-wrap items-center gap-6 lg:gap-12 w-full lg:w-auto">
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider leading-tight">Average CI</div>
                                <div className="text-xl font-bold text-teal-400 leading-tight">{groupAvgCi}%</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider leading-tight">Peak CI</div>
                                <div className="text-xl font-bold text-indigo-400 leading-tight">{groupPeakCi}%</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Actions: Toggle Details & Retake */}
                        <div className="w-full lg:w-auto lg:pl-4 flex items-center justify-between lg:justify-end gap-3">
                          <Button 
                            variant="secondary"
                            size="md"
                            onClick={() => toggleExpand(group.sessionId)}
                            className="bg-white/5 border-white/5 text-[#a1a1aa] hover:bg-white/10 hover:text-white flex items-center gap-1.5"
                            icon={expandedSessionId === group.sessionId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          >
                            History Details
                          </Button>

                          {group.canRetake ? (
                            <Button 
                              variant="secondary" 
                              size="md" 
                              onClick={() => handleRetake(group)}
                              disabled={retakingSessionId === group.sessionId || !!retakingSessionId}
                              className="bg-teal-500/10 border-teal-500/20 text-teal-400 hover:bg-teal-500/20 hover:text-teal-300 font-semibold"
                              icon={retakingSessionId === group.sessionId ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={13} />}
                            >
                              {retakingSessionId === group.sessionId ? 'Preparing...' : 'Retake Interview'}
                            </Button>
                          ) : (
                            <div 
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-500 bg-teal-500/5 border border-teal-500/10 rounded-xl cursor-help"
                              title="Rate limit reached: Maximum 2 retakes per 24 hours per session."
                            >
                              <AlertCircle size={13} />
                              Limit Reached (24h)
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Expanded details */}
                      {expandedSessionId === group.sessionId && (
                        <div className="border-t border-white/5 pt-6 space-y-6 animate-fadeIn">
                          
                          {/* Sparkline trend graph for Confidence Index progress */}
                          {group.attempts.filter(a => a.status === 'completed' && a.ciScore !== null).length >= 2 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs text-[#a1a1aa] font-semibold tracking-wide uppercase">
                                <BarChart2 size={14} className="text-teal-400" />
                                Confidence Index Trend
                              </div>
                              
                              <div className="w-full bg-[#0a0a0b]/20 border border-white/5 rounded-xl p-4 md:p-6">
                                <div className="h-56 relative">
                                  <LineChart 
                                    points={group.attempts
                                      .filter(a => a.status === 'completed' && a.ciScore !== null)
                                      .map(a => ({
                                        date: new Date(a.date),
                                        label: `Attempt #${a.attemptNumber}`,
                                        value: a.ciScore
                                      }))
                                    } 
                                    accent="#f59e0b" 
                                    max={100}
                                    height={224}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Timeline List of individual retry attempts */}
                          <div className="space-y-2">
                            <div className="text-xs text-[#a1a1aa] font-semibold tracking-wide uppercase">
                              Attempts History
                            </div>
                            
                            <div className="overflow-hidden border border-white/5 rounded-xl bg-[#0a0a0b]/10 divide-y divide-white/5">
                              {group.attempts.map((att, index) => {
                                const isFirst = index === 0;
                                const isLast = index === group.attempts.length - 1;
                                const isCompleted = att.status === 'completed';
                                const isResumable = att.status === 'active' || att.status === 'seeding';

                                return (
                                  <div key={att.attemptId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-white/[0.02] transition-colors duration-150">
                                    
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-xs font-bold text-teal-400">
                                        #{att.attemptNumber}
                                      </div>
                                      <div>
                                        <div className="text-sm font-semibold flex flex-wrap items-center gap-2">
                                          {isFirst ? (
                                            <span className="text-teal-400 font-medium">Original Attempt</span>
                                          ) : (
                                            <span className="text-white font-medium">Retake Attempt</span>
                                          )}
                                          {isLast && !isFirst && (
                                            <span className="px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[9px] font-bold">
                                              Latest
                                            </span>
                                          )}
                                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLES[att.status]}`}>
                                            {att.status}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-[#a1a1aa]">
                                          {formatDate(att.date)}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-[#a1a1aa]">
                                      <div>
                                        <span className="text-white/60">Starting:</span> {formatDifficulty(att.startingDifficulty)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {formatDuration(att.duration)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <BookOpen size={12} />
                                        {att.questionsAnswered} / {att.questionCount} Qs
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                      {isCompleted && (
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          icon={<Eye size={14} />}
                                          onClick={() => router.push(`/dashboard/${portalType}/interview/${att.attemptId}/report`)}
                                          className="hover:bg-teal-500/20 hover:text-teal-300"
                                          title="View Report"
                                        >
                                          View Report
                                        </Button>
                                      )}
                                      {isResumable && (
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          icon={<PlayCircle size={14} />}
                                          onClick={() => router.push(`/dashboard/${portalType}/interview/${att.attemptId}`)}
                                        >
                                          Resume
                                        </Button>
                                      )}
                                      
                                      {isCompleted && (
                                        <div className="text-right min-w-[60px]">
                                          <div className="text-sm font-bold text-teal-400">
                                            {Math.round(att.ciScore)}%
                                          </div>
                                          <div className="text-[8px] text-[#a1a1aa] uppercase tracking-wider">CI Score</div>
                                        </div>
                                      )}
                                    </div>

                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      )}

                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
