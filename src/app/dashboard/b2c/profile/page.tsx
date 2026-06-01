'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { Input, Select } from '@/app/components/ui/Input';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { 
  User, GraduationCap, Target, Lock, Unlock, Clock, Save, Info, Loader2, Check, Camera, Mic 
} from 'lucide-react';
import { INTERESTS_TAXONOMY, MAIN_FIELDS } from '@/lib/taxonomy';

const EDUCATION_LOCK_MS = 78 * 60 * 60 * 1000; // 78 hours
const INTERESTS_LOCK_MS = 48 * 60 * 60 * 1000; // 48 hours

export default function ProfilePage() {
  const router = useRouter();
  
  // Loading & State
  const [loading, setLoading] = useState(true);
  const [savingEdu, setSavingEdu] = useState(false);
  const [savingInt, setSavingInt] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Device Selection States
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamId, setSelectedCamId] = useState('');
  const [selectedMicId, setSelectedMicId] = useState('');
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceSuccess, setDeviceSuccess] = useState('');

  // Device Selection Effect
  useEffect(() => {
    async function loadDevices() {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
          await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => {});
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === 'videoinput');
          const mics = devices.filter((d) => d.kind === 'audioinput');
          setVideoDevices(cams);
          setAudioDevices(mics);

          const cachedCam = localStorage.getItem('preferred_webcam_id') || cams[0]?.deviceId || '';
          const cachedMic = localStorage.getItem('preferred_mic_id') || mics[0]?.deviceId || '';
          setSelectedCamId(cachedCam);
          setSelectedMicId(cachedMic);
        }
      } catch (err: any) {
        console.error('Error loading devices in profile:', err);
        setDeviceError('Could not access media devices. Check permissions.');
      }
    }
    loadDevices();
  }, []);

  const handleSaveDevices = (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceError(null);
    setDeviceSuccess('');
    try {
      if (selectedCamId) localStorage.setItem('preferred_webcam_id', selectedCamId);
      if (selectedMicId) localStorage.setItem('preferred_mic_id', selectedMicId);
      setDeviceSuccess('Hardware device configurations saved successfully!');
      setTimeout(() => setDeviceSuccess(''), 4000);
    } catch (err: any) {
      setDeviceError('Failed to save device configurations.');
    }
  };

  // Profile data from backend
  const [profile, setProfile] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);

  // Form states
  const [degree, setDegree] = useState('');
  const [course, setCourse] = useState('');
  const [currentMarks, setCurrentMarks] = useState('');
  
  const [mainField, setMainField] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Countdowns
  const [eduCountdown, setEduCountdown] = useState('');
  const [intCountdown, setIntCountdown] = useState('');
  const [isEduLocked, setIsEduLocked] = useState(false);
  const [isIntLocked, setIsIntLocked] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/students/profile');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch profile details');
      }
      const data = await res.json();
      
      setProfile(data.profile);
      setAccount(data.user);

      // Populate Form Fields
      if (data.profile?.education) {
        setDegree(data.profile.education.degree || '');
        setCourse(data.profile.education.course || '');
        setCurrentMarks(data.profile.education.currentMarks || '');
      }

      if (data.profile?.mainField) {
        setMainField(data.profile.mainField || '');
        setSelectedInterests(data.profile.interests || []);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Countdown timer logic
  useEffect(() => {
    if (!profile) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // 1. Education Lock Calculation
      if (profile.lastEducationEditAt && profile.education) {
        const lastEdit = new Date(profile.lastEducationEditAt).getTime();
        const expiry = lastEdit + EDUCATION_LOCK_MS;
        if (now < expiry) {
          setIsEduLocked(true);
          const diff = expiry - now;
          const hrs = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          setEduCountdown(`${hrs}h ${mins}m ${secs}s`);
        } else {
          setIsEduLocked(false);
          setEduCountdown('');
        }
      } else {
        setIsEduLocked(false);
        setEduCountdown('');
      }

      // 2. Interests Lock Calculation
      if (profile.lastInterestsEditAt && profile.interests && profile.interests.length >= 3) {
        const lastEdit = new Date(profile.lastInterestsEditAt).getTime();
        const expiry = lastEdit + INTERESTS_LOCK_MS;
        if (now < expiry) {
          setIsIntLocked(true);
          const diff = expiry - now;
          const hrs = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          setIntCountdown(`${hrs}h ${mins}m ${secs}s`);
        } else {
          setIsIntLocked(false);
          setIntCountdown('');
        }
      } else {
        setIsIntLocked(false);
        setIntCountdown('');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [profile]);

  const handleSaveEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSavingEdu(true);

    if (!degree || !course || !currentMarks) {
      setError('Please fill in all education details');
      setSavingEdu(false);
      return;
    }

    try {
      const res = await fetch('/api/students/profile/education', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ degree, course, currentMarks })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update education details');
      }

      setProfile(data.profile);
      setSuccessMsg('Academic details successfully updated and locked for 78 hours!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingEdu(false);
    }
  };

  const handleSaveInterests = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSavingInt(true);

    if (!mainField) {
      setError('Please select your main field of study');
      setSavingInt(false);
      return;
    }

    if (selectedInterests.length < 3) {
      setError('Please select at least 3 interests');
      setSavingInt(false);
      return;
    }

    try {
      const res = await fetch('/api/students/profile/interests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainField, interests: selectedInterests })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update interests');
      }

      setProfile(data.profile);
      setSuccessMsg('Study interests successfully updated and locked for 48 hours!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingInt(false);
    }
  };

  const toggleInterest = (interest: string) => {
    if (isIntLocked) return;
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-muted font-medium">Loading your profile workspace...</p>
      </div>
    );
  }

  return (
    <main className="flex-1 min-w-0 p-8 pb-12 relative overflow-y-auto max-w-6xl mx-auto space-y-6">
      <AmbientGlow />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <div className="text-sm text-amber-500 font-semibold uppercase tracking-wider mb-1">User Space</div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            My Profile <User className="text-amber-400" size={24} />
          </h1>
          <p className="text-sm text-[#a1a1aa] mt-1">
            Manage your personal profile, credentials, and curriculum path here.
          </p>
        </div>
      </div>

      {/* Toast notifications */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl text-sm max-w-4xl flex items-center gap-2.5 shadow-[0_4px_20px_rgba(239,68,68,0.05)]">
          <Info size={16} />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-2xl text-sm max-w-4xl flex items-center gap-2.5 shadow-[0_4px_20px_rgba(16,185,129,0.05)] animate-pulse">
          <Check size={16} />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Account Details & Policies */}
        <div className="space-y-6 lg:col-span-1">
          {/* Account overview Card */}
          <GlassCard className="relative overflow-hidden border-white/5 shadow-xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-gradient-amber text-black flex items-center justify-center font-bold text-xl mb-4 shadow-lg shadow-amber-500/10">
                {profile?.fullName?.substring(0, 2).toUpperCase() || 'ST'}
              </div>
              <h2 className="text-xl font-bold text-white mb-0.5">{profile?.fullName || 'Student'}</h2>
              <span className="text-xs text-amber-400 bg-amber-400/15 border border-amber-400/20 px-2.5 py-0.5 rounded-full font-medium tracking-wide">
                @{profile?.username || 'user'}
              </span>
            </div>

            <div className="border-t border-white/5 pt-4 mt-2 space-y-4 text-sm">
              <div className="flex justify-between items-center px-1">
                <span className="text-[#a1a1aa] text-xs">Date of Birth</span>
                <span className="text-white font-medium">{profile?.dob ? new Date(profile.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[#a1a1aa] text-xs">Registered Phone</span>
                <span className="text-white font-medium">{account?.phone || 'Not linked'}</span>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[#a1a1aa] text-xs">Email Address</span>
                <span className="text-white font-medium truncate max-w-[150px]">{account?.email || 'Not provided'}</span>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[#a1a1aa] text-xs">Account Tier</span>
                <span className="text-emerald-400 font-semibold uppercase text-xs tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {account?.accountType || 'B2C Standard'}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* System Policy Card */}
          <GlassCard className="border-amber-500/10 shadow-lg bg-amber-500/[0.01]">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Info size={16} />
              </div>
              <div>
                <CardTitle className="text-base mb-1 text-amber-400 flex items-center gap-1.5 font-bold">
                  Anti-Abuse Policy
                </CardTitle>
                <CardDescription className="text-xs text-[#a1a1aa] leading-relaxed">
                  To prevent gaming the adaptive interview engine and ELO assessments, profile parameters are restricted:
                </CardDescription>
                <ul className="mt-3.5 space-y-2.5 text-xs text-[#a1a1aa]">
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                    <span>
                      <strong className="text-white">Academic Details:</strong> Locked for <strong className="text-amber-400">78 hours</strong> after each edit.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                    <span>
                      <strong className="text-white">Study Interests:</strong> Locked for <strong className="text-amber-400">48 hours</strong> after each edit.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Columns: Educational Details & Interests Form */}
        <div className="lg:col-span-2 space-y-6">

          {/* Academic Profile Form */}
          <GlassCard className={`relative overflow-hidden border-white/5 shadow-xl transition-all duration-300 ${isEduLocked ? 'bg-[#121215]/40 border-amber-500/10' : ''}`}>
            {isEduLocked && (
              <div className="absolute top-4 right-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-black/10 z-20">
                <Lock size={12} />
                <span>Locked · {eduCountdown}</span>
              </div>
            )}
            
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isEduLocked ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-white'}`}>
                <GraduationCap size={20} />
              </div>
              <div>
                <CardTitle className="text-xl">Academic Background</CardTitle>
                <CardDescription className="text-xs">
                  Provide your educational credentials. Determines baseline assessment contexts.
                </CardDescription>
              </div>
            </div>

            <form onSubmit={handleSaveEducation} className="space-y-4 relative">
              {isEduLocked && (
                <div className="absolute inset-0 bg-[#0a0a0b]/15 backdrop-blur-[1px] rounded-2xl z-10 pointer-events-auto cursor-not-allowed" />
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Degree Path"
                  placeholder="Choose degree type"
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  options={[
                    { value: 'B.Tech', label: 'Bachelor of Technology' },
                    { value: 'M.Tech', label: 'Master of Technology' },
                    { value: 'BCA', label: 'Bachelor of Computer Applications' },
                    { value: 'MCA', label: 'Master of Computer Applications' },
                    { value: 'B.Sc', label: 'Bachelor of Science' },
                    { value: 'M.Sc', label: 'Master of Science' },
                    { value: 'Other', label: 'Other Degree' }
                  ]}
                  disabled={isEduLocked || savingEdu}
                />
                
                <Input
                  label="Current Course / Major"
                  placeholder="e.g. Computer Science"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  disabled={isEduLocked || savingEdu}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <Input
                  label="Current Score (CGPA or %)"
                  placeholder="e.g. 8.4 or 84%"
                  value={currentMarks}
                  onChange={(e) => setCurrentMarks(e.target.value)}
                  disabled={isEduLocked || savingEdu}
                />
                
                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    disabled={isEduLocked || savingEdu}
                    icon={savingEdu ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    className="w-full md:w-auto min-w-[140px] bg-amber-500 text-black hover:bg-amber-600 font-bold"
                  >
                    {savingEdu ? 'Saving...' : 'Save Academic'}
                  </Button>
                </div>
              </div>
            </form>
          </GlassCard>

          {/* Curriculum Interests Profile Form */}
          <GlassCard className={`relative overflow-hidden border-white/5 shadow-xl transition-all duration-300 ${isIntLocked ? 'bg-[#121215]/40 border-amber-500/10' : ''}`}>
            {isIntLocked && (
              <div className="absolute top-4 right-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-black/10 z-20">
                <Lock size={12} />
                <span>Locked · {intCountdown}</span>
              </div>
            )}
            
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isIntLocked ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-white'}`}>
                <Target size={20} />
              </div>
              <div>
                <CardTitle className="text-xl">Practice & Interests Domain</CardTitle>
                <CardDescription className="text-xs">
                  Your primary subject field and direct learning interests (Min 3 selection required).
                </CardDescription>
              </div>
            </div>

            <form onSubmit={handleSaveInterests} className="space-y-5 relative">
              {isIntLocked && (
                <div className="absolute inset-0 bg-[#0a0a0b]/15 backdrop-blur-[1px] rounded-2xl z-10 pointer-events-auto cursor-not-allowed" />
              )}
              
              <div className="w-full md:w-1/2">
                <Select
                  label="Primary Field of Study"
                  placeholder="Select primary field"
                  value={mainField}
                  onChange={(e) => {
                    setMainField(e.target.value);
                    setSelectedInterests([]);
                  }}
                  options={MAIN_FIELDS.map(field => ({ value: field, label: field }))}
                  disabled={isIntLocked || savingInt}
                />
              </div>

              {mainField && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted">
                    Curriculum Subjects (Select at least 3)
                  </label>
                  <div className="flex flex-wrap gap-2.5 p-5 rounded-2xl bg-white/5 border border-white/5 max-h-[220px] overflow-y-auto">
                    {(INTERESTS_TAXONOMY[mainField] || []).map(interest => {
                      const selected = selectedInterests.includes(interest);
                      return (
                        <span
                          key={interest}
                          onClick={() => toggleInterest(interest)}
                          className={`
                            px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 select-none
                            ${selected
                              ? 'bg-amber-400/10 border-amber-400/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.08)]'
                              : isIntLocked
                                ? 'bg-white/[0.02] border-white/5 text-[#a1a1aa]/40 cursor-not-allowed'
                                : 'bg-white/5 border-white/5 text-[#a1a1aa] hover:border-white/20 hover:bg-white/10 hover:text-white'
                            }
                          `}
                        >
                          {interest}
                          {selected && <Check size={12} />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-[#a1a1aa] italic">
                  {selectedInterests.length} selected (minimum 3 required)
                </span>
                <Button 
                  type="submit" 
                  disabled={isIntLocked || savingInt}
                  icon={savingInt ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  className="bg-amber-500 text-black hover:bg-amber-600 font-bold min-w-[140px]"
                >
                  {savingInt ? 'Saving...' : 'Save Interests'}
                </Button>
              </div>
            </form>
          </GlassCard>

          {/* Hardware & Device Settings Card */}
          <GlassCard className="relative overflow-hidden border-white/5 shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/5 text-white">
                <Camera size={20} />
              </div>
              <div>
                <CardTitle className="text-xl">Hardware & Devices Settings</CardTitle>
                <CardDescription className="text-xs">
                  Configure your preferred webcam and microphone for live mock interview sessions.
                </CardDescription>
              </div>
            </div>

            <form onSubmit={handleSaveDevices} className="space-y-5 relative">
              {deviceError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {deviceError}
                </div>
              )}
              {deviceSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  {deviceSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Preferred Camera</label>
                  <select
                    value={selectedCamId}
                    onChange={(e) => setSelectedCamId(e.target.value)}
                    className="w-full bg-[#161618] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {videoDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                    {videoDevices.length === 0 && (
                      <option value="">No Camera Detected</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Preferred Microphone</label>
                  <select
                    value={selectedMicId}
                    onChange={(e) => setSelectedMicId(e.target.value)}
                    className="w-full bg-[#161618] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {audioDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                    {audioDevices.length === 0 && (
                      <option value="">No Microphone Detected</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  type="submit" 
                  icon={<Save size={16} />}
                  className="bg-amber-500 text-black hover:bg-amber-600 font-bold min-w-[140px]"
                >
                  Save Devices
                </Button>
              </div>
            </form>
          </GlassCard>

        </div>
      </div>
    </main>
  );
}
