'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { ProfileWizard } from './components/ProfileWizard';
import DashboardClient from './components/DashboardClient';
import { 
  BookOpen, Loader2, Target, Flame, 
  Play, BrainCircuit, ChevronRight
} from 'lucide-react';

function CampaignCountdown({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const difference = +new Date(targetDate) - +new Date();
      if (difference <= 0) {
        setTimeLeft('Started');
        return;
      }
      
      const parts = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };

      const timeStr = `${parts.days > 0 ? `${parts.days}d ` : ''}${parts.hours.toString().padStart(2, '0')}h ${parts.minutes.toString().padStart(2, '0')}m ${parts.seconds.toString().padStart(2, '0')}s`;
      setTimeLeft(timeStr);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return <span>{timeLeft}</span>;
}

export default function B2CDashboard() {
  const router = useRouter();
  const params = useParams();
  const portalType = (params?.portalType as string) || 'b2c';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showRecoveredToast, setShowRecoveredToast] = useState(false);
  const [branding, setBranding] = useState<any>(null);

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [launchingCampaignId, setLaunchingCampaignId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    if (portalType !== 'b2b') return;
    try {
      setLoadingCampaigns(true);
      const res = await fetch('/api/students/campaigns');
      if (res.ok) {
        setCampaigns(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch student campaigns:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleLaunchCampaign = async (campaign: any) => {
    setLaunchingCampaignId(campaign._id);
    try {
      if (campaign.type === 'interview') {
        const payload = {
          role: campaign.config?.role || 'Software Engineer',
          difficulty: campaign.config?.difficulty || 2,
          durationMinutes: campaign.durationMinutes || 30,
          aiPersona: 'Professional',
          difficultyMin: 1,
          difficultyMax: 3,
          campaignId: campaign._id
        };

        const res = await fetch('/api/interview/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const responseData = await res.json();
          alert(responseData.message || responseData.error || 'Failed to start interview');
          return;
        }

        const responseData = await res.json();
        router.push(`/dashboard/${portalType}/interview/${responseData.sessionId}`);
      } else if (campaign.type === 'exam') {
        const interests = campaign.config?.tags && campaign.config.tags.length > 0
          ? campaign.config.tags
          : (data?.profile?.interests || ['General']);

        const payload = {
          interests,
          questionCount: 20,
          campaignId: campaign._id
        };

        const res = await fetch('/api/students/exam/session/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const responseData = await res.json();
          alert(responseData.message || responseData.error || 'Failed to start practice exam');
          return;
        }

        const responseData = await res.json();
        router.push(`/dashboard/${portalType}/practice/${responseData.sessionId}`);
      }
    } catch (err) {
      console.error('Failed to launch campaign:', err);
      alert('An error occurred while launching the campaign.');
    } finally {
      setLaunchingCampaignId(null);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/students/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const json = await res.json();
      setData(json);
      setShowEditProfile(false);
      
      // Also fetch campaigns if B2B
      if (portalType === 'b2b') {
        try {
          const campRes = await fetch('/api/students/campaigns');
          if (campRes.ok) {
            setCampaigns(await campRes.json());
          }
        } catch (err) {
          console.error('Failed to fetch student campaigns:', err);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('recovered') === 'true') {
        setShowRecoveredToast(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (portalType === 'b2b') {
      const fetchBranding = async () => {
        try {
          const res = await fetch('/api/b2b/branding');
          if (res.ok) {
            setBranding(await res.json());
          }
        } catch (err) {
          console.error('Failed to fetch dashboard branding:', err);
        }
      };
      fetchBranding();
    }
  }, [portalType]);

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
const { profile, completionStatus, placementReadiness } = data;
const isLocked = completionStatus.isComplete && !profile.assessmentCompleted;

// Handle Assessment Redirection
if (isLocked) {
  return (
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
            <Button fullWidth size="lg" icon={<ChevronRight size={20} />} onClick={() => router.push(`/dashboard/${portalType}/assessment`)}>
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
      {showRecoveredToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-5 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-[0_4px_25px_rgba(16,185,129,0.2)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>Welcome back! Your account deletion request has been cancelled, and your account is fully restored.</span>
          <button onClick={() => setShowRecoveredToast(false)} className="ml-2 text-emerald-400/50 hover:text-emerald-400 text-sm font-bold">×</button>
        </div>
      )}
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
          {/* Custom Welcome Banner */}
          {branding?.welcomeBannerText && (
            <div 
              className="p-6 rounded-2xl border mb-6 relative overflow-hidden backdrop-blur-md"
              style={{
                backgroundColor: branding.primaryColor ? `${branding.primaryColor}10` : 'rgba(245, 158, 11, 0.05)',
                borderColor: branding.primaryColor ? `${branding.primaryColor}20` : 'rgba(245, 158, 11, 0.1)',
              }}
            >
              <div className="relative z-10">
                <h2 className="text-xl font-bold text-white mb-1">
                  {branding.welcomeBannerText}
                </h2>
                <p className="text-sm text-[#a1a1aa]">
                  We are excited to support you on your learning and preparation journey.
                </p>
              </div>
              <div 
                className="absolute -right-12 -bottom-12 w-36 h-36 rounded-full opacity-20 blur-3xl pointer-events-none"
                style={{ backgroundColor: branding.primaryColor || '#f59e0b' }}
              />
            </div>
          )}

          {/* Active Campaigns Banner */}
          {campaigns.filter(c => !c.completed).map((campaign) => (
            <div key={campaign._id} className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-start gap-4 z-10">
                <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-white font-bold flex items-center gap-2">
                    Action Required: Scheduled Campaign
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] uppercase tracking-wider font-bold">
                      {campaign.type === 'interview' ? 'Interview' : 'Exam'}
                    </span>
                  </h3>
                  <p className="text-sm text-amber-400/80 mt-1">
                    <span className="font-semibold text-amber-400">{campaign.title}</span> ends in <CampaignCountdown targetDate={campaign.endTime} />
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => handleLaunchCampaign(campaign)}
                disabled={launchingCampaignId === campaign._id}
                className="shrink-0 bg-amber-500 hover:bg-amber-600 text-black border-0 z-10 cursor-pointer"
              >
                {launchingCampaignId === campaign._id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {launchingCampaignId === campaign._id ? 'Starting...' : 'Start Assessment'}
              </Button>
            </div>
          ))}

          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="text-[#a1a1aa] text-sm mb-1">Good afternoon,</div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2 mb-1">
                {profile?.fullName || 'Student'} 👋
              </h1>
              <div className="text-sm text-[#a1a1aa]">
                Welcome back to your AI Coach workspace. Here&apos;s your interview performance.
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="secondary" icon={<BookOpen size={16} />} onClick={() => router.push(`/dashboard/${portalType}/practice`)}>Practice Exam</Button>
              <Button 
                icon={<Play size={16} />} 
                className="bg-amber-500 hover:bg-amber-600 text-black border-0" 
                style={branding?.primaryColor ? { backgroundColor: branding.primaryColor } : {}}
                onClick={() => router.push(`/dashboard/${portalType}/interview`)}
              >
                Start Interview
              </Button>
            </div>
          </div>

          {/* Placement Readiness AI Predictor Glowing Card */}
          {data?.user?.role === 'mentee' && placementReadiness && (
            <GlassCard className="relative overflow-hidden p-6 border-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.15)] bg-gradient-to-r from-amber-500/5 to-transparent">
              <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-amber-400" />
                    Career Placement Predictor
                  </h2>
                  <p className="text-xs text-[#a1a1aa] mt-1">
                    AI-driven evaluation of your technical readiness, communication clarity, and mock interview performance.
                  </p>
                </div>
                
                {/* Tier Badge */}
                <div className="shrink-0 flex items-center gap-3">
                  <span className="text-xs text-[#a1a1aa]">Current Status:</span>
                  {(() => {
                    let tierStyle = "bg-zinc-500/10 border-zinc-500/30 text-zinc-400";
                    if (placementReadiness.tier === 'Tier 1') {
                      tierStyle = "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
                    } else if (placementReadiness.tier === 'Tier 2') {
                      tierStyle = "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.1)]";
                    } else if (placementReadiness.tier === 'Tier 3') {
                      tierStyle = "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]";
                    }
                    return (
                      <span className={`px-4 py-2 rounded-xl border text-sm font-bold uppercase tracking-wider ${tierStyle}`}>
                        {placementReadiness.tier}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Details/Explanation Text */}
              <p className="text-sm text-white bg-white/5 border border-white/5 p-4 rounded-xl mb-6 leading-relaxed">
                {placementReadiness.details}
              </p>

              {/* Breakdown Scores */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#a1a1aa]">Technical Score</span>
                    <span className="text-sm font-mono font-bold text-white">{placementReadiness.breakdown?.technical}/100</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 rounded-full transition-all" 
                      style={{ width: `${placementReadiness.breakdown?.technical}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#a1a1aa]">Communication Score</span>
                    <span className="text-sm font-mono font-bold text-white">{placementReadiness.breakdown?.communication}/100</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all" 
                      style={{ width: `${placementReadiness.breakdown?.communication}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#a1a1aa]">Mock Interview Score</span>
                    <span className="text-sm font-mono font-bold text-white">{placementReadiness.breakdown?.interview}/100</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all" 
                      style={{ width: `${placementReadiness.breakdown?.interview}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Target Preparation Actions */}
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#a1a1aa] mb-3">Target Preparation Actions</h3>
                <div className="flex flex-wrap gap-2.5">
                  {placementReadiness.tier === 'Insufficient Data' && (
                    <>
                      <Button size="sm" onClick={() => router.push(`/dashboard/${portalType}/practice`)}>
                        Take a Practice Exam
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/${portalType}/interview`)}>
                        Start a Mock Interview
                      </Button>
                    </>
                  )}
                  {placementReadiness.tier === 'Tier 1' && (
                    <div className="text-xs text-emerald-400/90 flex items-center gap-1.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Awesome! You are ready to start applying. Keep practicing high-level system design and advanced coding concepts.
                    </div>
                  )}
                  {placementReadiness.tier === 'Tier 2' && (
                    <>
                      <span className="text-xs text-[#a1a1aa] self-center mr-1">To reach Tier 1:</span>
                      {placementReadiness.breakdown?.technical < 75 && (
                        <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/${portalType}/practice`)}>
                          Improve Technical Score (target 75+)
                        </Button>
                      )}
                      {placementReadiness.breakdown?.interview < 70 && (
                        <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/${portalType}/interview`)}>
                          Practice Mock Interviews (target 70+)
                        </Button>
                      )}
                    </>
                  )}
                  {placementReadiness.tier === 'Tier 3' && (
                    <>
                      <span className="text-xs text-[#a1a1aa] self-center mr-1">To reach Tier 2:</span>
                      <Button size="sm" onClick={() => router.push(`/dashboard/${portalType}/interview`)}>
                        Practice 1:1 Behaviorals
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/${portalType}/practice`)}>
                        Build Core CS Concepts
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </GlassCard>
          )}

          {/* Interview performance dashboard (real metrics from coaching_reports) */}
          <DashboardClient />
        </div>
      </main>
    </>
  );
}
