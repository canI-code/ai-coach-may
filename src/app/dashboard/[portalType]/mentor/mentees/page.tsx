'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, Button } from '@/app/components/ui';
import { Users, CreditCard, Loader2, Eye } from 'lucide-react';

export default function MentorMentees() {
  const [mentees, setMentees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMentees = async () => {
      try {
        const res = await fetch('/api/b2b/mentor/mentees');
        if (res.ok) setMentees(await res.json());
      } catch {} finally { setLoading(false); }
    };
    fetchMentees();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">My Mentees</h1>
        <p className="text-sm text-[#a1a1aa] mt-1">{mentees.length} mentee(s)</p>
      </div>

      {mentees.length === 0 ? (
        <GlassCard className="p-8 text-center text-[#a1a1aa]">
          No mentees yet. Share your invite code to get students to join.
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {mentees.map((mentee) => (
            <GlassCard key={mentee._id} className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 font-bold text-sm">
                    {mentee.fullName?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{mentee.fullName}</h3>
                    <p className="text-xs text-[#a1a1aa]">{mentee.email} · {mentee.batchName || 'No batch'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{mentee.credits?.remaining || 0} <span className="text-xs text-[#a1a1aa]">credits</span></p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    mentee.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>{mentee.status}</span>
                  <div className="flex gap-1.5">
                    {(mentee.enabledPortals || []).map((p: string) => (
                      <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-[#a1a1aa] capitalize">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
