'use client';

import { useState, useEffect } from 'react';
import { 
  UserPlus, Mail, Shield, Copy, Check, Calendar, 
  Users, Layers, ArrowUpRight, Plus, RefreshCw, X
} from 'lucide-react';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';

export default function MentorInvitePage() {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [expiresDays, setExpiresDays] = useState(30);
  const [maxUses, setMaxUses] = useState(100);
  const [message, setMessage] = useState('');
  const [degree, setDegree] = useState('B.Tech');
  const [subject, setSubject] = useState('Computer Science');
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchInvites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mentor/invite');
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleGenerateCode = async () => {
    setMessage('Generating code...');
    try {
      const res = await fetch('/api/mentor/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresDays, maxUses, degree, subject, year }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Success! Generated Invite Code: ${data.code}`);
        setShowModal(false);
        fetchInvites();
      } else {
        setMessage('Generation failed: ' + data.error);
      }
    } catch (err) {
      setMessage('Failed to generate code.');
    }
  };

  const handleCopyLink = (code: string) => {
    const link = `${window.location.origin}/signup?code=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="p-6 lg:p-8 min-h-screen relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Invite Access</h1>
          <p className="text-sm text-white/40">Securely onboard students and faculty under your institution licensing</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-emerald-400 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/10"
        >
          <Plus size={16} /> Generate Invite Code
        </button>
      </div>

      {message && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-emerald-400 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      {/* Invites list table */}
      <GlassCard padding="none" className="rounded-2xl border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-black text-white/30 uppercase tracking-[2px]">Generated Invite Links</h3>
          <button onClick={fetchInvites} className="text-white/40 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-white/30 text-xs">Loading invitation links...</div>
          ) : invites.length === 0 ? (
            <div className="p-12 text-center text-xs text-white/30 flex flex-col items-center justify-center gap-4">
              <Mail size={40} className="text-white/10" />
              <span>No invitation codes generated yet. Generate your first code above.</span>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">Code</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">Degree</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">Department</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">Graduation Year</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">Created At</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">Expires At</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">Usage</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest text-right">Link Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invites.map((inv) => (
                  <tr key={inv._id} className="hover:bg-white/[0.03] transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-emerald-400 font-mono">{inv.code}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-white/80">
                      {inv.degree || '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-white/80">
                      {inv.subject || '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-white/80 font-mono">
                      {inv.year || '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-white/60">
                      {new Date(inv.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-6 py-4 text-xs text-white/60">
                      {new Date(inv.expiresAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white font-mono">{inv.useCount}</span>
                        <span className="text-xs text-white/30">/</span>
                        <span className="text-xs text-white/40 font-mono">{inv.maxUses || '∞'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleCopyLink(inv.code)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all inline-flex items-center gap-1.5"
                      >
                        {copiedCode === inv.code ? (
                          <>
                            <Check size={12} className="text-emerald-400" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copy Signup Link
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </GlassCard>

      {/* Generate Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="glass-card rounded-3xl p-6 w-full max-w-md border border-emerald-500/20 shadow-emerald-500/10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Generate Invite Link</h3>
                <p className="text-xs text-white/40 mt-0.5">Setup expiration and usage limit parameters</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white/60 transition-colors p-1 rounded-lg hover:bg-white/5"><X size={18} /></button>
            </div>

            <div className="mb-4">
              <label className="text-xs font-black text-white/30 uppercase tracking-[2px] mb-2 block">Target Degree</label>
              <select value={degree} onChange={(e) => setDegree(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-[#0a0c1e] border border-white/10 outline-none">
                <option value="B.Tech">B.Tech</option>
                <option value="M.Tech">M.Tech</option>
                <option value="MCA">MCA</option>
                <option value="BCA">BCA</option>
                <option value="MBA">MBA</option>
                <option value="B.Sc">B.Sc</option>
                <option value="B.Com">B.Com</option>
                <option value="Other">Other (General)</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="text-xs font-black text-white/30 uppercase tracking-[2px] mb-2 block">Department / Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-[#0a0c1e] border border-white/10 outline-none">
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Data Science">Data Science</option>
                <option value="Artificial Intelligence">Artificial Intelligence</option>
                <option value="Electronics Engineering">Electronics Engineering</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
                <option value="Electrical Engineering">Electrical Engineering</option>
                <option value="Business Administration">Business Administration</option>
                <option value="Commerce">Commerce</option>
                <option value="General Science">General Science</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="text-xs font-black text-white/30 uppercase tracking-[2px] mb-2 block">Graduation Year</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-[#0a0c1e] border border-white/10 outline-none">
                {[2026, 2027, 2028, 2029, 2030, 2031, 2032].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="text-xs font-black text-white/30 uppercase tracking-[2px] mb-2 block">Validity (Days)</label>
              <select value={expiresDays} onChange={(e) => setExpiresDays(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-[#0a0c1e] border border-white/10 outline-none">
                <option value={7}>7 Days</option>
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
                <option value={365}>365 Days</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="text-xs font-black text-white/30 uppercase tracking-[2px] mb-2 block">Max Uses</label>
              <select value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-[#0a0c1e] border border-white/10 outline-none">
                <option value={10}>10 Uses</option>
                <option value={50}>50 Uses</option>
                <option value={100}>100 Uses</option>
                <option value={500}>500 Uses</option>
              </select>
            </div>

            <button onClick={handleGenerateCode}
              className="w-full py-3 rounded-xl text-sm font-bold text-black bg-emerald-400 hover:bg-emerald-500 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20">
              <UserPlus size={15} /> Create Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
