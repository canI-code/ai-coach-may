'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { 
  Target, Video, Clock, Flame, Loader2, ArrowUpRight, 
  MessageSquare, Play, Calendar, CheckCircle2, ChevronRight,
  ClipboardList, Send, X
} from 'lucide-react';
import { LineChart } from '@/app/dashboard/[portalType]/components/charts/LineChart';
import { RadarChart } from '@/app/dashboard/[portalType]/components/charts/RadarChart';

export default function B2BStudentDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [mentor, setMentor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      const [profRes, metRes, assRes, menRes] = await Promise.all([
        fetch('/api/students/dashboard'),
        fetch('/api/interview/dashboard'),
        fetch('/api/students/practice/assigned'),
        fetch('/api/students/mentor')
      ]);

      if (profRes.ok) {
        const profData = await profRes.json();
        setProfile(profData.profile);
      }
      if (metRes.ok) {
        const metData = await metRes.json();
        if (metData.success) {
          setMetrics(metData.metrics);
        }
      }
      if (assRes.ok) {
        const assData = await assRes.json();
        setAssignments(assData);
      }
      if (menRes.ok) {
        const menData = await menRes.json();
        setMentor(menData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ── Chat messages ───────────────────────────────────────────────────────
  const fetchChatHistory = async () => {
    if (!mentor) return;
    try {
      const res = await fetch(`/api/chat/messages?userId=${mentor._id}`);
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (chatOpen && mentor) {
      fetchChatHistory();
      const interval = setInterval(fetchChatHistory, 5000);
      return () => clearInterval(interval);
    }
  }, [chatOpen, mentor]);

  const sendChatMessage = async () => {
    if (!chatMsg.trim() || !mentor) return;
    const textToSend = chatMsg.trim();
    setChatMsg('');
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: mentor._id, text: textToSend }),
      });
      if (res.ok) {
        fetchChatHistory();
      }
    } catch (err) {
      console.error(err);
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

  // Fallbacks if no data exists
  const hasHistoryData = metrics?.hasData || false;
  const trendPoints = metrics?.ciTrend?.map((point: any) => ({
    label: point.label,
    value: point.ciScore,
  })) || [];

  const radarAxes = metrics?.categoryAverages
    ? [
        { label: 'Technical', value: metrics.categoryAverages.technicalAccuracy },
        { label: 'Communication', value: metrics.categoryAverages.communication },
        { label: 'Voice', value: metrics.categoryAverages.voiceCi },
        { label: 'Body', value: metrics.categoryAverages.bodyCi },
      ]
    : [
        { label: 'Technical', value: 0 },
        { label: 'Communication', value: 0 },
        { label: 'Voice', value: 0 },
        { label: 'Body', value: 0 },
      ];

  return (
    <main className="flex-1 min-w-0 p-8 pb-12 relative overflow-y-auto z-10">
      <AmbientGlow />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[#a1a1aa] text-sm mb-1">Good afternoon, B2B Mentee</div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2 mb-1">
              {profile?.fullName || 'Student'} 👋
            </h1>
            <div className="text-sm text-[#a1a1aa]">
              Welcome to your sponsored workspace. Here is your aggregated prep profile.
            </div>
          </div>
          <div className="flex items-center gap-3">
            {mentor && (
              <button
                onClick={() => setChatOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-emerald-400 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/10"
              >
                <MessageSquare size={16} /> Contact Mentor
              </button>
            )}
            <Button icon={<Play size={16} />} className="bg-amber-500 hover:bg-amber-600 text-black animate-pulse" onClick={() => router.push('/dashboard/b2b/interview')}>Start Practice</Button>
          </div>
        </div>

        {/* Stats KPI Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
              <Target className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl font-black text-white">{metrics?.averageCi != null ? `${metrics.averageCi}%` : '--'}</p>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-wider font-semibold">Confidence Index</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center mb-3">
              <Video className="w-5 h-5 text-teal-400" />
            </div>
            <p className="text-3xl font-black text-white">{metrics?.totalSessions || 0}</p>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-wider font-semibold">Sessions Completed</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl font-black text-white">{metrics?.avgDurationMinutes || '--'} min</p>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-wider font-semibold">Avg Duration</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
              <Flame className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-white">{metrics?.streakDays || 0} days</p>
            <div className="flex justify-between items-baseline mt-1">
              <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Streak</p>
              {metrics?.longestStreak !== undefined && (
                <p className="text-[10px] text-emerald-400 font-semibold">Max: {metrics.longestStreak} days</p>
              )}
            </div>
          </div>
        </div>

        {/* Charts & Assigned feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend chart */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <CardTitle className="text-lg text-white mb-1">Confidence Index Trend</CardTitle>
                  <CardDescription>Across your recent interviews</CardDescription>
                </div>
              </div>
              {trendPoints.length > 0 ? (
                <LineChart points={trendPoints} accent="#f59e0b" max={100} />
              ) : (
                <div className="h-56 w-full flex items-center justify-center">
                  <span className="text-white/20 text-xs">No trend data yet. Start interviews to track progress.</span>
                </div>
              )}
            </GlassCard>

            <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5">
              <CardTitle className="text-lg text-white mb-1">Performance Radar</CardTitle>
              <CardDescription className="mb-6">Multimodal skill metrics breakdown</CardDescription>
              <div className="flex items-center justify-center">
                <RadarChart axes={radarAxes} max={100} accent="#14b8a6" />
              </div>
            </GlassCard>
          </div>

          {/* Assigned Practice Side panel */}
          <div className="space-y-6">
            <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-[#10b981]/20 border">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-emerald-400 animate-pulse" />
                <CardTitle className="text-base text-white">Assigned by Mentor</CardTitle>
              </div>

              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {assignments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-white/20">No practice tasks assigned currently.</div>
                ) : (
                  assignments.map((task) => (
                    <div key={task._id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 hover:bg-white/[0.04] transition-all">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-white capitalize">{task.type} Practice</span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${task.status === 'completed' ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10'}`}>{task.status}</span>
                      </div>
                      <p className="text-xs text-white/40 mb-1">Domain: {task.domain}</p>
                      
                      {task.dueDate && (
                        <div className="flex items-center gap-1 text-[10px] text-white/30">
                          <Calendar size={10} />
                          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}

                      {task.status !== 'completed' && (
                        <button
                          onClick={() => {
                            if (task.type === 'exam') {
                              router.push('/dashboard/b2b/practice');
                            } else {
                              router.push('/dashboard/b2b/interview');
                            }
                          }}
                          className="mt-1 py-1.5 w-full rounded-lg text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-500 transition-all flex items-center justify-center gap-1"
                        >
                          Launch Practice <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Floating Chat Panel widget */}
      {chatOpen && mentor && (
        <div className="fixed bottom-6 right-6 w-96 rounded-3xl overflow-hidden shadow-2xl z-[100] flex flex-col border border-emerald-500/20 backdrop-blur-xl bg-[#0a0c1c]/95" style={{ height: 480 }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0 bg-emerald-500/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-xs font-black text-black">
                {mentor.fullName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">{mentor.fullName}</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">Your Mentor</p>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-white/30 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"><X size={16} /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {chatHistory.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare size={32} className="mx-auto text-white/10 mb-3 animate-bounce" />
                <p className="text-xs text-white/20">Ask your mentor a question or request advice</p>
              </div>
            ) : (
              chatHistory.map((msg, i) => {
                const isMe = msg.senderId === mentor._id ? false : true;
                return (
                  <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? "text-black font-medium rounded-br-sm" : "text-white/70 rounded-bl-sm"}`}
                      style={isMe ? { background: "linear-gradient(135deg, #10b981, #059669)" } : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="flex items-center gap-3 px-4 py-3 border-t border-white/5 flex-shrink-0">
            <input type="text" value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-emerald-500/40 transition-all" />
            <button onClick={sendChatMessage} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 bg-emerald-500 hover:bg-emerald-600">
              <Send size={15} className="text-black" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
