'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, Button, Input, Select } from '@/app/components/ui';
import { UserPlus, Mail, Copy, Check, CreditCard, Loader2, Eye, EyeOff, Trash2, ChevronDown, ChevronUp, Save } from 'lucide-react';

export default function InstitutionMentors() {
  const [mentors, setMentors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newCredentials, setNewCredentials] = useState<any>(null);

  // Expanded editor states
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({
    fullName: '', email: '', phone: '', department: '', year: '', status: 'active', password: '', addCredits: 0
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', department: '', year: '', credits: 0,
  });

  const fetchMentorsAndDeps = async () => {
    try {
      setLoading(true);
      const [mentorsRes, deptRes] = await Promise.all([
        fetch('/api/b2b/institution/mentors'),
        fetch('/api/b2b/institution/departments')
      ]);
      
      if (mentorsRes.ok) setMentors(await mentorsRes.json());
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMentorsAndDeps(); }, []);

  const handleExpand = (mentor: any) => {
    if (expandedId === mentor._id) {
      setExpandedId(null);
    } else {
      setExpandedId(mentor._id);
      setEditForm({
        fullName: mentor.fullName || '',
        email: mentor.email || '',
        phone: mentor.phone || '',
        department: mentor.department || '',
        year: mentor.year || '',
        status: mentor.status || 'active',
        password: mentor.rawPassword || '',
        addCredits: 0
      });
      setError('');
      setMessage('');
    }
  };

  const handleUpdate = async (mentorId: string) => {
    setError('');
    setMessage('');
    setUpdatingId(mentorId);
    try {
      const payload: any = {
        fullName: editForm.fullName,
        email: editForm.email,
        phone: editForm.phone,
        department: editForm.department,
        year: editForm.year,
        status: editForm.status
      };
      
      const originalMentor = mentors.find(m => m._id === mentorId);
      if (editForm.password && editForm.password !== originalMentor?.rawPassword) {
        payload.password = editForm.password;
      }
      
      if (editForm.addCredits > 0) {
        payload.addCredits = parseInt(editForm.addCredits) || 0;
      }

      const res = await fetch(`/api/b2b/institution/mentors/${mentorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        setMessage('Mentor updated successfully!');
        setExpandedId(null);
        fetchMentorsAndDeps();
      } else {
        setError(data.error || 'Failed to update mentor');
      }
    } catch (err) {
      setError('An error occurred during update');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteRequest = async (mentorId: string) => {
    if (!confirm('Are you sure you want to request deletion of this mentor? This will ask the mentor to accept the request on their dashboard.')) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/b2b/institution/mentors/${mentorId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'Deletion request submitted successfully!');
        setExpandedId(null);
        fetchMentorsAndDeps();
      } else {
        setError(data.error || 'Failed to submit deletion request');
      }
    } catch (err) {
      setError('An error occurred during deletion request');
    }
  };

  const handleCreate = async () => {
    setError('');
    setMessage('');
    if (!form.fullName || !form.email) {
      setError('Name and email are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/b2b/institution/mentors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setNewCredentials(data.credentials);
        setMessage(`Mentor "${form.fullName}" created successfully!`);
        setForm({ fullName: '', email: '', phone: '', department: '', year: '', credits: 0 });
        fetchMentorsAndDeps();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to create mentor');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Mentors</h1>
          <p className="text-sm text-[#a1a1aa] mt-1">{mentors.length} mentor(s) registered</p>
        </div>
        <Button onClick={() => { setShowCreate(!showCreate); setNewCredentials(null); setError(''); setMessage(''); }}>
          <UserPlus className="w-4 h-4 mr-2" />
          {showCreate ? 'Cancel' : 'Add Mentor'}
        </Button>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{message}</div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Credentials Display */}
      {newCredentials && (
        <GlassCard className="p-5 border-emerald-500/20">
          <CardTitle className="text-sm text-emerald-400 mb-3">🔑 Login Credentials (share with mentor)</CardTitle>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
              <div>
                <span className="text-xs text-[#a1a1aa]">Email:</span>
                <span className="text-sm text-white ml-2 font-mono">{newCredentials.email}</span>
              </div>
              <button onClick={() => copyToClipboard(newCredentials.email, 'email')} className="text-[#a1a1aa] hover:text-white">
                {copiedId === 'email' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
              <div>
                <span className="text-xs text-[#a1a1aa]">Password:</span>
                <span className="text-sm text-white ml-2 font-mono">{newCredentials.password}</span>
              </div>
              <button onClick={() => copyToClipboard(newCredentials.password, 'pass')} className="text-[#a1a1aa] hover:text-white">
                {copiedId === 'pass' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Create Form */}
      {showCreate && (
        <GlassCard className="p-5 border-purple-500/20">
          <CardTitle className="text-sm mb-4">Create New Mentor</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Full Name *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Dr. Smith" />
            <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="mentor@college.edu" />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91XXXXXXXXXX" />
            <Select 
              label="Department" 
              value={form.department} 
              onChange={(e) => setForm({ ...form, department: e.target.value })} 
              options={departments.map(d => ({ value: d, label: d }))}
              placeholder="Select Department"
            />
            <Input label="Year / Batch" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2024-25" />
            <Input label="Initial Credits" type="number" value={form.credits.toString()} onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value) || 0 })} placeholder="0 = request-based" />
          </div>
          <p className="text-xs text-[#a1a1aa] mt-3">Leave credits at 0 if mentors should request credits based on their needs.</p>
          <Button onClick={handleCreate} disabled={creating} className="mt-4">
            {creating ? 'Creating...' : 'Create Mentor'}
          </Button>
        </GlassCard>
      )}

      {/* Mentors List */}
      <div className="space-y-3">
        {mentors.length === 0 ? (
          <GlassCard className="p-8 text-center text-[#a1a1aa]">
            No mentors yet. Click "Add Mentor" to create one.
          </GlassCard>
        ) : (
          mentors.map((mentor) => {
            const isExpanded = expandedId === mentor._id;
            const isUpdating = updatingId === mentor._id;
            
            return (
              <GlassCard key={mentor._id} className={`p-5 transition-all duration-300 ${isExpanded ? 'border-purple-500/30 shadow-[0_0_15px_rgba(147,51,234,0.1)]' : ''}`}>
                <div 
                  onClick={() => handleExpand(mentor)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                      {mentor.fullName?.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        {mentor.fullName}
                      </h3>
                      <p className="text-xs text-[#a1a1aa]">{mentor.email} · {mentor.department || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{mentor.credits?.remaining || 0} <span className="text-xs text-[#a1a1aa]">credits</span></p>
                      <p className="text-xs text-[#a1a1aa]">{mentor.menteeCount || 0} mentees</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${
                      mentor.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : mentor.status === 'pending_delete'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {mentor.status === 'pending_delete' ? 'pending delete' : mentor.status}
                    </span>
                    <div className="text-[#a1a1aa]">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-white/5 space-y-5">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider text-purple-400">Edit Mentor Details</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input 
                        label="Full Name" 
                        value={editForm.fullName} 
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} 
                      />
                      <Input 
                        label="Email" 
                        value={editForm.email} 
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} 
                      />
                      <Input 
                        label="Phone" 
                        value={editForm.phone} 
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} 
                      />
                      <Select 
                        label="Department" 
                        value={editForm.department} 
                        onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} 
                        options={departments.map(d => ({ value: d, label: d }))}
                        placeholder="Select Department"
                      />
                      <Input 
                        label="Year / Batch" 
                        value={editForm.year} 
                        onChange={(e) => setEditForm({ ...editForm, year: e.target.value })} 
                      />
                      
                      <div>
                        <label className="block text-sm font-medium text-muted mb-2">Account Status</label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="glass-input w-full cursor-pointer"
                        >
                          <option value="active" className="bg-[#0d0f1a]">Active</option>
                          <option value="disabled" className="bg-[#0d0f1a]">Disabled</option>
                        </select>
                      </div>

                      <div className="relative">
                        <label className="block text-sm font-medium text-muted mb-2">Password</label>
                        <div className="flex gap-2">
                          <input 
                            type={showPass[mentor._id] ? "text" : "password"}
                            value={editForm.password}
                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                            className="glass-input flex-1 font-mono"
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPass({ ...showPass, [mentor._id]: !showPass[mentor._id] })}
                            className="px-3 rounded-xl border border-white/10 bg-white/5 text-[#a1a1aa] hover:text-white"
                          >
                            {showPass[mentor._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          {editForm.password && (
                            <button 
                              type="button"
                              onClick={() => copyToClipboard(editForm.password, `pass-${mentor._id}`)}
                              className="px-3 rounded-xl border border-white/10 bg-white/5 text-[#a1a1aa] hover:text-white"
                            >
                              {copiedId === `pass-${mentor._id}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <Input 
                        label="Add Credits" 
                        type="number"
                        placeholder="Amount to allocate from institute balance"
                        value={editForm.addCredits.toString()} 
                        onChange={(e) => setEditForm({ ...editForm, addCredits: parseInt(e.target.value) || 0 })} 
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <div>
                        {mentor.status === 'disabled' ? (
                          <Button 
                            variant="secondary"
                            onClick={() => handleDeleteRequest(mentor._id)}
                            className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Permanently
                          </Button>
                        ) : mentor.status !== 'pending_delete' ? (
                          <Button 
                            variant="secondary"
                            onClick={() => handleDeleteRequest(mentor._id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Mentor
                          </Button>
                        ) : (
                          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                            ⚠️ Deletion pending mentor approval
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Button 
                          variant="secondary" 
                          onClick={() => setExpandedId(null)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => handleUpdate(mentor._id)} 
                          disabled={isUpdating}
                          icon={<Save className="w-4 h-4" />}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {isUpdating ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
