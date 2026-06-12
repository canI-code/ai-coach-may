'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, Button, Input } from '@/app/components/ui';
import { CreditCard, Send, Clock, Loader2, ArrowUpRight } from 'lucide-react';

export default function InstitutionCredits() {
  const [profile, setProfile] = useState<any>(null);
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMentors, setLoadingMentors] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ requestedCredits: 0, requestedDuration: '', message: '' });

  useEffect(() => {
    const fetchProfileAndMentors = async () => {
      try {
        const profileRes = await fetch('/api/b2b/institution/profile');
        if (profileRes.ok) setProfile(await profileRes.json());

        const mentorsRes = await fetch('/api/b2b/institution/mentors');
        if (mentorsRes.ok) setMentors(await mentorsRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setLoadingMentors(false);
      }
    };
    fetchProfileAndMentors();
  }, []);

  const handleRequest = async () => {
    setError('');
    setMessage('');
    if (!form.requestedCredits || form.requestedCredits <= 0) {
      setError('Credits must be greater than 0');
      return;
    }
    setRequesting(true);
    try {
      const res = await fetch('/api/b2b/institution/credits/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setShowRequest(false);
        setForm({ requestedCredits: 0, requestedDuration: '', message: '' });
      } else {
        setError(data.error);
      }
    } catch {
      setError('Request failed');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>;
  }

  const plan = profile?.plan || {};
  const usedPercent = plan.totalCredits ? Math.round((plan.usedCredits / plan.totalCredits) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Credits & Plan</h1>

      {message && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{message}</div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <CardTitle className="text-lg">Credit Usage</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setShowRequest(!showRequest)}>
            <ArrowUpRight className="w-4 h-4 mr-1" />
            Request More
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#a1a1aa] mb-1">Total</p>
            <p className="text-3xl font-bold text-white">{plan.totalCredits || 0}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#a1a1aa] mb-1">Used</p>
            <p className="text-3xl font-bold text-amber-400">{plan.usedCredits || 0}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#a1a1aa] mb-1">Remaining</p>
            <p className="text-3xl font-bold text-emerald-400">{(plan.totalCredits || 0) - (plan.usedCredits || 0)}</p>
          </div>
        </div>
        <div className="h-3 rounded-full bg-white/5 overflow-hidden">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <p className="text-xs text-[#a1a1aa] mt-2">{usedPercent}% of credits used</p>
      </GlassCard>

      {/* Mentor Credit Distribution */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider text-purple-400 flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Mentor Credit Distribution
        </h2>
        
        {loadingMentors ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        ) : mentors.filter(m => (m.credits?.allocated || 0) > 0).length === 0 ? (
          <GlassCard className="p-6 text-center text-[#a1a1aa] border-purple-500/10">
            <p className="text-sm">No credits have been allocated to mentors yet.</p>
            <p className="text-xs text-[#71717a] mt-1">Go to the Mentors tab to allocate credits to your mentors.</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mentors
              .filter(m => (m.credits?.allocated || 0) > 0)
              .map(mentor => {
                const allocated = mentor.credits?.allocated || 0;
                const used = mentor.credits?.used || 0;
                const remaining = mentor.credits?.remaining || 0;
                const pct = allocated ? Math.round((used / allocated) * 100) : 0;
                
                return (
                  <GlassCard key={mentor._id} className="p-5 border-white/5 hover:border-purple-500/20 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full bg-purple-500/15 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
                        {mentor.fullName?.substring(0, 2).toUpperCase() || 'MT'}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="text-sm font-semibold text-white truncate">{mentor.fullName}</h3>
                        <p className="text-xs text-[#a1a1aa] truncate">{mentor.email} {mentor.department ? `· ${mentor.department}` : ''}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#a1a1aa]">Used: <span className="font-semibold text-white">{used}</span></span>
                        <span className="text-purple-400 font-medium">{remaining} / {allocated} Remaining</span>
                      </div>
                      
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-purple-500 transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center text-xs">
                        <div>
                          <span className="block text-[#a1a1aa] text-[9px] uppercase tracking-wider">Allocated</span>
                          <span className="font-semibold text-white">{allocated}</span>
                        </div>
                        <div>
                          <span className="block text-[#a1a1aa] text-[9px] uppercase tracking-wider">Used</span>
                          <span className="font-semibold text-amber-400">{used}</span>
                        </div>
                        <div>
                          <span className="block text-[#a1a1aa] text-[9px] uppercase tracking-wider">Remaining</span>
                          <span className="font-semibold text-emerald-400">{remaining}</span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
          </div>
        )}
      </div>

      <GlassCard className="p-6">
        <CardTitle className="text-sm mb-4">Plan Details</CardTitle>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-[#a1a1aa] text-sm">Duration</span>
            <span className="text-white text-sm font-semibold">{plan.duration || 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-[#a1a1aa] text-sm">Expires</span>
            <span className="text-white text-sm font-semibold">{plan.expiresAt ? new Date(plan.expiresAt).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[#a1a1aa] text-sm">Portals</span>
            <div className="flex gap-1.5">
              {(plan.enabledPortals || []).map((p: string) => (
                <span key={p} className="px-2 py-0.5 rounded text-xs bg-purple-500/15 text-purple-300 capitalize">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {showRequest && (
        <GlassCard className="p-6 border-purple-500/20">
          <CardTitle className="text-sm mb-4">Request More Credits</CardTitle>
          <div className="space-y-4">
            <Input label="Credits Needed" type="number" value={form.requestedCredits.toString()} onChange={(e) => setForm({ ...form, requestedCredits: parseInt(e.target.value) || 0 })} />
            <Input label="Duration Extension (optional)" value={form.requestedDuration} onChange={(e) => setForm({ ...form, requestedDuration: e.target.value })} placeholder="e.g. 6 months" />
            <div>
              <label className="block text-sm text-[#a1a1aa] mb-2">Message to Admin</label>
              <textarea
                className="glass-input w-full min-h-[80px] resize-none"
                placeholder="Explain why you need more credits..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
            <Button onClick={handleRequest} disabled={requesting}>
              <Send className="w-4 h-4 mr-2" />{requesting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
