'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, Button, Input } from '@/app/components/ui';
import { BookOpen, Plus, Users, Loader2, Copy, Check, Activity, Coins, Link2 } from 'lucide-react';

export default function MentorBatches() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', year: '' });
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/b2b/mentor/batches');
      if (res.ok) setBatches(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchBatches(); }, []);

  const handleCreate = async () => {
    if (!form.name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/b2b/mentor/batches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage('Batch created successfully!');
        setShowCreate(false);
        setForm({ name: '', department: '', year: '' });
        fetchBatches();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch {} finally { setCreating(false); }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Batches</h1>
          <p className="text-sm text-[#a1a1aa] mt-1">Manage student batches, monitor overall health, and view credit usage.</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="cursor-pointer">
          <Plus className="w-4 h-4 mr-2" />{showCreate ? 'Cancel' : 'New Batch'}
        </Button>
      </div>

      {message && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{message}</div>}

      {showCreate && (
        <GlassCard className="p-5 border-teal-500/20">
          <CardTitle className="text-sm mb-4">Create Batch</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Batch Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CSE 2024" />
            <Input label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Computer Science" />
            <Input label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2024-25" />
          </div>
          <Button onClick={handleCreate} disabled={creating} className="mt-4">{creating ? 'Creating...' : 'Create'}</Button>
        </GlassCard>
      )}

      {batches.length === 0 ? (
        <GlassCard className="p-8 text-center text-[#a1a1aa]">No batches created yet. Click "New Batch" to get started.</GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {batches.map((batch) => {
            const credits = batch.credits || { allocated: 0, used: 0, left: 0 };
            const health = batch.health !== null ? batch.health : 'N/A';
            const healthVal = typeof health === 'number' ? health : 0;
            const healthColor = healthVal >= 70 ? 'text-teal-400' : healthVal >= 40 ? 'text-amber-400' : 'text-rose-400';
            const healthBg = healthVal >= 70 ? 'bg-teal-500/20' : healthVal >= 40 ? 'bg-amber-500/20' : 'bg-rose-500/20';

            return (
              <GlassCard key={batch._id} className="p-6 flex flex-col justify-between border-white/5 hover:border-teal-500/20 transition-all duration-300">
                <div>
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-teal-500/10">
                        <BookOpen className="w-5 h-5 text-teal-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-lg">{batch.name}</h3>
                        <p className="text-xs text-[#a1a1aa]">
                          {batch.department || 'N/A'} · {batch.year || 'N/A'}
                        </p>
                      </div>
                    </div>
                    {/* Overall Cumulative Health Badge */}
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-[#a1a1aa] block mb-1">Batch Health</span>
                      <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${healthBg} ${healthColor}`}>
                        <Activity className="w-3.5 h-3.5" />
                        <span>{health === 'N/A' ? 'N/A' : `${health}%`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Analytics Section */}
                  <div className="grid grid-cols-2 gap-4 mt-6 mb-6">
                    {/* Mentee Count */}
                    <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-teal-400" />
                        <span className="text-xs text-[#a1a1aa]">Mentees</span>
                      </div>
                      <span className="text-2xl font-bold text-white font-mono">{batch.menteeCount || 0}</span>
                    </div>

                    {/* Credits Allocation */}
                    <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2 mb-1">
                        <Coins className="w-4 h-4 text-teal-400" />
                        <span className="text-xs text-[#a1a1aa]">Credits (Used / Left)</span>
                      </div>
                      <div className="flex items-baseline gap-1 text-white">
                        <span className="text-xl font-bold font-mono">{credits.used}</span>
                        <span className="text-xs text-[#a1a1aa]">/</span>
                        <span className="text-sm font-semibold text-teal-400 font-mono">{credits.left}</span>
                      </div>
                      {/* Credits Progress Bar */}
                      {credits.allocated > 0 && (
                        <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className="bg-teal-400 h-full rounded-full"
                            style={{ width: `${Math.min(100, (credits.used / credits.allocated) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Invite & Copy block */}
                <div className="border-t border-white/5 pt-4 mt-auto">
                  <span className="text-[10px] uppercase tracking-wider text-[#a1a1aa] block mb-2 font-medium">Invite Mentees to Batch</span>
                  <div className="flex flex-col gap-2">
                    {/* Invite Code display */}
                    <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#a1a1aa] font-mono">Code:</span>
                        <span className="text-sm font-mono font-bold text-white tracking-[2px]">{batch.inviteCode}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(batch.inviteCode, `${batch._id}-code`)}
                        className="text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
                        title="Copy Code"
                      >
                        {copiedId === `${batch._id}-code` ? <Check className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Invite Link display */}
                    <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5 border border-white/5">
                      <div className="flex items-center gap-2 overflow-hidden mr-2">
                        <Link2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span className="text-xs text-[#a1a1aa] truncate font-mono">{batch.inviteLink}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(batch.inviteLink, `${batch._id}-link`)}
                        className="text-[#a1a1aa] hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Copy Link"
                      >
                        {copiedId === `${batch._id}-link` ? <Check className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
