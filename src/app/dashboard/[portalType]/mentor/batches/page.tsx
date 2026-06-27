'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, Button, Input, Select } from '@/app/components/ui';
import { BookOpen, Plus, Users, Loader2, Copy, Check, Activity, Coins, Link2, ChevronDown, ChevronUp, Calendar, Clock, Download, FileText } from 'lucide-react';
import { generateBatchReportPDF, BatchReportOptions } from '@/lib/b2b/batchReport';
import { MenteeDetailsSlideover } from './MenteeDetailsSlideover';

export default function MentorBatches() {
  const [batches, setBatches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchesError, setBatchesError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', year: '' });
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // States for expanding batch cards and fetching mentees
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [menteesMap, setMenteesMap] = useState<Record<string, any[]>>({});
  const [loadingMentees, setLoadingMentees] = useState<Record<string, boolean>>({});
  const [menteesErrorMap, setMenteesErrorMap] = useState<Record<string, string>>({});
  
  // State for slide-over mentee details
  const [selectedMentee, setSelectedMentee] = useState<any | null>(null);

  // Report Modal States
  const [reportModalBatch, setReportModalBatch] = useState<any | null>(null);
  const [reportOptions, setReportOptions] = useState<BatchReportOptions>({
    includeProfile: true,
    includeCredits: true,
    includeSessions: true,
    includeOverallReadiness: true,
    includeDetailedBreakdown: true,
  });

  // States for scheduled campaigns
  const [campaignsMap, setCampaignsMap] = useState<Record<string, any[]>>({});
  const [loadingCampaigns, setLoadingCampaigns] = useState<Record<string, boolean>>({});
  const [campaignsErrorMap, setCampaignsErrorMap] = useState<Record<string, string>>({});
  const [creatingCampaign, setCreatingCampaign] = useState<Record<string, boolean>>({});
  const [campaignForms, setCampaignForms] = useState<Record<string, {
    title: string;
    type: 'interview' | 'exam';
    startTime: string;
    endTime: string;
    durationMinutes: number;
    role?: string;
    difficulty?: number;
    tags?: string;
  }>>({});

  const getCampaignForm = (batchId: string) => {
    return campaignForms[batchId] || {
      title: '',
      type: 'interview',
      startTime: '',
      endTime: '',
      durationMinutes: 30,
      role: '',
      difficulty: 2,
      tags: ''
    };
  };

  const updateCampaignForm = (batchId: string, updates: any) => {
    setCampaignForms(prev => ({
      ...prev,
      [batchId]: { ...getCampaignForm(batchId), ...updates }
    }));
  };

  const fetchCampaigns = async (batchId: string) => {
    setLoadingCampaigns(prev => ({ ...prev, [batchId]: true }));
    setCampaignsErrorMap(prev => ({ ...prev, [batchId]: '' }));
    try {
      const res = await fetch(`/api/b2b/mentor/campaigns?batchId=${batchId}`);
      if (res.ok) {
        const data = await res.json();
        setCampaignsMap(prev => ({ ...prev, [batchId]: data }));
      } else {
        setCampaignsErrorMap(prev => ({ ...prev, [batchId]: 'Failed to load campaigns.' }));
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setCampaignsErrorMap(prev => ({ ...prev, [batchId]: 'Failed to load campaigns.' }));
    } finally {
      setLoadingCampaigns(prev => ({ ...prev, [batchId]: false }));
    }
  };

  const fetchMentees = async (batchId: string) => {
    setLoadingMentees(prev => ({ ...prev, [batchId]: true }));
    setMenteesErrorMap(prev => ({ ...prev, [batchId]: '' }));
    try {
      const res = await fetch(`/api/b2b/mentor/batches/${batchId}/mentees`);
      if (res.ok) {
        const data = await res.json();
        setMenteesMap(prev => ({ ...prev, [batchId]: data }));
      } else {
        setMenteesErrorMap(prev => ({ ...prev, [batchId]: 'Failed to load mentees.' }));
      }
    } catch (err) {
      console.error('Error fetching batch mentees:', err);
      setMenteesErrorMap(prev => ({ ...prev, [batchId]: 'Failed to load mentees.' }));
    } finally {
      setLoadingMentees(prev => ({ ...prev, [batchId]: false }));
    }
  };

  const fetchBatchesAndDeps = async () => {
    try {
      setLoading(true);
      setBatchesError('');
      const [batchesRes, deptRes] = await Promise.all([
        fetch('/api/b2b/mentor/batches'),
        fetch('/api/b2b/institution/departments')
      ]);
      
      if (batchesRes.ok) {
        setBatches(await batchesRes.json());
      } else {
        setBatchesError('Failed to load batches');
      }

      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments || []);
      }
    } catch {
      setBatchesError('Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBatchesAndDeps(); }, []);

  const toggleExpand = async (batchId: string) => {
    const isExpanding = !expandedBatches[batchId];
    setExpandedBatches(prev => ({ ...prev, [batchId]: isExpanding }));

    if (isExpanding) {
      if (!menteesMap[batchId] || menteesErrorMap[batchId]) {
        fetchMentees(batchId);
      }
      fetchCampaigns(batchId);
    }
  };

  const handleCreateCampaign = async (batchId: string) => {
    const form = getCampaignForm(batchId);
    if (!form.title || !form.startTime || !form.endTime) {
      alert('Please fill out Title, Start Time, and End Time.');
      return;
    }

    setCreatingCampaign(prev => ({ ...prev, [batchId]: true }));
    try {
      const payload = {
        title: form.title,
        type: form.type,
        batchId,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        config: {
          role: form.type === 'interview' ? (form.role || undefined) : undefined,
          difficulty: form.type === 'interview' ? Number(form.difficulty) : undefined,
          tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
        }
      };

      const res = await fetch('/api/b2b/mentor/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Reset form
        setCampaignForms(prev => ({
          ...prev,
          [batchId]: {
            title: '',
            type: 'interview',
            startTime: '',
            endTime: '',
            durationMinutes: 30,
            role: '',
            difficulty: 2,
            tags: ''
          }
        }));
        // Refresh campaigns list
        fetchCampaigns(batchId);
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to create campaign');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating campaign');
    } finally {
      setCreatingCampaign(prev => ({ ...prev, [batchId]: false }));
    }
  };

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
        fetchBatchesAndDeps();
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
            <Select 
              label="Department" 
              value={form.department} 
              onChange={(e) => setForm({ ...form, department: e.target.value })} 
              options={departments.map(d => ({ value: d, label: d }))}
              placeholder="Select Department"
            />
            <Input label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2024-25" />
          </div>
          <Button onClick={handleCreate} disabled={creating} className="mt-4">{creating ? 'Creating...' : 'Create'}</Button>
        </GlassCard>
      )}

      {batchesError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between">
          <span>{batchesError}</span>
          <Button variant="secondary" size="sm" onClick={fetchBatchesAndDeps}>Retry</Button>
        </div>
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
            const isExpanded = !!expandedBatches[batch._id];

            return (
              <GlassCard
                key={batch._id}
                className={`p-6 flex flex-col justify-between border-white/5 hover:border-teal-500/20 transition-all duration-300 ${
                  isExpanded ? 'col-span-1 md:col-span-2' : ''
                }`}
              >
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

                    <div className="flex items-center gap-4">
                      {/* Overall Cumulative Health Badge */}
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-[#a1a1aa] block mb-1">Batch Health</span>
                        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${healthBg} ${healthColor}`}>
                          <Activity className="w-3.5 h-3.5" />
                          <span>{health === 'N/A' ? 'N/A' : `${health}%`}</span>
                        </div>
                      </div>

                      {/* Expand Toggle Button */}
                      <button
                        onClick={() => toggleExpand(batch._id)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#a1a1aa] hover:text-white transition-colors cursor-pointer mt-2"
                        title={isExpanded ? 'Collapse Mentees' : 'Expand Mentees'}
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
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

                {/* Expanded Sections */}
                {isExpanded && (
                  <div className="mt-6 border-t border-white/5 pt-4 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Column 1: Mentees & Placement Readiness (2/3 width on large screens) */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-teal-400" />
                          Mentees & Placement Readiness
                        </h4>
                        {!loadingMentees[batch._id] && !menteesErrorMap[batch._id] && menteesMap[batch._id]?.length > 0 && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => setReportModalBatch(batch)}
                            className="flex items-center gap-2"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Report
                          </Button>
                        )}
                      </div>
                      {loadingMentees[batch._id] ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                        </div>
                      ) : menteesErrorMap[batch._id] ? (
                        <div className="text-xs text-rose-400 py-4 flex items-center justify-between">
                          <span>{menteesErrorMap[batch._id]}</span>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => fetchMentees(batch._id)}
                          >
                            Retry
                          </Button>
                        </div>
                      ) : !menteesMap[batch._id] || menteesMap[batch._id].length === 0 ? (
                        <p className="text-xs text-[#a1a1aa] py-2">No mentees found in this batch.</p>
                      ) : (
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-white/5 text-[#a1a1aa] font-medium">
                                <th className="py-2 pb-3 font-semibold">Student</th>
                                <th className="py-2 pb-3 font-semibold">Email</th>
                                <th className="py-2 pb-3 font-semibold">Degree & Course</th>
                                <th className="py-2 pb-3 font-semibold">Credits</th>
                                <th className="py-2 pb-3 font-semibold">Sessions</th>
                                <th className="py-2 pb-3 font-semibold text-right">Readiness Tier</th>
                              </tr>
                            </thead>
                            <tbody>
                              {menteesMap[batch._id].map((m: any) => {
                                let tierColorStyle = "bg-[hsla(240,5%,40%,0.1)] border-[hsla(240,5%,40%,0.3)] text-[hsl(240,5%,75%)]"; // Insufficient Data
                                if (m.readiness?.tier === 'Tier 1') {
                                  tierColorStyle = "bg-[hsla(150,80%,40%,0.15)] border-[hsla(150,80%,40%,0.3)] text-[hsl(150,80%,70%)]";
                                } else if (m.readiness?.tier === 'Tier 2') {
                                  tierColorStyle = "bg-[hsla(190,80%,40%,0.15)] border-[hsla(190,80%,40%,0.3)] text-[hsl(190,80%,70%)]";
                                } else if (m.readiness?.tier === 'Tier 3') {
                                  tierColorStyle = "bg-[hsla(40,80%,40%,0.15)] border-[hsla(40,80%,40%,0.3)] text-[hsl(40,80%,70%)]";
                                }

                                return (
                                  <tr 
                                    key={m._id} 
                                    className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => setSelectedMentee(m)}
                                  >
                                    <td className="py-3 font-medium text-white">{m.fullName}</td>
                                    <td className="py-3 text-[#a1a1aa] font-mono">{m.email}</td>
                                    <td className="py-3 text-[#a1a1aa]">{m.profile?.degree || 'N/A'} · {m.profile?.course || 'N/A'}</td>
                                    <td className="py-3 text-white">
                                      <span className="font-semibold">{m.credits?.used || 0}</span>
                                      <span className="text-[#a1a1aa] mx-1">/</span>
                                      <span className="text-teal-400 font-semibold">{m.credits?.remaining || 0}</span>
                                    </td>
                                    <td className="py-3 text-white font-semibold">{m.sessionCount || 0}</td>
                                    <td className="py-3 text-right">
                                      <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wide uppercase ${tierColorStyle}`}>
                                        {m.readiness?.tier || 'Insufficient Data'} {m.readiness?.score !== undefined ? `(${m.readiness.score})` : ''}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Column 2: Scheduled Campaigns (1/3 width on large screens) */}
                    <div className="space-y-6 lg:border-l lg:border-white/5 lg:pl-6">
                      <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-teal-400" />
                        Scheduled Campaigns
                      </h4>

                      {/* Campaigns Listing */}
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                        {loadingCampaigns[batch._id] ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
                          </div>
                        ) : campaignsErrorMap[batch._id] ? (
                          <div className="text-xs text-rose-400 py-2">{campaignsErrorMap[batch._id]}</div>
                        ) : !campaignsMap[batch._id] || campaignsMap[batch._id].length === 0 ? (
                          <p className="text-xs text-[#a1a1aa] italic py-2">No campaigns scheduled for this batch.</p>
                        ) : (
                          campaignsMap[batch._id].map((camp: any) => {
                            const now = new Date();
                            const start = new Date(camp.startTime);
                            const end = new Date(camp.endTime);
                            let statusText = 'Upcoming';
                            let statusStyle = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
                            if (now >= start && now <= end) {
                              statusText = 'Active';
                              statusStyle = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                            } else if (now > end) {
                              statusText = 'Past';
                              statusStyle = 'bg-white/5 border-white/10 text-[#a1a1aa]';
                            }

                            return (
                              <div key={camp._id} className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-2 hover:border-teal-500/10 transition-colors">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h6 className="text-sm font-semibold text-white">{camp.title}</h6>
                                    <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wide">
                                      {camp.type === 'interview' ? 'Interview Practice' : 'Exam Practice'}
                                    </span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${statusStyle}`}>
                                    {statusText}
                                  </span>
                                </div>
                                <div className="text-xs text-[#a1a1aa] space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                    <span>Duration: {camp.durationMinutes} mins</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                    <span className="truncate">
                                      {start.toLocaleDateString()} {start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} -
                                      <br />
                                      {end.toLocaleDateString()} {end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                  </div>
                                  {camp.config?.role && (
                                    <div className="text-[11px] text-white">
                                      Role: <span className="text-teal-400 font-semibold">{camp.config.role}</span>
                                    </div>
                                  )}
                                  {camp.config?.tags && camp.config.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {camp.config.tags.map((tag: string) => (
                                        <span key={tag} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-mono text-[#a1a1aa]">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="border-t border-white/5 pt-2 mt-2 flex justify-between items-center text-[11px]">
                                  <span className="text-[#a1a1aa]">Completion Stats</span>
                                  <span className="font-semibold text-white">
                                    Completed: {camp.completedCount || 0} / {batch.menteeCount || 0}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Create Campaign Form */}
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                        <h5 className="text-xs font-bold text-white uppercase tracking-wider">Schedule New Campaign</h5>
                        <Input
                          label="Campaign Title *"
                          value={getCampaignForm(batch._id).title}
                          onChange={(e) => updateCampaignForm(batch._id, { title: e.target.value })}
                          placeholder="e.g. Midterm Technical Assessment"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-[#a1a1aa] block mb-1">Campaign Type *</label>
                            <select
                              value={getCampaignForm(batch._id).type}
                              onChange={(e) => updateCampaignForm(batch._id, { type: e.target.value as any })}
                              className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
                            >
                              <option value="interview">Interview Practice</option>
                              <option value="exam">Exam Practice</option>
                            </select>
                          </div>
                          <div>
                            <Input
                              label="Duration (Mins) *"
                              type="number"
                              value={getCampaignForm(batch._id).durationMinutes}
                              onChange={(e) => updateCampaignForm(batch._id, { durationMinutes: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-[#a1a1aa] block mb-1">Start Time *</label>
                            <input
                              type="datetime-local"
                              value={getCampaignForm(batch._id).startTime}
                              onChange={(e) => updateCampaignForm(batch._id, { startTime: e.target.value })}
                              className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors animate-none"
                            />
                          </div>
                          <div>
                            <label className="text-[#a1a1aa] text-xs block mb-1">End Time *</label>
                            <input
                              type="datetime-local"
                              value={getCampaignForm(batch._id).endTime}
                              onChange={(e) => updateCampaignForm(batch._id, { endTime: e.target.value })}
                              className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors animate-none"
                            />
                          </div>
                        </div>
                        {getCampaignForm(batch._id).type === 'interview' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Input
                                label="Target Role"
                                value={getCampaignForm(batch._id).role || ''}
                                onChange={(e) => updateCampaignForm(batch._id, { role: e.target.value })}
                                placeholder="e.g. Software Engineer"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[#a1a1aa] block mb-1">Difficulty</label>
                              <select
                                value={getCampaignForm(batch._id).difficulty || 2}
                                onChange={(e) => updateCampaignForm(batch._id, { difficulty: Number(e.target.value) })}
                                className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors animate-none"
                              >
                                <option value="1">Easy</option>
                                <option value="2">Medium</option>
                                <option value="3">Hard</option>
                              </select>
                            </div>
                          </div>
                        )}
                        <Input
                          label="Topics / Tags (comma separated)"
                          value={getCampaignForm(batch._id).tags || ''}
                          onChange={(e) => updateCampaignForm(batch._id, { tags: e.target.value })}
                          placeholder="e.g. React, JavaScript, Frontend"
                        />
                        <Button
                          onClick={() => handleCreateCampaign(batch._id)}
                          disabled={creatingCampaign[batch._id]}
                          className="w-full justify-center cursor-pointer"
                        >
                          {creatingCampaign[batch._id] ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Scheduling...
                            </>
                          ) : (
                            'Schedule Campaign'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Report Config Modal */}
      {reportModalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#18181b] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Download Batch Report</h3>
                <p className="text-sm text-[#a1a1aa]">{reportModalBatch.name}</p>
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  checked={reportOptions.includeProfile}
                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeProfile: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-gray-900"
                />
                <span className="text-sm text-white font-medium">Include Profile Info (Degree & Course)</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  checked={reportOptions.includeCredits}
                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeCredits: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-gray-900"
                />
                <span className="text-sm text-white font-medium">Include Credit Usage</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  checked={reportOptions.includeSessions}
                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeSessions: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-gray-900"
                />
                <span className="text-sm text-white font-medium">Include Session Counts</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  checked={reportOptions.includeOverallReadiness}
                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeOverallReadiness: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-gray-900"
                />
                <span className="text-sm text-white font-medium">Include Overall Readiness Tier & Score</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  checked={reportOptions.includeDetailedBreakdown}
                  onChange={(e) => setReportOptions(prev => ({ ...prev, includeDetailedBreakdown: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-gray-900"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-white font-medium">Include Detailed Breakdown</span>
                  <span className="text-[10px] text-[#a1a1aa]">Communication, Technical, and Mock Interview Scores</span>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
              <Button variant="secondary" onClick={() => setReportModalBatch(null)}>Cancel</Button>
              <Button 
                variant="primary" 
                onClick={() => {
                  const mentees = menteesMap[reportModalBatch._id] || [];
                  generateBatchReportPDF(reportModalBatch, mentees, reportOptions, "Mentor");
                  setReportModalBatch(null);
                }}
              >
                Generate PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over */}
      <MenteeDetailsSlideover 
        mentee={selectedMentee} 
        onClose={() => setSelectedMentee(null)} 
      />
    </div>
  );
}
