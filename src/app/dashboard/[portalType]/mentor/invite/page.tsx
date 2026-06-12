'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, Button } from '@/app/components/ui';
import { Link2, Copy, Check, Loader2 } from 'lucide-react';

export default function MentorInvite() {
  const [codes, setCodes] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const codesRes = await fetch('/api/b2b/mentor/invite');
      const batchesRes = await fetch('/api/b2b/mentor/batches');
      if (codesRes.ok) setCodes(await codesRes.json());
      if (batchesRes.ok) setBatches(await batchesRes.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleGenerate = async () => {
    if (!selectedBatch) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/b2b/mentor/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: selectedBatch }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewCode(data);
        fetchData();
      }
    } catch {} finally { setGenerating(false); }
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Invite Mentees</h1>
        <p className="text-sm text-[#a1a1aa] mt-1">Generate invite codes or links for students to join</p>
      </div>

      <GlassCard className="p-6">
        <CardTitle className="text-sm mb-4">Generate Invite Code</CardTitle>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-[#a1a1aa] mb-2">Select Batch *</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="glass-input w-full cursor-pointer bg-[#0c0f1a] text-white rounded-xl border border-white/10 p-3 outline-none"
            >
              <option value="" className="bg-[#0d0f1a]">Select a batch</option>
              {batches.map((b) => (
                <option key={b._id} value={b._id} className="bg-[#0d0f1a]">{b.name} ({b.department || 'N/A'})</option>
              ))}
            </select>
          </div>
          <Button onClick={handleGenerate} disabled={generating || !selectedBatch} className="cursor-pointer">
            {generating ? 'Generating...' : 'Generate Code'}
          </Button>
        </div>
      </GlassCard>

      {newCode && (
        <GlassCard className="p-6 border-teal-500/20">
          <CardTitle className="text-sm text-teal-400 mb-4">✨ New Invite Generated</CardTitle>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white/5 rounded-lg p-4">
              <div>
                <span className="text-xs text-[#a1a1aa]">Code:</span>
                <span className="text-lg text-white ml-2 font-mono font-bold tracking-[4px]">{newCode.code}</span>
              </div>
              <button onClick={() => copy(newCode.code, 'code')} className="text-[#a1a1aa] hover:text-white cursor-pointer">
                {copiedId === 'code' ? <Check className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded-lg p-4">
              <div className="overflow-hidden">
                <span className="text-xs text-[#a1a1aa]">Link:</span>
                <span className="text-sm text-white ml-2 font-mono truncate">{newCode.inviteLink}</span>
              </div>
              <button onClick={() => copy(newCode.inviteLink, 'link')} className="text-[#a1a1aa] hover:text-white cursor-pointer shrink-0 ml-3">
                {copiedId === 'link' ? <Check className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-[#a1a1aa]">Expires in {newCode.expiresIn}</p>
          </div>
        </GlassCard>
      )}

      <div className="space-y-3">
        {codes.length === 0 ? (
          <GlassCard className="p-8 text-center text-[#a1a1aa]">No invite codes generated yet.</GlassCard>
        ) : (
          codes.map((code) => {
            const batch = batches.find((b) => b._id === code.batchId);
            return (
              <GlassCard key={code._id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Link2 className="w-5 h-5 text-teal-400" />
                    <div>
                      <p className="text-white font-mono font-bold tracking-[2px]">{code.code}</p>
                      <p className="text-xs text-[#a1a1aa]">
                        Batch: <span className="text-teal-400 font-semibold">{batch ? batch.name : 'Unknown Batch'}</span> · {code.usedBy?.length || 0} used · Expires {new Date(code.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    code.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>{code.status}</span>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
