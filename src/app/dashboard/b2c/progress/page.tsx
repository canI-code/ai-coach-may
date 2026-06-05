'use client';

import React, { use, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Loader2,
  FileText,
  AlertCircle,
  TrendingUp,
  Brain,
  Video,
  BookOpen,
  Calendar,
  Sparkles
} from 'lucide-react';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { ReportView } from '../interview/components/ReportView';
import { LineChart } from '../components/charts/LineChart';
import { RadarChart } from '../components/charts/RadarChart';

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

const TABS = [
  { value: 'overall', label: 'Overall Progress', icon: Brain, color: 'text-amber-400' },
  { value: 'interview', label: 'Mock Interviews', icon: Video, color: 'text-teal-400' },
  { value: 'exam', label: 'Exam Performance', icon: BookOpen, color: 'text-emerald-400' }
];

const TIMESCALES = [
  { value: 'week', label: 'Week-wise' },
  { value: 'month', label: 'Month-wise' },
  { value: 'year', label: 'Year-wise' }
];

function getStartOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

export default function ProgressPage({ searchParams }: PageProps) {
  const router = useRouter();
  const resolvedSearchParams = use(searchParams);
  const sessionQuery = resolvedSearchParams.session;

  // Active UI states
  const [activeTab, setActiveTab] = useState<'overall' | 'interview' | 'exam'>('overall');
  const [timescale, setTimescale] = useState<'week' | 'month' | 'year'>('month');

  // Loaded data states
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [examHistory, setExamHistory] = useState<any>(null);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchedSessionId, setMatchedSessionId] = useState<string | null>(null);

  useEffect(() => {
    async function loadAllData() {
      try {
        setLoading(true);
        setError('');

        // 1. Fetch interview sessions
        const sessionsRes = await fetch('/api/interview/sessions?flat=true', { cache: 'no-store' });
        let allSessions: SessionItem[] = [];
        if (sessionsRes.ok) {
          const sData = await sessionsRes.json();
          allSessions = (sData.sessions || []) as SessionItem[];
          setSessions(allSessions);
        }

        // 2. Fetch user profile for interests list
        const profileRes = await fetch('/api/students/profile');
        if (profileRes.ok) {
          const pData = await profileRes.json();
          if (pData.profile?.interests) {
            setUserInterests(pData.profile.interests);
          }
        }

        // 3. Fetch interview metrics
        const metricsRes = await fetch('/api/interview/dashboard');
        if (metricsRes.ok) {
          const mData = await metricsRes.json();
          if (mData.success && mData.metrics) {
            setDashboardMetrics(mData.metrics);
          }
        }

        // 4. Fetch exam history
        const examRes = await fetch('/api/students/exam/history');
        if (examRes.ok) {
          const eData = await examRes.json();
          setExamHistory(eData);
        }

        // 5. Handle Session parameter routing
        if (sessionQuery) {
          const cleanQuery = sessionQuery.replace(/^S-/i, '').toLowerCase();
          let matched = allSessions.find(
            (s) => s.sessionId.toLowerCase() === cleanQuery
          );
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
        }
      } catch (err: any) {
        console.error('Error loading progress data:', err);
        setError('Failed to load progress analytics.');
      } finally {
        setLoading(false);
      }
    }

    loadAllData();
  }, [sessionQuery]);

  // --- Compute Datasets ---

  const interviewPoints = useMemo(() => {
    if (!dashboardMetrics?.recentSessions) return [];
    return dashboardMetrics.recentSessions
      .filter((s: any) => s.status === 'completed' && s.ciScore !== null)
      .map((s: any) => ({
        date: new Date(s.createdAt),
        value: s.ciScore,
        type: 'interview' as const,
        label: s.role,
      }));
  }, [dashboardMetrics]);

  const examPoints = useMemo(() => {
    if (!examHistory?.attempts) return [];
    const pts: any[] = [];
    examHistory.attempts.forEach((session: any) => {
      session.attempts.forEach((att: any) => {
        if (att.date) {
          pts.push({
            date: new Date(att.date),
            value: att.scorePercentage,
            type: 'exam' as const,
            label: session.interests.join(', '),
          });
        }
      });
    });
    return pts;
  }, [examHistory]);

  // Dynamic grouping based on active tab and timescale selection
  const groupedPoints = useMemo(() => {
    let pts: any[] = [];
    if (activeTab === 'overall') {
      pts = [...interviewPoints, ...examPoints];
    } else if (activeTab === 'interview') {
      pts = interviewPoints;
    } else {
      pts = examPoints;
    }

    if (pts.length === 0) return [];

    // Sort chronologically
    pts.sort((a, b) => a.date.getTime() - b.date.getTime());

    const groups: Record<string, { sum: number; count: number; date: Date }> = {};
    pts.forEach((p) => {
      let key = '';
      if (timescale === 'week') {
        const sunday = getStartOfWeek(p.date);
        key = sunday.toISOString().slice(0, 10);
      } else if (timescale === 'month') {
        key = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = `${p.date.getFullYear()}`;
      }

      if (!groups[key]) {
        groups[key] = { sum: 0, count: 0, date: p.date };
      }
      groups[key].sum += p.value;
      groups[key].count += 1;
    });

    const result = Object.entries(groups).map(([key, g]) => {
      let label = '';
      if (timescale === 'week') {
        const d = new Date(key);
        label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } else if (timescale === 'month') {
        const [year, month] = key.split('-');
        const d = new Date(parseInt(year), parseInt(month) - 1, 1);
        label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      } else {
        label = key;
      }
      return {
        label,
        value: Math.round(g.sum / g.count),
        date: g.date,
      };
    });

    result.sort((a, b) => a.date.getTime() - b.date.getTime());
    return result;
  }, [activeTab, timescale, interviewPoints, examPoints]);

  const levelMapping = (value: number) => {
    if (value < 60) return 'Beginner';
    if (value <= 80) return 'Intermediate';
    return 'Expert';
  };

  // Compile Technical Skill Scores
  const interviewRoleAccuracies = useMemo(() => {
    if (!dashboardMetrics?.recentSessions) return {};
    const roleData: Record<string, { sum: number; count: number }> = {};
    dashboardMetrics.recentSessions.forEach((s: any) => {
      if (s.status === 'completed' && s.categoryScores?.technicalAccuracy != null) {
        const r = s.role;
        if (!roleData[r]) roleData[r] = { sum: 0, count: 0 };
        roleData[r].sum += s.categoryScores.technicalAccuracy;
        roleData[r].count += 1;
      }
    });
    const result: Record<string, number> = {};
    Object.entries(roleData).forEach(([role, data]) => {
      result[role] = Math.round(data.sum / data.count);
    });
    return result;
  }, [dashboardMetrics]);

  const technicalSkills = useMemo(() => {
    return userInterests.map((interest) => {
      const examStat = examHistory?.interestStats?.find((i: any) => i.interest === interest);
      const examVal = examStat ? examStat.percentage : null;
      const interviewVal = interviewRoleAccuracies[interest] ?? null;

      let overallVal = 0;
      if (activeTab === 'overall') {
        if (examVal !== null && interviewVal !== null) {
          overallVal = Math.round((examVal + interviewVal) / 2);
        } else if (examVal !== null) {
          overallVal = examVal;
        } else if (interviewVal !== null) {
          overallVal = interviewVal;
        }
      } else if (activeTab === 'interview') {
        overallVal = interviewVal || 0;
      } else {
        overallVal = examVal || 0;
      }

      return {
        name: interest,
        value: overallVal,
        hasData: examVal !== null || interviewVal !== null
      };
    });
  }, [activeTab, userInterests, examHistory, interviewRoleAccuracies]);

  // Compile Non-Tech Skills
  const nonTechSkills = useMemo(() => {
    const comm = dashboardMetrics?.categoryAverages?.communication ?? 0;
    const body = dashboardMetrics?.categoryAverages?.bodyCi ?? 0;
    const voice = dashboardMetrics?.categoryAverages?.voiceCi ?? 0;

    const examAttemptsList = examHistory?.attempts || [];
    let examScoreSum = 0;
    let examScoreCount = 0;
    examAttemptsList.forEach((s: any) => {
      s.attempts.forEach((a: any) => {
        examScoreSum += a.scorePercentage;
        examScoreCount++;
      });
    });
    const reasoning = examScoreCount > 0 ? Math.round(examScoreSum / examScoreCount) : 0;

    if (activeTab === 'overall') {
      return [
        { name: 'Communication', value: comm },
        { name: 'Body Posture', value: body },
        { name: 'Voice Modulation', value: voice },
        { name: 'Reasoning & Logic', value: reasoning },
      ];
    } else if (activeTab === 'interview') {
      return [
        { name: 'Communication', value: comm },
        { name: 'Body Posture', value: body },
        { name: 'Voice Modulation', value: voice },
      ];
    } else {
      return [
        { name: 'Reasoning & Logic', value: reasoning },
      ];
    }
  }, [activeTab, dashboardMetrics, examHistory]);

  // Compile Combined Skills Series Points
  const SKILL_COLORS = useMemo(() => [
    '#f59e0b', // Amber
    '#14b8a6', // Teal
    '#ec4899', // Pink
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#8b5cf6', // Violet
    '#ef4444', // Red
    '#06b6d4', // Cyan
  ], []);

  const skillsSeries = useMemo(() => {
    if (!userInterests || userInterests.length === 0) return [];
    
    return userInterests.map((skill, idx) => {
      const color = SKILL_COLORS[idx % SKILL_COLORS.length];
      const pts: any[] = [];

      if (activeTab === 'overall' || activeTab === 'interview') {
        const matchingInterviews = dashboardMetrics?.recentSessions
          ?.filter((s: any) => s.role === skill && s.status === 'completed' && s.ciScore !== null) || [];
        matchingInterviews.forEach((s: any) => {
          pts.push({
            date: new Date(s.createdAt),
            value: s.ciScore,
          });
        });
      }

      if (activeTab === 'overall' || activeTab === 'exam') {
        const matchingExamSessions = examHistory?.attempts?.filter((s: any) => s.interests.includes(skill)) || [];
        matchingExamSessions.forEach((session: any) => {
          const matchingAttempts = session.attempts || [];
          matchingAttempts.forEach((a: any) => {
            if (a.date) {
              const val = a.interestPercentages && a.interestPercentages[skill] !== undefined
                ? a.interestPercentages[skill]
                : a.scorePercentage;
              pts.push({
                date: new Date(a.date),
                value: val,
              });
            }
          });
        });
      }

      pts.sort((a, b) => a.date.getTime() - b.date.getTime());

      const formattedPoints = pts.map((p) => ({
        date: p.date,
        label: p.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }),
        value: p.value,
      }));

      return {
        name: skill,
        color,
        points: formattedPoints
      };
    }).filter(s => s.points.length > 0);
  }, [userInterests, activeTab, dashboardMetrics, examHistory, SKILL_COLORS]);

  // --- Rendering Helpers ---

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
        <AmbientGlow color="teal" size="lg" />
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-[#a1a1aa] font-medium">Loading progress metrics...</p>
      </div>
    );
  }

  if (matchedSessionId) {
    return (
      <div className="min-h-screen bg-transparent text-white p-0 relative">
        <AmbientGlow color="teal" size="lg" position="center" className="opacity-15" />
        <div className="max-w-4xl mx-auto relative z-10 p-4 md:p-8">
          <div className="mb-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/b2c/progress')}>
              ← Back to Progress Dashboard
            </Button>
          </div>
          <ReportView sessionId={matchedSessionId} />
        </div>
      </div>
    );
  }

  const overallHasData = interviewPoints.length > 0 || examPoints.length > 0;
  const isDataEmpty = 
    (activeTab === 'overall' && !overallHasData) ||
    (activeTab === 'interview' && interviewPoints.length === 0) ||
    (activeTab === 'exam' && examPoints.length === 0);

  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8 relative">
      <AmbientGlow color="teal" size="lg" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-md">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Progress Dashboard</h1>
              <p className="text-[#a1a1aa] text-sm mt-1">
                Monitor your proficiency improvements, exam scores, and mock interview trends.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <GlassCard className="border-red-400/20" padding="md">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div className="text-left">
                <CardTitle className="text-red-400 text-base mb-1">Error Loading Data</CardTitle>
                <CardDescription className="text-red-300">{error}</CardDescription>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Tab Selection */}
        <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/5 max-w-2xl">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setActiveTab(t.value as any)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#18181b] text-white border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.03)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} className={t.color} />
                {t.label}
              </button>
            );
          })}
        </div>

        {isDataEmpty ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <GlassCard className="max-w-md text-center border-amber-400/20" padding="lg">
              <div className="w-16 h-16 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mx-auto mb-4 border border-amber-500/10">
                <FileText size={32} />
              </div>
              <CardTitle className="text-2xl mb-2">No analytics data yet</CardTitle>
              <CardDescription className="mb-6">
                Practice exams or complete a mock interview to generate performance telemetry and track your learning velocity.
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => router.push('/dashboard/b2c/practice')} variant="secondary">
                  Practice Exam
                </Button>
                <Button onClick={() => router.push('/dashboard/b2c/interview')}>
                  Start Interview
                </Button>
              </div>
            </GlassCard>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Timeline Progress Graph */}
            <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp size={18} className="text-amber-500" />
                    Performance Timeline
                  </CardTitle>
                  <CardDescription>
                    Averaged tracking metric over chronological milestones
                  </CardDescription>
                </div>
                
                {/* Timescale selector */}
                <div className="flex p-0.5 rounded-lg bg-white/5 border border-white/10 select-none">
                  {TIMESCALES.map((ts) => (
                    <button
                      key={ts.value}
                      onClick={() => setTimescale(ts.value as any)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                        timescale === ts.value
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'text-[#a1a1aa] hover:text-white'
                      }`}
                    >
                      {ts.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-64 mt-4 relative">
                {groupedPoints.length > 0 ? (
                  <LineChart 
                    points={groupedPoints} 
                    accent={activeTab === 'interview' ? '#14b8a6' : activeTab === 'exam' ? '#10b981' : '#f59e0b'} 
                    max={100}
                    levelMapping={levelMapping}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted">
                    Insufficient timeline points for this view.
                  </div>
                )}
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Technical Skills Section */}
              <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5">
                <CardTitle className="text-lg flex items-center gap-2 mb-1">
                  <Sparkles size={18} className="text-amber-400" />
                  Technical Skill Progress
                </CardTitle>
                <CardDescription className="mb-6">
                  Aggregate skill accuracies mapped out of 100%
                </CardDescription>

                <div className="space-y-4">
                  {technicalSkills.map((skill) => (
                    <div key={skill.name} className="space-y-1.5">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-white/80 font-medium">{skill.name}</span>
                        <span className="text-amber-400 font-bold">
                          {skill.hasData ? `${skill.value}%` : 'Pending practice'}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/[0.02]">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500/80 to-amber-400 rounded-full transition-all duration-500"
                          style={{ width: skill.hasData ? `${skill.value}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Non-Technical Skill Profiles */}
              <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5">
                <CardTitle className="text-lg flex items-center gap-2 mb-1">
                  <Brain size={18} className="text-teal-400" />
                  Behavioral & Competency Skills
                </CardTitle>
                <CardDescription className="mb-6">
                  Multimodal metrics evaluated across mock sessions
                </CardDescription>

                <div className="space-y-4">
                  {nonTechSkills.map((skill) => (
                    <div key={skill.name} className="space-y-1.5">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-white/80 font-medium">{skill.name}</span>
                        <span className="text-teal-400 font-bold">{skill.value}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/[0.02]">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${skill.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* Radar Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5 flex flex-col items-center">
                <CardTitle className="text-lg w-full text-left mb-1">Technical Skills Radar</CardTitle>
                <CardDescription className="w-full text-left mb-6">Radar visualization of subject interests</CardDescription>
                <div className="flex items-center justify-center p-4">
                  <RadarChart axes={technicalSkills.map(s => ({ label: s.name, value: s.value }))} max={100} accent="#f59e0b" />
                </div>
              </GlassCard>

              <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5 flex flex-col items-center">
                <CardTitle className="text-lg w-full text-left mb-1">Behavioral Skills Radar</CardTitle>
                <CardDescription className="w-full text-left mb-6">Radar evaluation of soft-skill performance</CardDescription>
                <div className="flex items-center justify-center p-4">
                  {nonTechSkills.length >= 3 ? (
                    <RadarChart axes={nonTechSkills.map(s => ({ label: s.name, value: s.value }))} max={100} accent="#14b8a6" />
                  ) : (
                    <div className="h-48 flex items-center justify-center text-xs text-[#a1a1aa] italic">
                      Radar require at least 3 active categories.
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* Skill Focus Trend lines */}
            {userInterests.length > 0 && (
              <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar size={18} className="text-teal-400" />
                      Skill Focus Trend
                    </CardTitle>
                    <CardDescription>
                      View chronological progress across your selected interests
                    </CardDescription>
                  </div>

                  {/* Horizontal badge legend */}
                  <div className="flex flex-wrap gap-2">
                    {skillsSeries.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/90"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-64 mt-4 relative">
                  {skillsSeries.length > 0 ? (
                    <LineChart 
                      series={skillsSeries} 
                      height={224} 
                      max={100}
                      levelMapping={levelMapping}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-[#a1a1aa] italic">
                      No matching exam attempts or mock sessions for your selected interests yet.
                    </div>
                  )}
                </div>
              </GlassCard>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
