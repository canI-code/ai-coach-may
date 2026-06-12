'use client';

import { useState, useEffect } from 'react';
import { GlassCard, Button } from '@/app/components/ui';
import { Users, CreditCard, BookOpen, Loader2, AlertTriangle } from 'lucide-react';

export default function MentorOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/b2b/mentor/overview');
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAcceptDelete = async () => {
    if (!confirm('Are you absolutely sure you want to accept account deletion? This action is irreversible, your account will be disabled immediately, and all remaining credits will be returned to the institution.')) {
      return;
    }
    setAccepting(true);
    setError('');
    try {
      const res = await fetch('/api/b2b/mentor/accept-delete', { method: 'POST' });
      if (res.ok) {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to accept deletion');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>;
  }

  const stats = data?.stats || {};
  const isPendingDelete = data?.status === 'pending_delete';

  return (
    <div className="space-y-6 max-w-5xl">
      {isPendingDelete && (
        <GlassCard className="p-6 border-red-500/30 bg-red-950/10 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-red-400 font-bold text-base">⚠️ Account Deletion Requested</h3>
                <p className="text-sm text-[#e4e4e7] mt-1">
                  Your institution has requested to delete your mentor account. Accepting this request will immediately disable this account and return your remaining <strong className="text-amber-400">{stats.creditsRemaining || 0} credits</strong> to the institution.
                </p>
                {error && <p className="text-xs text-red-400 font-medium mt-2">{error}</p>}
              </div>
            </div>
            <Button 
              onClick={handleAcceptDelete} 
              disabled={accepting}
              className="bg-red-600 hover:bg-red-700 text-white shrink-0 cursor-pointer"
            >
              {accepting ? 'Deactivating...' : 'Accept Deletion Request'}
            </Button>
          </div>
        </GlassCard>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">Mentor Overview</h1>
        <p className="text-sm text-[#a1a1aa] mt-1">{data?.collegeName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[#a1a1aa] font-semibold">Active Mentees</span>
            <Users className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.activeMentees || 0}<span className="text-sm font-normal text-[#a1a1aa]"> / {stats.totalMentees || 0}</span></div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[#a1a1aa] font-semibold">Batches</span>
            <BookOpen className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalBatches || 0}</div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[#a1a1aa] font-semibold">Credits</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.creditsRemaining || 0}<span className="text-sm font-normal text-[#a1a1aa]"> / {stats.creditsAllocated || 0}</span></div>
          <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all" style={{ width: `${stats.creditsAllocated ? ((stats.creditsAllocated - stats.creditsRemaining) / stats.creditsAllocated * 100) : 0}%` }} />
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[#a1a1aa] font-semibold">Portals</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {(stats.enabledPortals || []).map((p: string) => (
              <span key={p} className="px-2 py-1 rounded text-xs bg-teal-500/15 text-teal-300 capitalize">{p}</span>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
