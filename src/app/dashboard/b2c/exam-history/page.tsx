'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { 
  History, Loader2, BookOpen, Target, Clock, AlertCircle, ChevronRight, 
  Award, BookOpenCheck, Lock, Sparkles, Trophy, Calendar, CheckCircle2, 
  RefreshCw, ChevronDown, ChevronUp, Save, BarChart2
} from 'lucide-react';

interface AttemptDetails {
  attemptId: string;
  attemptNumber: number;
  date: string;
  scorePercentage: number;
  level: string;
  duration: number;
  questionCount: number;
  isArchived?: boolean; // True if retrieved from local storage
}

interface InterestStat {
  interest: string;
  correct: number;
  total: number;
  percentage: number;
}

interface SessionGroup {
  sessionId: string | null;
  sessionType: 'initial' | 'practice';
  interests: string[];
  interestStats?: InterestStat[];
  totalQuestionCount: number;
  canRetake: boolean;
  attempts: AttemptDetails[];
}

export default function ExamHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionGroup[]>([]);
  const [interestStats, setInterestStats] = useState<InterestStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retakingSessionId, setRetakingSessionId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Helper: Retrieve archived pruned attempts from browser localStorage
  const getLocalPrunedAttempts = (sessionId: string): AttemptDetails[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('aicoach_pruned_attempts');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return parsed[sessionId] || [];
    } catch (e) {
      console.error('Failed to parse pruned attempts from localStorage:', e);
      return [];
    }
  };

  // Helper: Save a pruned attempt into browser localStorage
  const saveLocalPrunedAttempt = (sessionId: string, attempt: AttemptDetails) => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('aicoach_pruned_attempts');
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed[sessionId]) {
        parsed[sessionId] = [];
      }
      
      // Deduplicate to avoid adding duplicate items
      const exists = parsed[sessionId].some(
        (a: any) => a.attemptNumber === attempt.attemptNumber || a.attemptId === attempt.attemptId
      );
      
      if (!exists) {
        parsed[sessionId].push({ ...attempt, isArchived: true });
        localStorage.setItem('aicoach_pruned_attempts', JSON.stringify(parsed));
        console.log(`💾 Pruned attempt archived in browser storage:`, attempt);
      }
    } catch (e) {
      console.error('Failed to archive pruned attempt to localStorage:', e);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/students/exam/history');
      if (!res.ok) throw new Error('Failed to fetch exam history');
      const data = await res.json();

      setInterestStats(data.interestStats || []);
      
      const serverGroups: SessionGroup[] = data.attempts || [];

      // Merge server groups with browser's archived pruned attempts
      const mergedGroups = serverGroups.map(group => {
        if (group.sessionType === 'initial' || !group.sessionId) {
          return group;
        }

        const localPruned = getLocalPrunedAttempts(group.sessionId);
        
        // Combine server active attempts + local storage archived attempts
        const combined = [...localPruned, ...group.attempts];

        // Deduplicate attempts by attemptNumber
        const uniqueAttemptsMap = new Map<number, AttemptDetails>();
        combined.forEach(att => {
          uniqueAttemptsMap.set(att.attemptNumber, att);
        });

        const uniqueAttempts = Array.from(uniqueAttemptsMap.values());

        // Sort attempts chronologically by attemptNumber ascending
        uniqueAttempts.sort((a, b) => a.attemptNumber - b.attemptNumber);

        return {
          ...group,
          attempts: uniqueAttempts
        };
      });

      setSessions(mergedGroups);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRetake = async (sessionId: string) => {
    if (retakingSessionId) return;
    setRetakingSessionId(sessionId);
    setError('');

    try {
      const res = await fetch(`/api/students/exam/session/${sessionId}/retake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to trigger retake session');
      }

      // Archive pruned attempt in browser localStorage if provided by server
      if (data.prunedAttempt) {
        saveLocalPrunedAttempt(sessionId, data.prunedAttempt);
      }

      // Redirect immediately to the active practice exam room
      router.push(`/dashboard/b2c/practice/${data.sessionId}`);
    } catch (err: any) {
      setError(err.message);
      setRetakingSessionId(null);
    }
  };

  // Helper to format duration: seconds -> "Xm Ys"
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Helper to format date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get dynamic color class for proficiency level
  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'expert':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
      case 'advanced':
        return 'bg-violet-500/10 border-violet-500/30 text-violet-400';
      case 'intermediate':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'beginner':
      default:
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    }
  };

  const toggleExpand = (sId: string) => {
    setExpandedSessionId(expandedSessionId === sId ? null : sId);
  };

  // Global Metric Computations
  const totalSessionsCount = sessions.length;
  const practiceSessionsCount = sessions.filter(s => s.sessionType === 'practice').length;
  
  // Calculate average score across ALL completed attempts of all sessions
  const allAttemptsList = sessions.flatMap(s => s.attempts);
  const totalAttemptsCount = allAttemptsList.length;
  const avgScore = totalAttemptsCount > 0 
    ? Math.round(allAttemptsList.reduce((sum, a) => sum + a.scorePercentage, 0) / totalAttemptsCount) 
    : 0;
  
  const maxScore = totalAttemptsCount > 0 
    ? Math.round(Math.max(...allAttemptsList.map(a => a.scorePercentage))) 
    : 0;

  // Determine latest completed level from latest attempt of latest session
  const latestSession = sessions[0];
  const latestLevel = latestSession && latestSession.attempts.length > 0
    ? latestSession.attempts[latestSession.attempts.length - 1].level
    : '--';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-[#a1a1aa] font-medium">Retrieving exam timeline...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
      <AmbientGlow />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
              <History size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Exam History</h1>
              <p className="text-[#a1a1aa]">View your past assessment achievements, progress charts, and retake quizzes.</p>
            </div>
          </div>
          <Button 
            icon={<BookOpen size={16} />} 
            onClick={() => router.push('/dashboard/b2c/practice')} 
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-[0_0_20px_rgba(245,158,11,0.2)]"
          >
            New Practice Session
          </Button>
        </div>

        {/* Global Errors */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        {/* Dynamic Metrics Panel */}
        {totalSessionsCount > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard padding="md" className="bg-[#0a0a0b]/40 border-white/5 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Trophy size={16} />
                </div>
                <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider">Overall Level</span>
              </div>
              <div className="text-2xl font-bold mb-1 truncate">
                <span className={getLevelColor(latestLevel).split(' ').pop()}>
                  {latestLevel}
                </span>
              </div>
              <div className="text-xs text-[#a1a1aa]">Latest determined rating level</div>
            </GlassCard>

            <GlassCard padding="md" className="bg-[#0a0a0b]/40 border-white/5 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-3">
                <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400">
                  <CheckCircle2 size={16} />
                </div>
                <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider">Average Accuracy</span>
              </div>
              <div className="text-3xl font-bold text-teal-400 mb-1">{avgScore}%</div>
              <div className="text-xs text-[#a1a1aa]">Across all {totalAttemptsCount} total attempts</div>
            </GlassCard>

            <GlassCard padding="md" className="bg-[#0a0a0b]/40 border-white/5 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Sparkles size={16} />
                </div>
                <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider">Peak Accuracy</span>
              </div>
              <div className="text-3xl font-bold text-indigo-400 mb-1">{maxScore}%</div>
              <div className="text-xs text-[#a1a1aa]">Your lifetime record score</div>
            </GlassCard>

            <GlassCard padding="md" className="bg-[#0a0a0b]/40 border-white/5 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400">
                  <BookOpenCheck size={16} />
                </div>
                <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider">Active Quizzes</span>
              </div>
              <div className="text-3xl font-bold text-violet-400 mb-1">{practiceSessionsCount}</div>
              <div className="text-xs text-[#a1a1aa]">Individual practice sessions</div>
            </GlassCard>
          </div>
        )}

        {/* Knowledge by Interest Stats */}
        {interestStats.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Target size={18} className="text-amber-400" />
              <h2 className="text-lg font-bold text-white/90">Knowledge by Interest</h2>
              <span className="text-[10px] text-[#a1a1aa] bg-white/5 px-2 py-0.5 rounded-full">
                Across all sessions & retakes
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {interestStats.map(stat => {
                const scoreColor = stat.percentage >= 80 ? 'text-emerald-400' :
                  stat.percentage >= 60 ? 'text-amber-400' :
                  stat.percentage >= 40 ? 'text-orange-400' : 'text-rose-400';
                const barColor = stat.percentage >= 80 ? 'bg-emerald-500/30' :
                  stat.percentage >= 60 ? 'bg-amber-500/30' :
                  stat.percentage >= 40 ? 'bg-orange-500/30' : 'bg-rose-500/30';
                const fillColor = stat.percentage >= 80 ? 'bg-emerald-400' :
                  stat.percentage >= 60 ? 'bg-amber-400' :
                  stat.percentage >= 40 ? 'bg-orange-400' : 'bg-rose-400';
                return (
                  <GlassCard key={stat.interest} padding="sm" className="bg-[#0a0a0b]/40 border-white/5">
                    <div className="text-[11px] text-[#a1a1aa] font-medium truncate mb-2" title={stat.interest}>
                      {stat.interest}
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${scoreColor}`}>
                      {stat.percentage}%
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 mb-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${fillColor}`}
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-[#a1a1aa]/70">
                      {stat.correct}/{stat.total} correct
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        )}

        {/* Sessions Grouped Timeline List */}
        <div className="space-y-6">
          {totalSessionsCount > 0 ? (
            sessions.map((session, sIdx) => {
              const isInitial = session.sessionType === 'initial';
              const sId = session.sessionId || `initial-${sIdx}`;
              const isExpanded = expandedSessionId === sId;
              const isRetaking = retakingSessionId === session.sessionId;

              // Latest completed attempt from this session (last in chronologically sorted array)
              const latestAttempt = session.attempts[session.attempts.length - 1];
              const levelStyle = getLevelColor(latestAttempt.level);

              return (
                <GlassCard 
                  key={sId} 
                  padding="md" 
                  className="bg-[#0a0a0b]/30 border-white/5 hover:border-white/10 transition-all duration-300 relative"
                >
                  <div className="flex flex-col gap-6">
                    
                    {/* Collapsed Main Header Area */}
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                      
                      {/* Left Block: Info badges & Interest Tags */}
                      <div className="space-y-3 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Session Type Badge */}
                          {isInitial ? (
                            <div className="px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_10px_rgba(20,184,166,0.1)]">
                              <Award size={13} />
                              Initial Assessment
                            </div>
                          ) : (
                            <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                              <BookOpenCheck size={13} />
                              Practice Quiz ({session.attempts.length} {session.attempts.length === 1 ? 'Attempt' : 'Attempts'})
                            </div>
                          )}

                          {/* Latest Level Badge */}
                          <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${levelStyle}`}>
                            {latestAttempt.level}
                          </div>

                          {/* Latest Attempt Date */}
                          <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                            <Calendar size={13} />
                            {formatDate(latestAttempt.date)}
                          </div>
                        </div>

                        {/* Per-Interest Score Chips (aggregated across all retakes) */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(session.interestStats && session.interestStats.length > 0
                            ? session.interestStats
                            : session.interests.map(i => ({ interest: i, correct: 0, total: 0, percentage: 0 }))
                          ).map(stat => {
                            const chipColor = stat.total > 0
                              ? stat.percentage >= 80 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : stat.percentage >= 60 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : stat.percentage >= 40 ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              : 'bg-white/5 border-white/5 text-[#a1a1aa]';
                            return (
                              <span
                                key={stat.interest}
                                className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${chipColor}`}
                                title={`${stat.correct}/${stat.total} correct in this session`}
                              >
                                {stat.interest}{stat.total > 0 ? ` ${stat.percentage}%` : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Middle Block: Accuracy gauge and overall totals */}
                      <div className="flex flex-wrap items-center gap-6 lg:gap-12 w-full lg:w-auto">
                        
                        {/* Circular Score Gauge */}
                        <div className="flex items-center gap-3 min-w-[130px]">
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                              <circle 
                                cx="24" 
                                cy="24" 
                                r="20" 
                                stroke="currentColor" 
                                strokeWidth="4" 
                                strokeLinecap="round" 
                                fill="transparent" 
                                strokeDasharray="125" 
                                strokeDashoffset={125 - (125 * latestAttempt.scorePercentage) / 100} 
                                className={`${latestAttempt.scorePercentage >= 80 ? 'text-emerald-400' : latestAttempt.scorePercentage >= 50 ? 'text-amber-400' : 'text-rose-400'} transition-all duration-700 ease-out`} 
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                              {Math.round(latestAttempt.scorePercentage)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider leading-tight">Latest Score</div>
                            <div className="text-sm font-semibold text-white leading-tight">Accuracy</div>
                          </div>
                        </div>

                        {/* Question and duration metrics */}
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-[#a1a1aa]">
                              <BookOpen size={14} />
                            </div>
                            <div>
                              <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider leading-tight">Questions</div>
                              <div className="text-xs font-semibold text-white leading-tight">{latestAttempt.questionCount} Qs</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-[#a1a1aa]">
                              <Clock size={14} />
                            </div>
                            <div>
                              <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider leading-tight">Duration</div>
                              <div className="text-xs font-semibold text-white leading-tight">{formatDuration(latestAttempt.duration)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Block: Actions */}
                      <div className="w-full lg:w-auto lg:pl-4 flex items-center justify-between lg:justify-end gap-3">
                        <Button 
                          variant="secondary"
                          size="md"
                          onClick={() => toggleExpand(sId)}
                          className="bg-white/5 border-white/5 text-[#a1a1aa] hover:bg-white/10 hover:text-white flex items-center gap-1.5"
                          icon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        >
                          History Details
                        </Button>

                        {isInitial ? (
                          <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white/30 bg-white/5 border border-white/5 rounded-xl cursor-not-allowed">
                            <Lock size={13} />
                            Retake Locked
                          </div>
                        ) : session.canRetake ? (
                          <Button 
                            variant="secondary" 
                            size="md" 
                            onClick={() => handleRetake(session.sessionId!)}
                            disabled={isRetaking || !!retakingSessionId}
                            className="bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 font-semibold"
                            icon={isRetaking ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={13} />}
                          >
                            {isRetaking ? 'Preparing...' : 'Retake Quiz'}
                          </Button>
                        ) : (
                          <div 
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-500 bg-amber-500/5 border border-amber-500/10 rounded-xl cursor-help"
                            title="Rate limit reached: Maximum 2 retakes per 24 hours per session."
                          >
                            <AlertCircle size={13} />
                            Limit Reached (24h)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail Panel (Accordions with Timeline & Glow Line Graph) */}
                    {isExpanded && (
                      <div className="border-t border-white/5 pt-6 space-y-6 animate-fadeIn">
                        
                        {/* Graphical Score Progress Trend Sparkline */}
                        {session.attempts.length >= 2 ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-[#a1a1aa] font-semibold tracking-wide uppercase">
                              <BarChart2 size={14} className="text-indigo-400" />
                              Score Evolution Progress Graph
                            </div>
                            
                            <div className="w-full bg-[#0a0a0b]/20 border border-white/5 rounded-xl p-4 md:p-6 overflow-x-auto">
                              <div className="min-w-[480px]">
                                {/* High-Performance Glowing SVG Sparkline */}
                                <svg viewBox="0 0 500 130" className="w-full h-auto overflow-visible">
                                  <defs>
                                    {/* Line Gradient */}
                                    <linearGradient id={`line-grad-${sId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                      <stop offset="0%" stopColor="#f59e0b" />
                                      <stop offset="50%" stopColor="#8b5cf6" />
                                      <stop offset="100%" stopColor="#14b8a6" />
                                    </linearGradient>

                                    {/* Glow Blur Filter */}
                                    <filter id="glowing-blur" x="-20%" y="-20%" width="140%" height="140%">
                                      <feGaussianBlur stdDeviation="3.5" result="blur" />
                                      <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="SourceGraphic" />
                                      </feMerge>
                                    </filter>

                                    {/* Filled Area Gradient */}
                                    <linearGradient id={`area-grad-${sId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                                      <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
                                    </linearGradient>
                                  </defs>

                                  {/* Y-Axis Guideline grids (25%, 50%, 75%, 100%) */}
                                  {[25, 50, 75, 100].map(val => {
                                    const y = 25 + 70 - (val * 70) / 100;
                                    return (
                                      <g key={val}>
                                        <line x1="45" y1={y} x2="455" y2={y} stroke="white" strokeOpacity="0.03" strokeDasharray="3,3" />
                                        <text x="35" y={y + 3} textAnchor="end" className="text-[8px] fill-[#a1a1aa] font-medium opacity-50">{val}%</text>
                                      </g>
                                    );
                                  })}

                                  {/* Map attempt data to SVG coordinates */}
                                  {(() => {
                                    const N = session.attempts.length;
                                    const PaddingX = 45;
                                    const PaddingY = 25;
                                    const ActiveWidth = 410;
                                    const ActiveHeight = 70;
                                    
                                    const points = session.attempts.map((att, idx) => {
                                      const x = PaddingX + (N > 1 ? (idx * ActiveWidth) / (N - 1) : 0);
                                      const y = PaddingY + ActiveHeight - (att.scorePercentage * ActiveHeight) / 100;
                                      return { x, y, score: att.scorePercentage, num: att.attemptNumber, isArchived: att.isArchived };
                                    });

                                    const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                    const areaPath = `${linePath} L ${points[points.length - 1].x} 95 L ${points[0].x} 95 Z`;

                                    return (
                                      <>
                                        {/* Glow Area under the curve */}
                                        <path d={areaPath} fill={`url(#area-grad-${sId})`} />

                                        {/* Dynamic Glowing Trend Path Line */}
                                        <path 
                                          d={linePath} 
                                          stroke={`url(#line-grad-${sId})`} 
                                          strokeWidth="3.5" 
                                          fill="none" 
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          filter="url(#glowing-blur)"
                                        />

                                        {/* Visual nodes at each attempt point */}
                                        {points.map((p, idx) => (
                                          <g key={idx} className="group/node cursor-pointer">
                                            {/* Glowing indicator circles */}
                                            <circle 
                                              cx={p.x} 
                                              cy={p.y} 
                                              r="4.5" 
                                              className={`${p.isArchived ? 'fill-indigo-400' : 'fill-amber-400'} stroke-[#0a0a0b] stroke-2 shadow-[0_0_8px_rgba(245,158,11,0.5)]`} 
                                            />
                                            
                                            {/* Numeric percentage scores placed over the nodes */}
                                            <text 
                                              x={p.x} 
                                              y={p.y - 10} 
                                              textAnchor="middle" 
                                              className="text-[10px] font-bold fill-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                                            >
                                              {Math.round(p.score)}%
                                            </text>

                                            {/* Labels below chart */}
                                            <text 
                                              x={p.x} 
                                              y="114" 
                                              textAnchor="middle" 
                                              className="text-[9px] fill-[#a1a1aa] font-semibold"
                                            >
                                              Att #{p.num}{p.isArchived ? '*' : ''}
                                            </text>
                                          </g>
                                        ))}
                                      </>
                                    );
                                  })()}
                                </svg>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-[#a1a1aa] mt-2 border-t border-white/5 pt-2">
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Active Server Quiz Attempts
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span> Archived Local Storage Attempts (*)
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* Interactive Timeline List of individual attempts */}
                        <div className="space-y-2">
                          <div className="text-xs text-[#a1a1aa] font-semibold tracking-wide uppercase">
                            Quiz Attempts Timeline History
                          </div>
                          
                          <div className="overflow-hidden border border-white/5 rounded-xl bg-[#0a0a0b]/10 divide-y divide-white/5">
                            {session.attempts.map((att, index) => {
                              const isFirst = index === 0;
                              const isLast = index === session.attempts.length - 1;

                              return (
                                <div key={att.attemptId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-white/[0.02] transition-colors duration-150">
                                  
                                  {/* Left: Attempt count, status badges */}
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-md bg-white/5 border border-white/5 flex items-center justify-center text-xs font-bold text-white">
                                      #{att.attemptNumber}
                                    </div>
                                    <div>
                                      <div className="text-sm font-semibold flex items-center gap-1.5">
                                        {isFirst ? (
                                          <span className="text-amber-400">Original Attempt</span>
                                        ) : (
                                          <span className="text-white">Retake Quiz Attempt</span>
                                        )}

                                        {/* Archived badge */}
                                        {att.isArchived && (
                                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-bold flex items-center gap-0.5" title="Archived locally inside your browser storage.">
                                            <Save size={8} />
                                            Archived
                                          </span>
                                        )}
                                        {isLast && !isFirst && (
                                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                                            Latest
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-[#a1a1aa]">
                                        {formatDate(att.date)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: Score percentage, proficiency level Achieved, duration metrics */}
                                  <div className="flex flex-wrap items-center gap-4 sm:gap-8">
                                    <div className="flex items-center gap-4">
                                      {/* Duration */}
                                      <div className="text-xs text-[#a1a1aa] flex items-center gap-1">
                                        <Clock size={12} />
                                        {formatDuration(att.duration)}
                                      </div>
                                      {/* Question count */}
                                      <div className="text-xs text-[#a1a1aa] flex items-center gap-1">
                                        <BookOpen size={12} />
                                        {att.questionCount} Questions
                                      </div>
                                    </div>

                                    {/* Level pill */}
                                    <div className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getLevelColor(att.level)}`}>
                                      {att.level}
                                    </div>

                                    {/* Score Percentage display */}
                                    <div className="text-right min-w-[50px]">
                                      <div className={`text-sm font-bold ${att.scorePercentage >= 80 ? 'text-emerald-400' : att.scorePercentage >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                        {Math.round(att.scorePercentage)}%
                                      </div>
                                      <div className="text-[9px] text-[#a1a1aa] uppercase tracking-wider">Score</div>
                                    </div>
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
            })
          ) : (
            /* Empty State */
            <GlassCard padding="lg" className="text-center bg-[#0a0a0b]/40 border-white/5 py-16">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 mx-auto mb-6">
                <History size={32} />
              </div>
              <CardTitle className="text-2xl mb-3">No Exam History Yet</CardTitle>
              <CardDescription className="max-w-md mx-auto mb-8 text-base">
                You haven't completed any assessments or practice exams yet. Set up a custom practice exam session to start testing your proficiency and track your learning progress!
              </CardDescription>
              <Button 
                onClick={() => router.push('/dashboard/b2c/practice')}
                icon={<ChevronRight size={16} />}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-[0_0_20px_rgba(245,158,11,0.2)]"
              >
                Setup Practice Session
              </Button>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
