'use client';

import React, { use, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Lightbulb,
  Loader2,
  AlertCircle,
  BookOpen,
  Play,
  Sparkles,
  Trophy,
  Mic,
  Eye,
  Brain,
  Code,
  MessageSquare,
  TrendingUp,
  CheckCircle2,
  Video,
} from 'lucide-react';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';

// Tab icon helper mapping tab IDs/labels to specific Lucide icons
const getTabIcon = (id: string) => {
  const cleanId = id.toLowerCase();
  if (cleanId === 'overall' || cleanId === 'summary' || cleanId === 'overview') return <Brain size={13} />;
  if (cleanId === 'interview') return <Video size={13} />;
  if (cleanId === 'exam') return <BookOpen size={13} />;
  if (cleanId.startsWith('tech-')) return <Code size={13} />;
  if (cleanId.includes('communication')) return <MessageSquare size={13} />;
  if (cleanId.includes('posture') || cleanId.includes('visual')) return <Eye size={13} />;
  if (cleanId.includes('voice')) return <Mic size={13} />;
  if (cleanId.includes('reasoning')) return <TrendingUp size={13} />;
  return <Lightbulb size={13} />;
};

// Section parser to slice HTML by section tag into individual tabs, sub-tabs, and remove all thumbnails
function parseSections(htmlContent: string) {
  if (typeof window === 'undefined' || !htmlContent) return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Remove any and all img tags (as requested: "do not show any thumbnails")
    const imgs = doc.querySelectorAll('img');
    imgs.forEach((img) => img.remove());

    const sections = doc.querySelectorAll('section');
    if (sections.length === 0) {
      return [{
        id: 'overview',
        label: 'Overview Roadmap',
        html: doc.body.innerHTML,
        subTabs: []
      }];
    }
    
    const parsed: Array<{ id: string; label: string; html: string; subTabs: Array<{ id: string; label: string; html: string }> }> = [];
    sections.forEach((sec) => {
      const id = sec.getAttribute('id') || '';
      const label = sec.getAttribute('data-label') || id;
      
      // Parse sub-sections (articles) within this section
      const articles = sec.querySelectorAll('article');
      const subTabs: Array<{ id: string; label: string; html: string }> = [];
      
      articles.forEach((art) => {
        const subId = art.getAttribute('id') || '';
        const subLabel = art.getAttribute('data-label') || subId;
        subTabs.push({
          id: subId,
          label: subLabel,
          html: art.innerHTML
        });
      });

      parsed.push({
        id,
        label,
        html: sec.innerHTML,
        subTabs
      });
    });
    return parsed;
  } catch (e) {
    console.error('Failed to parse sections:', e);
    return [];
  }
}

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

export default function RecommendationsPage({ searchParams }: PageProps) {
  const router = useRouter();
  const params = useParams();
  const portalType = (params?.portalType as string) || 'b2c';

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [report, setReport] = useState<any>(null);
  const [weaknessTags, setWeaknessTags] = useState<string[]>([]);
  const [isLaunchingPractice, setIsLaunchingPractice] = useState(false);
  const [error, setError] = useState('');

  // General recommendation states
  const [recommendation, setRecommendation] = useState<any>(null);
  const [canReRecommend, setCanReRecommend] = useState(false);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [isReRecommending, setIsReRecommending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [tabs, setTabs] = useState<Array<{ id: string; label: string; html: string; subTabs?: Array<{ id: string; label: string; html: string }> }>>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [activeSubTabIds, setActiveSubTabIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (recommendation?.content) {
      const parsed = parseSections(recommendation.content);
      if (parsed.length > 0) {
        setTabs(parsed);
        const hasOverall = parsed.find(t => t.id === 'overall');
        const hasSummary = parsed.find(t => t.id === 'summary');
        const defaultTabId = hasOverall ? 'overall' : hasSummary ? 'summary' : parsed[0].id;
        setActiveTabId(defaultTabId);
      } else {
        setTabs([{
          id: 'overview',
          label: 'Overview Roadmap',
          html: recommendation.content,
          subTabs: []
        }]);
        setActiveTabId('overview');
      }
    } else {
      setTabs([]);
      setActiveTabId('');
    }
  }, [recommendation?.content]);

  // Set default active sub-tab when main tab changes
  useEffect(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && activeTab.subTabs && activeTab.subTabs.length > 0) {
      if (!activeSubTabIds[activeTabId]) {
        setActiveSubTabIds((prev) => ({
          ...prev,
          [activeTabId]: activeTab.subTabs![0].id,
        }));
      }
    }
  }, [activeTabId, tabs, activeSubTabIds]);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Fetch general recommendations status
  const fetchRecommendationStatus = useCallback(async (isPolling = false) => {
    try {
      const res = await fetch('/api/user/recommendations', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load recommendation status.');
      const data = await res.json();
      
      if (data.success) {
        setRecommendation(data.recommendation);
        setCanReRecommend(data.canReRecommend);
        setThreshold(data.threshold);

        // Start or continue polling if status is generating
        if (data.recommendation?.status === 'generating') {
          if (!pollIntervalRef.current) {
            pollIntervalRef.current = setInterval(() => {
              fetchRecommendationStatus(true);
            }, 5000);
          }
        } else {
          // If finished generating, stop polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
      if (!isPolling) {
        setError(err.message || 'Failed to load autonomous recommendation system.');
      }
    }
  }, []);

  // Initialize and load report data for sidebar
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError('');

        // 1. Load general recommendations
        await fetchRecommendationStatus();

        // 2. Load all sessions to populate circular gauge & sidebar performance scores
        const res = await fetch('/api/interview/sessions?flat=true', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load sessions.');
        const data = await res.json();
        const allSessions = (data.sessions || []) as SessionItem[];
        setSessions(allSessions);

        const completed = allSessions.filter((s) => s.status === 'completed');

        if (completed.length === 0) {
          setLoading(false);
          return;
        }

        // Use latest completed session for sidebar stats
        const target = completed[0];
        setSelectedSession(target);

        // 3. Fetch report data for sidebar metrics
        const reportRes = await fetch(`/api/interview/${target.sessionId}/report`, {
          cache: 'no-store',
        });
        if (reportRes.ok) {
          const reportData = await reportRes.json();
          if (reportData.status === 'ready' && reportData.report) {
            const rep = reportData.report;
            setReport(rep);
            setWeaknessTags(rep.weaknessTags || []);
          }
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Something went wrong.');
        setLoading(false);
      }
    }

    init();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchRecommendationStatus]);

  // Handle re-recommend trigger
  const handleReRecommend = async () => {
    try {
      setIsReRecommending(true);
      showToast('AI analysis started in the background. You can continue practicing.');

      const res = await fetch('/api/user/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (data.success) {
        setRecommendation({
          ...recommendation,
          status: 'generating'
        });
        setCanReRecommend(false);
        // Start polling immediately
        if (!pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(() => {
            fetchRecommendationStatus(true);
          }, 5000);
        }
      } else {
        showToast(data.message || 'Could not trigger recommendation generation.');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to request new recommendations.');
    } finally {
      setIsReRecommending(false);
    }
  };

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
        router.push(`/dashboard/${portalType}/interview/${data.sessionId}`);
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
            <Button onClick={() => router.push(`/dashboard/${portalType}/interview`)}>
              Start Mock Interview
            </Button>
          </GlassCard>
        </div>
      </div>
    );
  }

  const isGenerating = recommendation?.status === 'generating' || isReRecommending;
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8 relative">
      <AmbientGlow color="teal" size="lg" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-md">
              <Lightbulb size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Mastery Hub</h1>
              <p className="text-[#a1a1aa] text-xs mt-0.5">
                Personalized study roadmaps and targeted training mock drills.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleReRecommend}
              disabled={isGenerating || !canReRecommend}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-md cursor-pointer ${
                isGenerating
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 cursor-wait'
                  : !canReRecommend
                  ? 'bg-white/5 text-[#a1a1aa] border border-white/5 cursor-not-allowed'
                  : 'bg-amber-500 text-black hover:bg-amber-600 active:scale-95 shadow-amber-500/15'
              }`}
              title={!canReRecommend ? `Requires significant progress variation (threshold: ${threshold?.toFixed(1)}%)` : "Generate new custom recommendations"}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Re-Recommend
                </>
              )}
            </button>
          </div>
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

        {/* Main Hub Layout */}
        {!error && (
          <div className="space-y-6">
            
            {/* Highlights Summary at the top (full-width side-by-side layout) */}
            {report && ((report.strengths && report.strengths.length > 0) || (report.improvements && report.improvements.length > 0)) && (
              <div className="bg-[#111322]/60 border border-[#242747]/20 rounded-3xl p-6 shadow-xl w-full text-left grid grid-cols-1 md:grid-cols-2 gap-6">
                {report.strengths && report.strengths.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      <Trophy size={14} className="text-emerald-400" />
                      Strengths
                    </div>
                    <ul className="space-y-1.5">
                      {report.strengths.slice(0, 3).map((str: string, i: number) => (
                        <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5 leading-relaxed">
                          <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.improvements && report.improvements.length > 0 && (
                  <div className="space-y-2 md:border-l md:border-white/[0.05] md:pl-6">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                      <AlertCircle size={14} className="text-amber-400" />
                      Areas to Grow
                    </div>
                    <ul className="space-y-1.5">
                      {report.improvements.slice(0, 3).map((imp: string, i: number) => (
                        <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5 leading-relaxed">
                          <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Generating Loader Box */}
            {isGenerating && (
              <div className="flex flex-col items-center justify-center py-16 text-center glass-card border border-white/5 rounded-3xl p-8 bg-[#0a0a0b]/40">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-amber-400" />
                <h2 className="mb-2 text-lg font-bold text-white">Generating Personalized Roadmap...</h2>
                <p className="max-w-md text-xs text-[#a1a1aa] leading-relaxed">
                  Our AI Coach is analyzing your cumulative technical and behavioral performance to curate a custom study plan. You can continue other activities; this runs in the background.
                </p>
              </div>
            )}

            {/* Recommendation Tabbed Content Container */}
            {!isGenerating && tabs.length > 0 && (
              <div className="space-y-4 w-full">
                {/* Scrollable Tab bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTabId(tab.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none ${
                        activeTabId === tab.id
                          ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10 font-bold'
                          : 'bg-white/[0.03] text-gray-400 border border-white/[0.05] hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      {getTabIcon(tab.id)}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Active Tab Panel */}
                {activeTab && (
                  <GlassCard padding="md" className="bg-[#0a0a0b]/40 border-white/5 text-left w-full overflow-hidden">
                    {/* Render sub-tabs if present */}
                    {activeTab.subTabs && activeTab.subTabs.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.05] pb-2 mb-4">
                        {activeTab.subTabs.map((sub) => {
                          const activeSubTabId = activeSubTabIds[activeTabId];
                          return (
                            <button
                              key={sub.id}
                              onClick={() => {
                                setActiveSubTabIds((prev) => ({
                                  ...prev,
                                  [activeTabId]: sub.id,
                                }));
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer select-none ${
                                activeSubTabId === sub.id
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 font-bold shadow-sm'
                                  : 'bg-white/[0.02] text-gray-400 border border-transparent hover:bg-white/[0.05] hover:text-white'
                              }`}
                            >
                              {sub.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Content */}
                    <div 
                      dangerouslySetInnerHTML={{
                        __html: (activeTab.subTabs && activeTab.subTabs.length > 0)
                          ? (activeTab.subTabs.find((s) => s.id === activeSubTabIds[activeTabId])?.html || '')
                          : activeTab.html
                      }} 
                      className="space-y-4 text-gray-200 active-tab-content text-xs"
                    />
                  </GlassCard>
                )}
              </div>
            )}

            {/* Targeted Practice Launcher */}
            {!isGenerating && selectedSession && weaknessTags.length > 0 && (
              <div className="bg-gradient-to-br from-[#1b1c2b] to-[#121324] border border-amber-500/30 p-6 rounded-3xl relative overflow-hidden group shadow-[0_4px_30px_rgba(245,158,11,0.05)]">
                <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/[0.04] transition-all duration-500" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-2 text-left max-w-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                        <BookOpen size={14} />
                      </div>
                      <h3 className="text-sm font-bold text-white">
                        Targeted Micro-Practice Drill
                      </h3>
                    </div>
                    
                    <div className="text-xs text-gray-300 leading-relaxed">
                      Ready to test your improvement? Start a high-impact, 10-minute targeted mock interview focused specifically on your dynamic growth areas:
                      <span className="flex flex-wrap gap-1.5 mt-1.5">
                        {weaknessTags.map((tag) => (
                          <span key={tag} className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {tag === 'technicalAccuracy' ? 'Technical Accuracy' :
                             tag === 'communication' ? 'Communication & STAR' :
                             tag === 'voiceCi' ? 'Voice Control & Fluency' :
                             tag === 'bodyCi' ? 'Visual Presence & Posture' : tag}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={launchTargetedPractice}
                    disabled={isLaunchingPractice}
                    className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-600 active:scale-95 disabled:opacity-50 transition-all text-xs shrink-0 shadow-lg hover:shadow-amber-500/15 cursor-pointer font-bold"
                  >
                    {isLaunchingPractice ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Launching...
                      </>
                    ) : (
                      <>
                        Launch Practice Drill
                        <Play size={12} className="fill-black" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
          <div className="glass-card rounded-2xl p-4 border border-emerald-500/30 bg-[#0a0a0b]/90 text-white shadow-2xl flex items-center gap-3 max-w-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={16} />
            </div>
            <p className="text-xs font-semibold leading-normal text-left">{toastMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
