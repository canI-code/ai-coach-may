'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { ProfileWizard } from './components/ProfileWizard';
import DashboardClient from './components/DashboardClient';
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
  const [showRecoveredToast, setShowRecoveredToast] = useState(false);

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
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('recovered') === 'true') {
        setShowRecoveredToast(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
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
              <Button variant="secondary" icon={<BookOpen size={16} />} onClick={() => router.push('/dashboard/b2c/practice')}>Practice Exam</Button>
              <Button icon={<Play size={16} />} className="bg-amber-500 hover:bg-amber-600 text-black" onClick={() => router.push('/dashboard/b2c/interview')}>Start Interview</Button>
            </div>
          </div>

          {/* Interview performance dashboard (real metrics from coaching_reports) */}
          <DashboardClient />
        </div>
      </main>
    </>
  );
}
