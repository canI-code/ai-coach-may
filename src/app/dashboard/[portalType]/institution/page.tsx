'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui';
import { Users, UserPlus, CreditCard, TrendingUp, Clock, Loader2 } from 'lucide-react';

export default function InstitutionOverview() {
  const [data, setData] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, brandingRes] = await Promise.all([
          fetch('/api/b2b/institution/overview'),
          fetch('/api/b2b/branding')
        ]);
        if (overviewRes.ok) setData(await overviewRes.json());
        if (brandingRes.ok) setBranding(await brandingRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Institution Overview</h1>
        <p className="text-sm text-[#a1a1aa] mt-1">Monitor your institution's activity and resources</p>
      </div>

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
              This is a live preview of how the banner appears to your students and mentors.
            </p>
          </div>
          <div 
            className="absolute -right-12 -bottom-12 w-36 h-36 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ backgroundColor: branding.primaryColor || '#f59e0b' }}
          />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[#a1a1aa] font-semibold">Mentors</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalMentors || 0}</div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[#a1a1aa] font-semibold">Mentees</span>
            <UserPlus className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalMentees || 0}</div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[#a1a1aa] font-semibold">Credits Used</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-white">
            {stats.creditsUsed || 0}
            <span className="text-sm font-normal text-[#a1a1aa]"> / {stats.creditsTotal || 0}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
              style={{ width: `${stats.creditsTotal ? (stats.creditsUsed / stats.creditsTotal * 100) : 0}%` }}
            />
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[#a1a1aa] font-semibold">Expires</span>
            <Clock className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-lg font-bold text-white">
            {stats.expiresAt ? new Date(stats.expiresAt).toLocaleDateString() : 'N/A'}
          </div>
        </GlassCard>
      </div>

      {/* Placement Readiness ROI */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Placement Readiness ROI
            </CardTitle>
            <CardDescription className="text-xs">
              AI-predicted student preparation breakdown across mock interviews and technical assessments
            </CardDescription>
          </div>
        </div>

        {(() => {
          const pr = stats.placementReadiness || { tier1Count: 0, tier2Count: 0, tier3Count: 0, insufficientCount: 0 };
          const totalPr = pr.tier1Count + pr.tier2Count + pr.tier3Count + pr.insufficientCount;
          const t1Percent = totalPr > 0 ? (pr.tier1Count / totalPr) * 100 : 0;
          const t2Percent = totalPr > 0 ? (pr.tier2Count / totalPr) * 100 : 0;
          const t3Percent = totalPr > 0 ? (pr.tier3Count / totalPr) * 100 : 0;
          const insufficientPercent = totalPr > 0 ? (pr.insufficientCount / totalPr) * 100 : 0;

          return (
            <div className="space-y-4">
              <div className="flex h-3 w-full rounded-full overflow-hidden bg-white/5">
                <div style={{ width: `${t1Percent}%` }} className="bg-emerald-500 transition-all h-full" title={`Tier 1: ${pr.tier1Count}`} />
                <div style={{ width: `${t2Percent}%` }} className="bg-cyan-500 transition-all h-full" title={`Tier 2: ${pr.tier2Count}`} />
                <div style={{ width: `${t3Percent}%` }} className="bg-amber-500 transition-all h-full" title={`Tier 3: ${pr.tier3Count}`} />
                <div style={{ width: `${insufficientPercent}%` }} className="bg-zinc-500 transition-all h-full" title={`Insufficient Data: ${pr.insufficientCount}`} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs text-[#a1a1aa]">Tier 1 (FAANG/Top Tech)</p>
                    <p className="text-sm font-semibold text-white">
                      {pr.tier1Count} <span className="text-xs font-normal text-[#a1a1aa]">({Math.round(t1Percent)}%)</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500 shrink-0" />
                  <div>
                    <p className="text-xs text-[#a1a1aa]">Tier 2 (Mid-Product/Consulting)</p>
                    <p className="text-sm font-semibold text-white">
                      {pr.tier2Count} <span className="text-xs font-normal text-[#a1a1aa]">({Math.round(t2Percent)}%)</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs text-[#a1a1aa]">Tier 3 (IT Services/Support)</p>
                    <p className="text-sm font-semibold text-white">
                      {pr.tier3Count} <span className="text-xs font-normal text-[#a1a1aa]">({Math.round(t3Percent)}%)</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zinc-500 shrink-0" />
                  <div>
                    <p className="text-xs text-[#a1a1aa]">Insufficient Data</p>
                    <p className="text-sm font-semibold text-white">
                      {pr.insufficientCount} <span className="text-xs font-normal text-[#a1a1aa]">({Math.round(insufficientPercent)}%)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </GlassCard>

      {/* Enabled Portals */}
      <GlassCard className="p-5">
        <CardTitle className="text-sm">Enabled Portals</CardTitle>
        <div className="flex gap-2 mt-3">
          {(stats.enabledPortals || []).map((portal: string) => (
            <span key={portal} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300 capitalize">
              {portal}
            </span>
          ))}
        </div>
      </GlassCard>

      {/* Recent Activity */}
      <GlassCard className="p-5">
        <CardTitle className="text-sm mb-4">Recent Activity</CardTitle>
        {(data?.recentActivity || []).length === 0 ? (
          <p className="text-sm text-[#a1a1aa]">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {data.recentActivity.map((activity: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm text-white capitalize">{activity.type?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-[#a1a1aa]">{activity.reason?.replace(/_/g, ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{activity.amount} credits</p>
                  <p className="text-xs text-[#a1a1aa]">{new Date(activity.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
