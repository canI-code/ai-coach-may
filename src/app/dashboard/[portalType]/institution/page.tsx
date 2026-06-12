'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui';
import { Users, UserPlus, CreditCard, TrendingUp, Clock, Loader2 } from 'lucide-react';

export default function InstitutionOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/b2b/institution/overview');
        if (res.ok) setData(await res.json());
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
