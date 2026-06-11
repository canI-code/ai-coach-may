'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Shield, Save, Loader2, CheckCircle, AlertCircle, Building } from 'lucide-react';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';

export default function MentorProfilePage() {
  const [profile, setProfile] = useState<any>({
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    gender: '',
    collegeName: '',
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/mentor/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          setError('Failed to load profile details.');
        }
      } catch (err) {
        setError('Network error loading profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (password && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/mentor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profile.fullName,
          phone: profile.phone,
          dob: profile.dob,
          gender: profile.gender,
          password: password || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Profile updated successfully!');
        setPassword('');
        setConfirmPassword('');
        // Refresh profile data
        const refreshRes = await fetch('/api/mentor/profile');
        if (refreshRes.ok) {
          const freshData = await refreshRes.json();
          setProfile(freshData);
        }
      } else {
        setError(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setError('An error occurred during save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="ml-2 text-white/50 text-sm">Loading profile details...</span>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 min-h-screen relative z-10 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Mentor Profile</h1>
        <p className="text-sm text-white/40">Manage your credentials, details and college affiliation</p>
      </div>

      {message && (
        <div className="mb-6 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* General Information Card */}
          <GlassCard padding="lg" className="rounded-2xl border-white/5 space-y-4">
            <CardTitle className="text-md flex items-center gap-2">
              <User className="text-emerald-400" size={18} /> Personal Information
            </CardTitle>
            <CardDescription className="mb-4">Your personal identity and contact info</CardDescription>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">Full Name</label>
                <input
                  type="text"
                  required
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">Phone Number</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                  <input
                    type="text"
                    required
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="pl-9 w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">Date of Birth</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <input
                      type="date"
                      required
                      value={profile.dob ? profile.dob.substring(0, 10) : ''}
                      onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                      className="pl-9 w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">Gender</label>
                  <select
                    value={profile.gender}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#0a0c1c] border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500/50 transition-all"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Affiliation & Security */}
          <div className="space-y-6">
            <GlassCard padding="lg" className="rounded-2xl border-white/5 space-y-4">
              <CardTitle className="text-md flex items-center gap-2">
                <Building className="text-emerald-400" size={18} /> Affiliation & Account
              </CardTitle>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">College / Institution</label>
                  <div className="relative">
                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <input
                      type="text"
                      disabled
                      value={profile.collegeName}
                      className="pl-9 w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs text-white/40 cursor-not-allowed outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">Email Address</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <input
                      type="email"
                      disabled
                      value={profile.email}
                      className="pl-9 w-full px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs text-white/40 cursor-not-allowed outline-none"
                    />
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard padding="lg" className="rounded-2xl border-white/5 space-y-4">
              <CardTitle className="text-md flex items-center gap-2">
                <Shield className="text-emerald-400" size={18} /> Security Settings
              </CardTitle>
              <CardDescription>Leave blank if you do not want to change your password</CardDescription>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/10"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/10"
                  />
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            icon={saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            className="bg-emerald-400 hover:bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/10 px-6"
          >
            {saving ? 'Saving...' : 'Save Profile Details'}
          </Button>
        </div>
      </form>
    </div>
  );
}
