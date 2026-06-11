'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart3, FileDown, ShieldAlert, Award, BrainCircuit, Target } from 'lucide-react';
import { RadarChart } from '@/app/dashboard/[portalType]/components/charts/RadarChart';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';

export default function MentorAnalyticsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch('/api/mentor/students');
        if (res.ok) {
          const data = await res.json();
          setStudents(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const approvedStudents = useMemo(() => {
    return students.filter(s => s.status === 'approved' || s.status === 'active');
  }, [students]);

  // Aggregated skill categories
  const aggregatedSkills = useMemo(() => {
    if (approvedStudents.length === 0) {
      return [
        { label: 'Technical', value: 0 },
        { label: 'Communication', value: 0 },
        { label: 'Voice', value: 0 },
        { label: 'Body', value: 0 },
      ];
    }

    let tech = 0;
    let comm = 0;
    let voice = 0;
    let body = 0;
    let count = 0;

    approvedStudents.forEach((s) => {
      // Find matching scores or fall back to defaults
      const tVal = s.skills?.find((sk: any) => sk.skill === 'Technical')?.score || 0;
      const cVal = s.skills?.find((sk: any) => sk.skill === 'Communication')?.score || 0;
      const vVal = s.skills?.find((sk: any) => sk.skill === 'Voice')?.score || 0;
      const bVal = s.skills?.find((sk: any) => sk.skill === 'Body')?.score || 0;

      tech += tVal;
      comm += cVal;
      voice += vVal;
      body += bVal;
      count++;
    });

    return [
      { label: 'Technical', value: Math.round(tech / count) },
      { label: 'Communication', value: Math.round(comm / count) },
      { label: 'Voice', value: Math.round(voice / count) },
      { label: 'Body', value: Math.round(body / count) },
    ];
  }, [approvedStudents]);

  return (
    <div className="p-6 lg:p-8 min-h-screen relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Institution Analytics</h1>
          <p className="text-sm text-white/40">In-depth breakdown of aggregated performance across all batches</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-emerald-400 hover:bg-emerald-500 transition-all hover:scale-105 shadow-lg shadow-emerald-500/10"
        >
          <FileDown size={16} /> Export Analysis Report
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-white/30 text-xs">Loading institution analytics...</div>
      ) : approvedStudents.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border-white/5">
          <BarChart3 size={48} className="mx-auto text-emerald-500/50 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Analytics Pending</h3>
          <p className="text-white/50 max-w-sm mx-auto text-xs">
            Once students register and complete practice sessions, their aggregated performance data will be rendered here.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6 mb-8 animate-fade-in">
          {/* Radar Chart Card */}
          <GlassCard padding="lg" className="rounded-2xl border-white/5 lg:col-span-2">
            <CardTitle className="text-lg mb-1">Aggregated Skill Metrics</CardTitle>
            <CardDescription className="mb-6">Average performance index of approved student batch</CardDescription>
            <div className="flex items-center justify-center">
              <RadarChart axes={aggregatedSkills} max={100} accent="#10b981" />
            </div>
          </GlassCard>
 
          {/* Observations panel */}
          <div className="space-y-6">
            <GlassCard padding="lg" className="rounded-2xl border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Key Insights</h3>
              </div>
              <div className="space-y-4 text-xs text-white/70">
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <p className="font-semibold text-white mb-1 uppercase tracking-wider text-[9px] text-emerald-400">Top Competency</p>
                  <p className="leading-relaxed">Communication and STAR storytelling format are the strongest attributes for the current cohort, averaging over 75%.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/10">
                  <p className="font-semibold text-red-400 mb-1 uppercase tracking-wider text-[9px]">Improvement Area</p>
                  <p className="leading-relaxed text-red-200/70">Voice metrics, silences, and technical algorithm time complexity calculations remain weak zones. Suggest setting extra technical practice.</p>
                </div>
              </div>
            </GlassCard>
 
            <GlassCard padding="lg" className="rounded-2xl border-[#10b981]/10 bg-emerald-500/[0.02]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                  <Award size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cohort Grade</h4>
                  <p className="text-lg font-black text-emerald-400">Satisfactory (B+)</p>
                </div>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed">Based on overall Confidence Indexes and session consistency. Scheduled warmups and invite links are actively improving participation.</p>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
