'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, Button, Input } from '@/app/components/ui';
import { CreditCard, Send, Loader2, ArrowRightLeft, Users } from 'lucide-react';

export default function MentorCredits() {
  const [profile, setProfile] = useState<any>(null);
  const [mentees, setMentees] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'distribute' | 'request' | 'history'>('distribute');
  const [distributing, setDistributing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [requestForm, setRequestForm] = useState({ requestedCredits: 0, menteeCount: 0, message: '' });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [profRes, menteeRes, reqRes] = await Promise.all([
          fetch('/api/b2b/mentor/profile'),
          fetch('/api/b2b/mentor/mentees'),
          fetch('/api/b2b/mentor/credits/request'),
        ]);
        if (profRes.ok) setProfile(await profRes.json());
        if (menteeRes.ok) setMentees(await menteeRes.json());
        if (reqRes.ok) setRequests(await reqRes.json());
      } catch {} finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const handleDistribute = async () => {
    if (totalAmount <= 0) { setError('Amount must be greater than 0'); return; }
    setDistributing(true); setError(''); setMessage('');
    try {
      const res = await fetch('/api/b2b/mentor/credits/distribute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'equal', totalAmount }),
      });
      const data = await res.json();
      if (res.ok) { setMessage(data.message); setTotalAmount(0); }
      else setError(data.error);
    } catch { setError('Failed'); } finally { setDistributing(false); }
  };

  const handleRequest = async () => {
    if (requestForm.requestedCredits <= 0) { setError('Credits must be > 0'); return; }
    setRequesting(true); setError(''); setMessage('');
    try {
      const res = await fetch('/api/b2b/mentor/credits/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestForm),
      });
      const data = await res.json();
      if (res.ok) { setMessage(data.message); setRequestForm({ requestedCredits: 0, menteeCount: 0, message: '' }); }
      else setError(data.error);
    } catch { setError('Failed'); } finally { setRequesting(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>;

  const credits = profile?.credits || {};
  const activeMentees = mentees.filter(m => m.status === 'active');

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Credits</h1>

      {/* Balance */}
      <GlassCard className="p-6">
        <div className="grid grid-cols-3 gap-4">
          <div><p className="text-xs uppercase text-[#a1a1aa] mb-1">Allocated</p><p className="text-2xl font-bold text-white">{credits.allocated || 0}</p></div>
          <div><p className="text-xs uppercase text-[#a1a1aa] mb-1">Used</p><p className="text-2xl font-bold text-amber-400">{credits.used || 0}</p></div>
          <div><p className="text-xs uppercase text-[#a1a1aa] mb-1">Remaining</p><p className="text-2xl font-bold text-emerald-400">{credits.remaining || 0}</p></div>
        </div>
      </GlassCard>

      {message && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{message}</div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-2">
        {(['distribute', 'request', 'history'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(''); setMessage(''); }} className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${tab === t ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30' : 'bg-white/5 text-[#a1a1aa] hover:text-white border border-transparent'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'distribute' && (
        <GlassCard className="p-6">
          <CardTitle className="text-sm mb-4">Distribute Credits Equally</CardTitle>
          <p className="text-sm text-[#a1a1aa] mb-4">
            This will split credits equally among {activeMentees.length} active mentees.
            {activeMentees.length > 0 && totalAmount > 0 && (
              <span className="text-teal-400 font-semibold"> ({Math.floor(totalAmount / activeMentees.length)} each)</span>
            )}
          </p>
          <Input label="Total Credits to Distribute" type="number" value={totalAmount.toString()} onChange={(e) => setTotalAmount(parseInt(e.target.value) || 0)} />
          <Button onClick={handleDistribute} disabled={distributing} className="mt-4">
            <ArrowRightLeft className="w-4 h-4 mr-2" />{distributing ? 'Distributing...' : 'Distribute'}
          </Button>
        </GlassCard>
      )}

      {tab === 'request' && (
        <GlassCard className="p-6">
          <CardTitle className="text-sm mb-4">Request Credits from Institution</CardTitle>
          <div className="space-y-4">
            <Input label="Credits Needed" type="number" value={requestForm.requestedCredits.toString()} onChange={(e) => setRequestForm({ ...requestForm, requestedCredits: parseInt(e.target.value) || 0 })} />
            <Input label="Number of Students" type="number" value={requestForm.menteeCount.toString()} onChange={(e) => setRequestForm({ ...requestForm, menteeCount: parseInt(e.target.value) || 0 })} />
            <div>
              <label className="block text-sm text-[#a1a1aa] mb-2">Message</label>
              <textarea className="glass-input w-full min-h-[80px] resize-none" value={requestForm.message} onChange={(e) => setRequestForm({ ...requestForm, message: e.target.value })} placeholder="Explain why..." />
            </div>
            <Button onClick={handleRequest} disabled={requesting}><Send className="w-4 h-4 mr-2" />{requesting ? 'Submitting...' : 'Submit Request'}</Button>
          </div>
        </GlassCard>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <GlassCard className="p-6 text-center text-[#a1a1aa]">No credit requests yet.</GlassCard>
          ) : (
            requests.map((req) => (
              <GlassCard key={req._id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-semibold">{req.requestedCredits} credits requested</p>
                    <p className="text-xs text-[#a1a1aa]">{req.menteeCount} students · {new Date(req.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : req.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                  }`}>{req.status}</span>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}
    </div>
  );
}
