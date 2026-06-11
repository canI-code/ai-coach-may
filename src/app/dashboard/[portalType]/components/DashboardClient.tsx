'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Target,
  Video,
  Clock,
  Flame,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import type {
  DashboardMetrics,
} from '@/lib/interview/dashboard-metrics';
import { StatCard } from './charts/StatCard';
import { LineChart } from './charts/LineChart';
import { RadarChart } from './charts/RadarChart';

type FetchState = 'loading' | 'error' | 'ready';

interface DashboardResponse {
  success: boolean;
  metrics: DashboardMetrics;
}

export default function DashboardClient() {
  const router = useRouter();
  const params = useParams();
  const portalType = (params?.portalType as string) || 'b2c';
  const [status, setStatus] = useState<FetchState>('loading');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState('');

  const loadMetrics = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/interview/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load dashboard metrics.');
      const json: DashboardResponse = await res.json();
      if (!json.success || !json.metrics) {
        throw new Error('Dashboard returned an unexpected response.');
      }
      setMetrics(json.metrics);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // ── Loading ─────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-muted font-medium">Loading your performance…</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <GlassCard className="max-w-md text-center" padding="lg">
          <CardTitle className="text-red-400 mb-2">Unable to load dashboard</CardTitle>
          <CardDescription className="mb-6">{error}</CardDescription>
          <Button onClick={loadMetrics}>Try Again</Button>
        </GlassCard>
      </div>
    );
  }

  // ── Empty (no interview history yet) ──────────────────────────────────────
  if (!metrics || metrics.hasData === false) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <GlassCard className="max-w-lg text-center border-amber-400/20" padding="lg">
          <div className="w-20 h-20 rounded-2xl bg-amber-400/10 flex items-center justify-center text-amber-400 mx-auto mb-6">
            <Video size={40} />
          </div>
          <CardTitle className="text-3xl mb-4">No interviews yet</CardTitle>
          <CardDescription className="text-lg mb-8">
            Run your first mock interview to unlock your Confidence Index, skill breakdown,
            and personalized focus areas. Your performance dashboard fills in as you practice.
          </CardDescription>
          <Button
            size="lg"
            icon={<ArrowUpRight size={20} />}
            onClick={() => router.push(`/dashboard/${portalType}/interview`)}
          >
            Start your first interview
          </Button>
        </GlassCard>
      </div>
    );
  }

  // ── Populated ─────────────────────────────────────────────────────────────
  const trendPoints = metrics.ciTrend.map((point) => ({
    label: point.label,
    value: point.ciScore,
  }));

  const radarAxes = metrics.categoryAverages
    ? [
        { label: 'Technical', value: metrics.categoryAverages.technicalAccuracy },
        { label: 'Communication', value: metrics.categoryAverages.communication },
        { label: 'Voice', value: metrics.categoryAverages.voiceCi },
        { label: 'Body', value: metrics.categoryAverages.bodyCi },
      ]
    : null;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Target size={16} />}
          label="Confidence Index"
          value={metrics.averageCi != null ? Number(metrics.averageCi.toFixed(3)).toString() : '--'}
          trend={metrics.confidenceTrend}
          accent="amber"
        />
        <StatCard
          icon={<Video size={16} />}
          label="Sessions Completed"
          value={String(metrics.totalSessions)}
          sub={`${metrics.sessionsThisWeek} this week`}
          accent="teal"
        />
        <StatCard
          icon={<Clock size={16} />}
          label="Avg Duration"
          value={`${metrics.avgDurationMinutes ?? '--'} min`}
          accent="amber"
        />
        <StatCard
          icon={<Flame size={16} />}
          label="Streak"
          value={`${metrics.streakDays} days`}
          sub={`Longest: ${metrics.longestStreak ?? 0} days`}
          accent="emerald"
        />
      </div>

      {/* Charts Row: 2/3 trend + 1/3 radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard padding="lg" className="lg:col-span-2 bg-[#0a0a0b]/40 border-white/5">
          <div className="flex justify-between items-start mb-6">
            <div>
              <CardTitle className="text-lg mb-1">Confidence Index Trend</CardTitle>
              <CardDescription>Across your recent interviews</CardDescription>
            </div>
            {metrics.confidenceTrend != null && metrics.confidenceTrend !== 0 && (
              <div className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 text-xs font-semibold flex items-center gap-1">
                <ArrowUpRight size={12} />
                {`${metrics.confidenceTrend > 0 ? '+' : ''}${metrics.confidenceTrend} pts`}
              </div>
            )}
          </div>
          {trendPoints.length > 0 ? (
            <LineChart points={trendPoints} accent="#f59e0b" max={100} />
          ) : (
            <div className="h-56 w-full flex items-center justify-center">
              <span className="text-[#a1a1aa] text-sm">Not enough data for a trend yet.</span>
            </div>
          )}
        </GlassCard>

        <GlassCard padding="lg" className="bg-[#0a0a0b]/40 border-white/5">
          <CardTitle className="text-lg mb-1">Skill Breakdown</CardTitle>
          <CardDescription className="mb-6">Performance radar</CardDescription>
          {radarAxes ? (
            <div className="flex items-center justify-center">
              <RadarChart axes={radarAxes} max={100} accent="#14b8a6" />
            </div>
          ) : (
            <div className="h-56 w-full flex items-center justify-center relative mt-4">
              <div className="w-48 h-48 rounded-full border border-white/5 absolute" />
              <div className="w-32 h-32 rounded-full border border-white/5 absolute" />
              <Target size={30} className="text-teal-400 absolute opacity-20" />
              <span className="text-[#a1a1aa] text-sm z-10">Skill data pending…</span>
            </div>
          )}
        </GlassCard>
      </div>


    </div>
  );
}
