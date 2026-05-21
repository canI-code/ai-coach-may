'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { ProfileWizard } from './components/ProfileWizard';
import { 
  LayoutDashboard, BookOpen, MessageSquare, BarChart3, Settings, Loader2,
  Video, History, ScrollText, Lightbulb, User, LogOut, Target, Clock, Flame, 
  Map, ArrowUpRight, Play, BrainCircuit, ChevronRight
} from 'lucide-react';

export default function B2CDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditProfile, setShowEditProfile] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/students/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const json = await res.json();
      setData(json);
      // If we were editing, close the wizard after success
      setShowEditProfile(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-muted font-medium">Initializing your workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <GlassCard className="max-w-md text-center">
          <CardTitle className="text-red-400 mb-2">Error loading dashboard</CardTitle>
          <CardDescription className="mb-6">{error}</CardDescription>
          <Button onClick={fetchDashboardData}>Try Again</Button>
        </GlassCard>
      </div>
    );
  }
const { profile, completionStatus } = data;
const metrics = data?.metrics || {};
const recentSessions = data?.recentSessions || [];
const isLocked = completionStatus.isComplete && !profile.assessmentCompleted;

// Handle Assessment Redirection
if (isLocked) {
  return (
// ... rest of redirection code

      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        
        {showEditProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <ProfileWizard 
              pendingFields={['education', 'interests']} // Allow changing these
              onComplete={fetchDashboardData} 
            />
          </div>
        )}

        <GlassCard className="max-w-lg text-center shadow-2xl border-amber-400/20" padding="lg">
          <div className="w-20 h-20 rounded-2xl bg-amber-400/10 flex items-center justify-center text-amber-400 mx-auto mb-6">
            <Target size={40} />
          </div>
          <CardTitle className="text-3xl mb-4">Initial Assessment Required</CardTitle>
          <CardDescription className="text-lg mb-8">
            Great job completing your profile! Before you can access the full dashboard, you must take a quick initial assessment. 
            This helps us determine your current proficiency level and personalize your practice sessions.
          </CardDescription>
          <div className="space-y-4">
            <Button fullWidth size="lg" icon={<ChevronRight size={20} />} onClick={() => router.push('/dashboard/b2c/assessment')}>
              Start Assessment
            </Button>
            <div className="flex gap-3">
              <Button fullWidth variant="secondary" onClick={() => setShowEditProfile(true)}>
                Change Interests
              </Button>
              <Button fullWidth variant="ghost" onClick={handleLogout} className="text-red-400 hover:text-red-300">
                Sign Out
              </Button>
            </div>
            <p className="text-xs text-muted/50">
              One-time mandatory assessment. Estimated time: 10-15 minutes.
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <>
      {/* Main Content */}
      <main className="flex-1 min-w-0 p-8 pb-12 relative overflow-y-auto">
        <AmbientGlow />
        
        {!completionStatus.isComplete && (
          <div className="max-w-6xl mx-auto mb-8 relative z-20">
            <ProfileWizard 
              pendingFields={completionStatus.pendingFields} 
              onComplete={fetchDashboardData} 
            />
          </div>
        )}

        <div className={`transition-all duration-500 max-w-6xl mx-auto space-y-6 ${!completionStatus.isComplete ? 'blur-md pointer-events-none select-none' : 'opacity-100'}`}>
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="text-[#a1a1aa] text-sm mb-1">Good afternoon,</div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2 mb-1">
                {profile?.fullName || 'Student'} 👋
              </h1>
              <div className="text-sm text-[#a1a1aa]">
                {metrics.totalSessions !== undefined 
                  ? `You've completed ${metrics.totalSessions} sessions. Keep pushing!`
                  : 'Welcome to your AI Coach workspace!'}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="secondary" icon={<BookOpen size={16} />} onClick={() => router.push('/dashboard/b2c/practice')}>Practice Exam</Button>
              <Button icon={<Play size={16} />} className="bg-amber-500 hover:bg-amber-600 text-black">Start Interview</Button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard padding="md" className="relative overflow-hidden group bg-[#0a0a0b]/40 border-white/5">
              <div className="flex justify-between items-start mb-4">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Target size={16} />
                </div>
                <ArrowUpRight size={16} className="text-white/20 group-hover:text-amber-500/50 transition-colors" />
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-amber-500">{metrics.confidenceIndex ?? '--'}</span>
                <span className="text-sm text-[#a1a1aa]">/100</span>
              </div>
              <div className="text-sm text-white/80 font-medium">Confidence Index</div>
              <div className="text-xs text-[#a1a1aa] mt-1">{metrics.confidenceTrend ? `${metrics.confidenceTrend > 0 ? '+' : ''}${metrics.confidenceTrend} this week` : 'No data yet'}</div>
            </GlassCard>

            <GlassCard padding="md" className="relative overflow-hidden group bg-[#0a0a0b]/40 border-white/5">
              <div className="flex justify-between items-start mb-4">
                <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400">
                  <Video size={16} />
                </div>
                <ArrowUpRight size={16} className="text-white/20 group-hover:text-teal-400/50 transition-colors" />
              </div>
              <div className="text-3xl font-bold text-teal-400 mb-1">{metrics.totalSessions ?? '--'}</div>
              <div className="text-sm text-white/80 font-medium">Sessions Completed</div>
              <div className="text-xs text-[#a1a1aa] mt-1">{metrics.sessionsThisWeek ? `${metrics.sessionsThisWeek} this week` : 'No data yet'}</div>
            </GlassCard>

            <GlassCard padding="md" className="relative overflow-hidden group bg-[#0a0a0b]/40 border-white/5">
              <div className="flex justify-between items-start mb-4">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Clock size={16} />
                </div>
                <ArrowUpRight size={16} className="text-white/20 group-hover:text-amber-500/50 transition-colors" />
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-amber-500">{metrics.avgDuration ?? '--'}</span>
                <span className="text-sm text-[#a1a1aa]">min</span>
              </div>
              <div className="text-sm text-white/80 font-medium">Avg. Duration</div>
              <div className="text-xs text-[#a1a1aa] mt-1">Per session</div>
            </GlassCard>

            <GlassCard padding="md" className="relative overflow-hidden group bg-[#0a0a0b]/40 border-white/5">
              <div className="flex justify-between items-start mb-4">
                <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400">
                  <Flame size={16} />
                </div>
                <ArrowUpRight size={16} className="text-white/20 group-hover:text-teal-400/50 transition-colors" />
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-teal-400">{metrics.streak ?? '--'}</span>
                <span className="text-sm text-[#a1a1aa]">days</span>
              </div>
              <div className="text-sm text-white/80 font-medium">Streak</div>
              <div className="text-xs text-[#a1a1aa] mt-1">Keep it up!</div>
            </GlassCard>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard padding="lg" className="lg:col-span-2 bg-[#0a0a0b]/40 border-white/5">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <CardTitle className="text-lg mb-1">Confidence Index Trend</CardTitle>
                  <CardDescription>Last 7 days</CardDescription>
                </div>
                {metrics.confidenceTrend && (
                  <div className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 text-xs font-semibold flex items-center gap-1">
                    <ArrowUpRight size={12} /> {metrics.confidenceTrend > 0 ? '+' : ''}{metrics.confidenceTrend} pts
                  </div>
                )}
              </div>
              <div className="h-56 w-full flex items-center justify-center border-b border-l border-white/10 relative">
                <span className="text-[#a1a1aa] text-sm">Chart data pending...</span>
              </div>
            </GlassCard>

            <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5">
              <CardTitle className="text-lg mb-1">Skill Breakdown</CardTitle>
              <CardDescription className="mb-6">Performance radar</CardDescription>
              <div className="h-56 w-full flex items-center justify-center relative mt-4">
                <div className="w-48 h-48 rounded-full border border-white/5 absolute"></div>
                <div className="w-32 h-32 rounded-full border border-white/5 absolute"></div>
                <Target size={30} className="text-teal-400 absolute opacity-20" />
                <span className="text-[#a1a1aa] text-sm z-10">Skill data pending...</span>
              </div>
            </GlassCard>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard padding="lg" className="lg:col-span-2 bg-[#0a0a0b]/40 border-white/5">
              <div className="flex justify-between items-center mb-6">
                <CardTitle className="text-lg">Recent Sessions</CardTitle>
                <button className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors">
                  View all <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="space-y-3">
                {recentSessions.length > 0 ? (
                  recentSessions.map((session: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                          <MessageSquare size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white mb-0.5">{session.title}</div>
                          <div className="text-xs text-[#a1a1aa]">{session.date} &bull; {session.duration}</div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <div className="text-sm font-bold text-amber-500">{session.score}%</div>
                          <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider">Score</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-sm text-[#a1a1aa] py-8">
                    No recent sessions available.
                  </div>
                )}
              </div>
            </GlassCard>

            <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5 relative overflow-hidden">
              <CardTitle className="text-sm text-[#a1a1aa] font-medium tracking-wider mb-6 text-center uppercase">CONFIDENCE INDEX</CardTitle>
              <div className="flex items-center justify-center h-40">
                <div className="relative w-40 h-40">
                  {/* Gauge Background */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="transparent" 
                            strokeDasharray="440" 
                            strokeDashoffset={metrics.confidenceIndex ? 440 - (440 * metrics.confidenceIndex) / 100 : 440} 
                            className="text-amber-500 transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tighter">{metrics.confidenceIndex ?? '--'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold">
                  <ArrowUpRight size={12} /> {metrics.confidenceTrend ? `${metrics.confidenceTrend > 0 ? '+' : ''}${metrics.confidenceTrend} this week` : 'No trend data'}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </main>
    </>
  );
}
