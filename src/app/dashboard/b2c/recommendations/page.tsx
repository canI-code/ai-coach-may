'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lightbulb,
  Loader2,
  AlertCircle,
  ExternalLink,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  Sparkles,
  Play,
  Trophy,
  Mic,
  Eye,
} from 'lucide-react';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { selectRecommendationState } from '@/lib/dashboard-suite/recommendation';
import type { Resource } from '@/lib/dashboard-suite/types';

interface SessionItem {
  sessionId: string;
  role: string;
  aiPersona: string;
  status: 'seeding' | 'active' | 'completed' | 'abandoned';
  reportId: string | null;
  createdAt: string;
}

interface PageProps {
  searchParams: Promise<{ session?: string }>;
}

const ADVANCED_RESOURCES = [
  {
    title: "Vocal Gravitas: Pacing, Silence & Filler Word Elimination",
    rationale: "Although your voice control is strong, mastering strategic pauses and pitch modulation can project executive authority.",
    url: "https://hbr.org/2014/06/how-to-project-gravitas-during-a-presentation",
    category: "voiceCi"
  },
  {
    title: "Advanced System Design & Scalability Architecture Guide",
    rationale: "Maintain your technical edge by reviewing complex distributed systems, microservices, and load balancing patterns.",
    url: "https://github.com/donnemartin/system-design-primer",
    category: "technicalAccuracy"
  },
  {
    title: "Executive STAR Structure: Leading with Situation, Task & Results",
    rationale: "Elevate your communication by focusing on business impact, financial outcomes, and organizational scale in your behavioral stories.",
    url: "https://www.indeed.com/career-advice/interviewing/how-to-use-the-star-method-in-an-interview",
    category: "communication"
  },
  {
    title: "Professional Visual Presence & Executive Body Language",
    rationale: "Refine micro-expressions, sustained professional eye contact, and relaxed posture to build rapid rapport with senior stakeholders.",
    url: "https://www.forbes.com/sites/carolkinseygoman/2020/02/09/executive-presence-nonverbal-cues-that-can-make-or-break-your-career/",
    category: "bodyCi"
  }
];

const CATEGORY_MAP = {
  technicalAccuracy: "Technical Accuracy",
  communication: "Communication & STAR",
  voiceCi: "Voice Confidence",
  bodyCi: "Body Language"
};

export default function RecommendationsPage({ searchParams }: PageProps) {
  const router = useRouter();
  const resolvedSearchParams = use(searchParams);
  const sessionQuery = resolvedSearchParams.session;

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [recommendationData, setRecommendationData] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [weaknessTags, setWeaknessTags] = useState<string[]>([]);
  const [isLaunchingPractice, setIsLaunchingPractice] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError('');

        // 1. Load all sessions
        const res = await fetch('/api/interview/sessions', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load sessions.');
        const data = await res.json();
        const allSessions = (data.sessions || []) as SessionItem[];
        setSessions(allSessions);

        const completed = allSessions.filter((s) => s.status === 'completed');

        if (completed.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Select target session
        let target: SessionItem | undefined;
        if (sessionQuery) {
          const cleanQuery = sessionQuery.replace(/^S-/i, '').toLowerCase();
          target = completed.find(
            (s) =>
              s.sessionId.toLowerCase() === cleanQuery ||
              s.sessionId.toLowerCase().endsWith(cleanQuery)
          );
          if (!target) {
            throw new Error('Interview session report not found.');
          }
        } else {
          // Use latest completed session
          target = completed[0];
        }

        setSelectedSession(target);

        // 3. Fetch report data
        const reportRes = await fetch(`/api/interview/${target.sessionId}/report`, {
          cache: 'no-store',
        });
        if (!reportRes.ok) throw new Error('Failed to load recommendations.');
        const reportData = await reportRes.json();

        if (reportData.status === 'pending') {
          setRecommendationData({ type: 'preparing' });
        } else if (reportData.status === 'failed') {
          throw new Error('The session report failed to compile.');
        } else if (reportData.status === 'ready' && reportData.report) {
          const rep = reportData.report;
          setReport(rep);
          setWeaknessTags(rep.weaknessTags || []);
          // Apply pure selectRecommendationState
          const state = selectRecommendationState({
            resourcesStatus: rep.perTurnHistory ? 'ok' : 'query_failed', // fallback if error occurs
            weaknessTags: rep.weaknessTags || [],
            resources: rep.resources || [],
          });
          setRecommendationData(state);
        } else {
          throw new Error('Report data is unavailable.');
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Something went wrong.');
        setLoading(false);
      }
    }

    init();
  }, [sessionQuery]);

  const launchTargetedPractice = async () => {
    if (!selectedSession) return;
    try {
      setIsLaunchingPractice(true);
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedSession.role,
          difficulty: 3,
          durationMinutes: 10,
          difficultyMin: 1,
          difficultyMax: 5,
          aiPersona: selectedSession.aiPersona || 'general_recruiter',
          sessionType: 'targeted',
          focusTags: weaknessTags,
        }),
      });
      if (!res.ok) throw new Error('Failed to launch targeted practice.');
      const data = await res.json();
      if (data.success && data.sessionId) {
        router.push(`/dashboard/b2c/interview/${data.sessionId}`);
      } else {
        throw new Error('No session ID returned.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start practice session.');
      setIsLaunchingPractice(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
        <AmbientGlow color="teal" size="lg" />
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-[#a1a1aa] font-medium">Analyzing focus areas...</p>
      </div>
    );
  }

  // ── No completed sessions empty state ───────────────────────────────────
  if (sessions.filter((s) => s.status === 'completed').length === 0) {
    return (
      <div className="min-h-screen bg-transparent text-white p-4 md:p-8 relative">
        <AmbientGlow color="teal" size="lg" />
        <div className="max-w-3xl mx-auto space-y-6 relative z-10 flex flex-col items-center justify-center min-h-[60vh]">
          <GlassCard className="max-w-md text-center border-amber-400/20" padding="lg">
            <div className="w-16 h-16 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mx-auto mb-4 border border-amber-500/10">
              <Lightbulb size={32} />
            </div>
            <CardTitle className="text-2xl mb-2">No recommendations yet</CardTitle>
            <CardDescription className="mb-6">
              Complete your first mock interview! Our AI Coach will identify your weak spots and curates learning resources specifically tailored to help you bridge the gap.
            </CardDescription>
            <Button onClick={() => router.push('/dashboard/b2c/interview')}>
              Start Mock Interview
            </Button>
          </GlassCard>
        </div>
      </div>
    );
  }

  const sessionDisplayId = selectedSession?.sessionId.slice(-3).toUpperCase();

  const isNoWeakness = recommendationData?.type === 'no-weaknesses';
  const isNoMatched = recommendationData?.type === 'no-matched-resources';
  const hasResources = recommendationData?.type === 'resources';
  
  let displayResources = [];
  if (hasResources) {
    displayResources = recommendationData.resources;
  } else if (isNoWeakness || isNoMatched) {
    displayResources = ADVANCED_RESOURCES;
  }

  const ci = report?.ciScore ? Math.round(report.ciScore) : 0;
  const scores = report?.categoryScores || {
    technicalAccuracy: 0,
    communication: 0,
    voiceCi: 0,
    bodyCi: 0
  };

  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8 relative">
      <AmbientGlow color="teal" size="lg" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-md">
              <Lightbulb size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AI Mastery Hub</h1>
              <p className="text-[#a1a1aa] text-sm mt-1">
                Personalized study roadmaps and targeted training mock drills.
              </p>
            </div>
          </div>
          {selectedSession && (
            <Button
              variant="secondary"
              icon={<BarChart3 size={16} />}
              onClick={() => router.push(`/dashboard/b2c/reports?session=S-${sessionDisplayId}`)}
            >
              Full Report
            </Button>
          )}
        </div>

        {/* Error Handling */}
        {error && (
          <GlassCard className="border-red-400/20" padding="md">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div className="text-left">
                <CardTitle className="text-red-400 text-base mb-1">Roadmap Unavailable</CardTitle>
                <CardDescription className="text-red-300">{error}</CardDescription>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Selected Session Info Bar */}
        {selectedSession && !error && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-[#a1a1aa]">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-amber-400 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                Session S-{sessionDisplayId}
              </span>
              <span className="font-medium text-white">{selectedSession.role}</span>
            </div>
            <div>
              {sessions.filter((s) => s.status === 'completed').length > 1 && (
                <select
                  value={selectedSession.sessionId}
                  onChange={(e) => {
                    const matched = sessions.find((s) => s.sessionId === e.target.value);
                    if (matched) {
                      const id = matched.sessionId.slice(-3).toUpperCase();
                      router.push(`/dashboard/b2c/recommendations?session=S-${id}`);
                    }
                  }}
                  className="bg-[#161827] text-white border border-white/10 rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  {sessions
                    .filter((s) => s.status === 'completed')
                    .map((s) => {
                      const id = s.sessionId.slice(-3).toUpperCase();
                      return (
                        <option key={s.sessionId} value={s.sessionId}>
                          Session S-{id} ({s.role})
                        </option>
                      );
                    })}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Main Hub Layout */}
        {recommendationData && !error && (
          <div className="space-y-6">
            {/* 1. Preparing State */}
            {recommendationData.type === 'preparing' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-amber-400" />
                <h2 className="mb-2 text-xl font-bold text-white">Compiling recommendations...</h2>
                <p className="max-w-md text-sm text-[#a1a1aa]">
                  We are matching tailored learning resources to your technical and behavioral performance.
                </p>
              </div>
            )}

            {/* 2. Resource Unavailable */}
            {recommendationData.type === 'resource-unavailable' && (
              <GlassCard className="border-red-400/20" padding="lg">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-8 h-8 text-red-400 shrink-0" />
                  <div className="text-left">
                    <CardTitle className="text-lg mb-2">Resources Temporarily Unavailable</CardTitle>
                    <CardDescription>
                      We had trouble loading our curated library catalog. Please verify your internet connection or check back in a few minutes.
                    </CardDescription>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* 3. Main Dashboard Hub Grid */}
            {recommendationData.type !== 'preparing' && recommendationData.type !== 'resource-unavailable' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Columns (Roadmap & Drills - 2/3 width) */}
                <div className="lg:col-span-2 space-y-8">
                  
                  {/* Banners */}
                  {isNoWeakness && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-left relative overflow-hidden flex flex-col md:flex-row items-center gap-4 shadow-md">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Stellar Performance!</h3>
                        <p className="text-sm text-gray-300">
                          You scored above 65 in all technical and behavioral categories. Keep up the high standard or push your limits with our advanced study guides below!
                        </p>
                      </div>
                    </div>
                  )}

                  {isNoMatched && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-left relative overflow-hidden flex flex-col md:flex-row items-center gap-4 shadow-md">
                      <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <AlertCircle size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Focus Areas Identified</h3>
                        <p className="text-sm text-gray-300">
                          We identified active skill gaps in your performance, but no exact matching study guides are in our database yet. Review the details, or explore our recommended advanced masterclasses below.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Targeted Practice Launcher */}
                  <div className="bg-gradient-to-br from-[#1b1c2b] to-[#121324] border border-amber-500/30 p-8 rounded-3xl relative overflow-hidden group shadow-[0_4px_30px_rgba(245,158,11,0.05)]">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/[0.03] rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/[0.06] transition-all duration-500" />
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                      <div className="space-y-3 text-left max-w-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                            {isNoWeakness ? <Sparkles size={16} /> : <BookOpen size={16} />}
                          </div>
                          <h3 className="text-lg font-bold text-white">
                            {isNoWeakness ? 'Advanced Mastery Practice Drill' : 'Targeted Micro-Practice Drill'}
                          </h3>
                        </div>
                        
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {isNoWeakness 
                            ? 'Supercharge your skills! You have balanced high performance, but there is always room to improve. Start an advanced 10-minute mock drill to maintain your edge.'
                            : `Ready to test your improvement? Start a high-impact, 10-minute targeted mock interview focused specifically on: `}
                          {!isNoWeakness && (
                            <span className="flex flex-wrap gap-1.5 mt-2">
                              {weaknessTags.map((tag) => (
                                <span key={tag} className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                  {CATEGORY_MAP[tag as keyof typeof CATEGORY_MAP] || tag}
                                </span>
                              ))}
                            </span>
                          )}
                        </p>
                      </div>

                      <button
                        onClick={launchTargetedPractice}
                        disabled={isLaunchingPractice}
                        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-600 active:scale-95 disabled:opacity-50 transition-all text-sm shrink-0 shadow-lg hover:shadow-amber-500/15 cursor-pointer"
                      >
                        {isLaunchingPractice ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Launching...
                          </>
                        ) : (
                          <>
                            {isNoWeakness ? 'Launch Mastery Drill' : 'Launch Practice Drill'}
                            <Play size={14} className="fill-black" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Roadmap to Mastery Timeline */}
                  <div className="space-y-6 text-left">
                    <h3 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                      <BookOpen size={20} className="text-amber-400" />
                      Roadmap to Mastery
                    </h3>
                    
                    {displayResources.length === 0 ? (
                      <div className="bg-[#111322]/40 border border-white/5 rounded-2xl p-8 text-center text-gray-400 text-sm">
                        No resource recommendations found for this session.
                      </div>
                    ) : (
                      <div className="relative border-l border-white/5 pl-8 ml-4 space-y-8">
                        {/* Visual gradient line overlay */}
                        <div className="absolute top-0 bottom-0 left-[-1px] w-[2px] bg-gradient-to-b from-amber-500 via-teal-500 to-transparent pointer-events-none" />

                        {displayResources.map((resource: any, idx: number) => {
                          const matchingTag = resource.category || (resource.tags && resource.tags[0]) || 'general';
                          const tagLabel = CATEGORY_MAP[matchingTag as keyof typeof CATEGORY_MAP] || matchingTag;
                          
                          return (
                            <div
                              key={idx}
                              className="relative group transition-all duration-300"
                            >
                              {/* Timeline node circle */}
                              <span className="absolute left-[-41px] top-0.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#111322] border-2 border-amber-500 text-[10px] font-bold text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] group-hover:bg-amber-500 group-hover:text-black transition-all duration-300">
                                {idx + 1}
                              </span>

                              <div className="bg-[#111322]/60 border border-white/[0.04] group-hover:border-amber-500/20 rounded-2xl p-6 transition-all duration-300 shadow-md">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                        Step {idx + 1}
                                      </span>
                                      <span className="text-[10px] font-semibold text-[#a1a1aa] bg-white/[0.03] px-2 py-0.5 rounded border border-white/5">
                                        {tagLabel}
                                      </span>
                                    </div>
                                    <h4 className="text-base font-bold text-white tracking-wide group-hover:text-amber-400 transition-colors">
                                      {resource.title}
                                    </h4>
                                    {resource.rationale && (
                                      <p className="text-sm text-[#a1a1aa] leading-relaxed">
                                        {resource.rationale}
                                      </p>
                                    )}
                                  </div>

                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-600 active:scale-95 transition-all text-xs shrink-0 shadow-md cursor-pointer"
                                  >
                                    Access Guide
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column (Metrics & Details - 1/3 width) */}
                <div className="space-y-6">
                  
                  {/* Confidence circular gauge */}
                  <div className="flex flex-col items-center bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl relative overflow-hidden w-full">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-[#a1a1aa] mb-4">
                      CONFIDENCE INDEX
                    </h4>
                    <div className="relative flex items-center justify-center w-36 h-36">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="72"
                          cy="72"
                          r="52"
                          className="text-white/[0.03]"
                          strokeWidth="8"
                          stroke="currentColor"
                          fill="transparent"
                        />
                        <circle
                          cx="72"
                          cy="72"
                          r="52"
                          className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                          strokeWidth="8"
                          strokeDasharray={2 * Math.PI * 52}
                          strokeDashoffset={2 * Math.PI * 52 - (ci / 100) * 2 * Math.PI * 52}
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-4xl font-extrabold text-white">{ci}</span>
                        <span className="text-[10px] text-[#a1a1aa] font-mono mt-0.5">/ 100</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#a1a1aa] mt-3 text-center leading-relaxed">
                      Overall score compiled from technical, voice, body, and structure metrics.
                    </p>
                  </div>

                  {/* Skills Performance Tracker */}
                  <div className="bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl w-full text-left space-y-4">
                    <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                      <TrendingUp size={16} className="text-amber-400" />
                      Skills Performance
                    </h4>
                    <div className="space-y-4">
                      {[
                        { key: 'technicalAccuracy', label: 'Technical Accuracy', val: scores.technicalAccuracy },
                        { key: 'communication', label: 'Communication & STAR', val: scores.communication },
                        { key: 'voiceCi', label: 'Voice Control & Fluency', val: scores.voiceCi },
                        { key: 'bodyCi', label: 'Visual Presence & Posture', val: scores.bodyCi },
                      ].map((item) => {
                        const val = Math.round(item.val);
                        let colorClass = 'bg-red-500';
                        let textClass = 'text-red-400';
                        let badge = 'Needs Focus';
                        if (val >= 75) {
                          colorClass = 'bg-emerald-500';
                          textClass = 'text-emerald-400';
                          badge = 'Proficient';
                        } else if (val >= 65) {
                          colorClass = 'bg-amber-500';
                          textClass = 'text-amber-400';
                          badge = 'Improving';
                        }
                        return (
                          <div key={item.key} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[#a1a1aa] font-medium">{item.label}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded bg-white/[0.02] border border-white/[0.04] ${textClass}`}>
                                  {badge}
                                </span>
                                <span className="text-white font-bold">{val}%</span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-white/[0.03] border border-white/[0.02] overflow-hidden relative">
                              <div
                                className={`h-full ${colorClass} transition-all duration-500 ease-out`}
                                style={{ width: `${val}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Highlights Summary */}
                  {report && ((report.strengths && report.strengths.length > 0) || (report.improvements && report.improvements.length > 0)) && (
                    <div className="bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl w-full text-left space-y-4">
                      <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                        <Trophy size={16} className="text-amber-400" />
                        Key Highlights
                      </h4>
                      
                      {report.strengths && report.strengths.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">Strengths</span>
                          <ul className="space-y-1.5">
                            {report.strengths.slice(0, 3).map((str: string, i: number) => (
                              <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                                <span>{str}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {report.improvements && report.improvements.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-white/[0.03]">
                          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">Areas to Grow</span>
                          <ul className="space-y-1.5">
                            {report.improvements.slice(0, 3).map((imp: string, i: number) => (
                              <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
                                <span>{imp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                </div>

              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}
