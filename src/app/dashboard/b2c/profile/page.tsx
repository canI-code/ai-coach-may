'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { Input, Select } from '@/app/components/ui/Input';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { 
  User, GraduationCap, Target, Lock, Unlock, Clock, Save, Info, Loader2, Check, Camera, Mic, Calendar
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

  // Heatmap States & Fetch Hook
  const [heatmapActivities, setHeatmapActivities] = useState<Record<string, number>>({});
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [hoveredDay, setHoveredDay] = useState<{ date: Date; count: number; x: number; y: number } | null>(null);

  // Delete Account States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpError, setPhoneOtpError] = useState('');
  const [emailOtpError, setEmailOtpError] = useState('');
  const [phoneOtpSuccess, setPhoneOtpSuccess] = useState('');
  const [emailOtpSuccess, setEmailOtpSuccess] = useState('');
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    async function loadActivityData() {
      try {
        const [sessionsRes, examsRes] = await Promise.all([
          fetch('/api/interview/sessions?flat=true', { cache: 'no-store' }),
          fetch('/api/students/exam/history', { cache: 'no-store' }),
        ]);

        const counts: Record<string, number> = {};

        if (sessionsRes.ok) {
          const sData = await sessionsRes.json();
          const sessionsList = sData.sessions || [];
          sessionsList.forEach((s: any) => {
            if (s.status === 'completed' && s.createdAt) {
              const dateStr = s.createdAt.slice(0, 10);
              counts[dateStr] = (counts[dateStr] || 0) + 1;
            }
          });
        }

        if (examsRes.ok) {
          const eData = await examsRes.json();
          const attemptsList = eData.attempts || [];
          attemptsList.forEach((s: any) => {
            s.attempts.forEach((a: any) => {
              if (a.date) {
                const dateStr = a.date.slice(0, 10);
                counts[dateStr] = (counts[dateStr] || 0) + 1;
              }
            });
          });
        }

        setHeatmapActivities(counts);
      } catch (err) {
        console.error('Error fetching heatmap activity data:', err);
      }
    }
    loadActivityData();
  }, []);

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const startDate = new Date(selectedYear, 0, 1);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    for (let i = 0; i < 371; i++) {
      days.push(new Date(startDate));
      startDate.setDate(startDate.getDate() + 1);
    }
    return days;
  }, [selectedYear]);

  const monthLabels = useMemo(() => {
    const labels: { text: string; colIndex: number }[] = [];
    let lastMonth = -1;
    for (let col = 0; col < 53; col++) {
      const firstDayOfWeek = calendarDays[col * 7];
      if (firstDayOfWeek) {
        const month = firstDayOfWeek.getMonth();
        if (month !== lastMonth) {
          labels.push({
            text: firstDayOfWeek.toLocaleString('default', { month: 'short' }),
            colIndex: col,
          });
          lastMonth = month;
        }
      }
    }
    return labels;
  }, [calendarDays]);

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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (phoneCountdown > 0) {
      interval = setInterval(() => {
        setPhoneCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phoneCountdown]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (emailCountdown > 0) {
      interval = setInterval(() => {
        setEmailCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emailCountdown]);

  const sendPhoneOtp = async () => {
    setPhoneOtpError('');
    setPhoneOtpSuccess('');
    if (!account?.phone) {
      setPhoneOtpError('No registered phone number found.');
      return;
    }
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: account.phone, role: 'student' }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneOtpSent(true);
        setPhoneOtpSuccess(data.message || 'OTP sent successfully!');
        setPhoneCountdown(60);
      } else {
        setPhoneOtpError(data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setPhoneOtpError('Failed to send OTP.');
    }
  };

  const sendEmailOtp = async () => {
    setEmailOtpError('');
    setEmailOtpSuccess('');
    const emailAddr = account?.email || profile?.email;
    if (!emailAddr) {
      setEmailOtpError('No registered email address found.');
      return;
    }
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: emailAddr, role: 'student' }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailOtpSent(true);
        setEmailOtpSuccess(data.message || 'OTP sent successfully!');
        setEmailCountdown(60);
      } else {
        setEmailOtpError(data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setEmailOtpError('Failed to send OTP.');
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    setDeleting(true);

    if (!phoneOtp || !emailOtp) {
      setDeleteError('Both phone and email OTPs are required.');
      setDeleting(false);
      return;
    }

    try {
      const res = await fetch('/api/students/profile/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneOtp, emailOtp }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/login?deleted=true');
      } else {
        setDeleteError(data.error || 'Failed to request account deletion.');
      }
    } catch (err) {
      setDeleteError('An error occurred. Please try again.');
    } finally {
      setDeleting(false);
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

          {/* Hardware & Device Settings Card */}
          <GlassCard className="relative overflow-hidden border-white/5 shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/5 text-white">
                <Camera size={20} />
              </div>
              <div>
                <CardTitle className="text-xl">Hardware Devices</CardTitle>
                <CardDescription className="text-xs">
                  Configure your preferred webcam and microphone.
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

              <div className="grid grid-cols-1 gap-4">
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
                  className="bg-amber-500 text-black hover:bg-amber-600 font-bold w-full"
                >
                  Save Devices
                </Button>
              </div>
            </form>
          </GlassCard>

          {/* Danger Zone: Delete Account */}
          <GlassCard className="border-red-500/15 shadow-lg bg-red-500/[0.01]">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                <Unlock size={16} />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base mb-1 text-red-400 flex items-center gap-1.5 font-bold">
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-xs text-[#a1a1aa] leading-relaxed mb-3">
                  Temporarily disable and schedule your account for deletion. All data will be permanently wiped after 30 days. You can cancel this request by logging back in.
                </CardDescription>
                <Button 
                  onClick={() => setShowDeleteModal(true)} 
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold text-xs w-full py-2 rounded-xl flex items-center justify-center gap-1"
                >
                  Delete Account
                </Button>
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

          {/* Developer Activity Heatmap Card */}
          <GlassCard className="relative overflow-hidden border-white/5 shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/5 text-white">
                <Calendar size={20} />
              </div>
              <div>
                <CardTitle className="text-xl">Developer Activity Heatmap</CardTitle>
                <CardDescription className="text-xs">
                  Your daily practice velocity across mock interviews and practice exams.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-start relative">
              
              {/* Tooltip */}
              {hoveredDay && (
                <div
                  className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-[#161827] border border-amber-500/30 text-white rounded-lg px-2.5 py-1.5 text-xs shadow-xl flex flex-col items-center gap-0.5"
                  style={{
                    left: `${hoveredDay.x}px`,
                    top: `${hoveredDay.y}px`,
                  }}
                >
                  <span className="font-semibold text-white">
                    {hoveredDay.count} {hoveredDay.count === 1 ? 'activity' : 'activities'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {hoveredDay.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}

              {/* Grid SVG Container */}
              <div className="flex-1 overflow-x-auto w-full pb-2">
                <svg viewBox="0 0 780 130" className="min-w-[700px] overflow-visible select-none">
                  {/* Month Labels */}
                  {monthLabels.map((lbl, idx) => (
                    <text
                      key={`month-label-${idx}`}
                      x={30 + lbl.colIndex * 14}
                      y={12}
                      fontSize={10}
                      fill="#a1a1aa"
                      fillOpacity={0.7}
                    >
                      {lbl.text}
                    </text>
                  ))}

                  {/* Day Labels (Mon, Wed, Fri) */}
                  <text x={0} y={42} fontSize={9} fill="#a1a1aa" fillOpacity={0.6} dominantBaseline="middle">Mon</text>
                  <text x={0} y={70} fontSize={9} fill="#a1a1aa" fillOpacity={0.6} dominantBaseline="middle">Wed</text>
                  <text x={0} y={98} fontSize={9} fill="#a1a1aa" fillOpacity={0.6} dominantBaseline="middle">Fri</text>

                  {/* Heatmap Squares */}
                  {Array.from({ length: 53 }).map((_, col) => (
                    <g key={`col-${col}`}>
                      {Array.from({ length: 7 }).map((_, row) => {
                        const idx = col * 7 + row;
                        const date = calendarDays[idx];
                        if (!date || date.getFullYear() !== selectedYear) {
                          return null;
                        }
                        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        const count = heatmapActivities[dateKey] || 0;

                        // Determine shade
                        let fill = 'rgba(255, 255, 255, 0.04)';
                        let stroke = 'rgba(255, 255, 255, 0.02)';
                        if (count > 0) {
                          if (count === 1) {
                            fill = 'rgba(245, 158, 11, 0.15)';
                            stroke = 'rgba(245, 158, 11, 0.2)';
                          } else if (count === 2) {
                            fill = 'rgba(245, 158, 11, 0.35)';
                            stroke = 'rgba(245, 158, 11, 0.4)';
                          } else if (count === 3) {
                            fill = 'rgba(245, 158, 11, 0.65)';
                            stroke = 'rgba(245, 158, 11, 0.7)';
                          } else {
                            fill = 'rgba(245, 158, 11, 0.95)';
                            stroke = 'rgba(245, 158, 11, 1)';
                          }
                        }

                        return (
                          <rect
                            key={`cell-${col}-${row}`}
                            x={30 + col * 14}
                            y={22 + row * 14}
                            width={11}
                            height={11}
                            rx={2}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={1}
                            className="transition-colors duration-150 cursor-pointer"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const container = e.currentTarget.ownerSVGElement?.parentElement;
                              const containerRect = container?.getBoundingClientRect();
                              if (rect && containerRect) {
                                setHoveredDay({
                                  date,
                                  count,
                                  x: rect.left - containerRect.left + rect.width / 2,
                                  y: rect.top - containerRect.top - 8,
                                });
                              }
                            }}
                            onMouseLeave={() => setHoveredDay(null)}
                          />
                        );
                      })}
                    </g>
                  ))}
                </svg>
              </div>

              {/* Year Selector */}
              <div className="flex md:flex-col gap-2 shrink-0 p-1 rounded-xl bg-white/5 border border-white/5 md:sticky md:top-0 w-full md:w-auto">
                {[2026, 2025, 2024, 2023].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                      selectedYear === yr
                        ? 'bg-amber-500 text-black font-bold'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>

            </div>
          </GlassCard>

        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md border-red-500/20 shadow-2xl relative" padding="lg">
            <button 
              onClick={() => {
                setShowDeleteModal(false);
                setPhoneOtp('');
                setEmailOtp('');
                setPhoneOtpSent(false);
                setEmailOtpSent(false);
                setPhoneOtpError('');
                setEmailOtpError('');
                setPhoneOtpSuccess('');
                setEmailOtpSuccess('');
                setDeleteError('');
              }}
              className="absolute top-4 right-4 text-white/50 hover:text-white font-bold text-sm cursor-pointer"
            >
              ✕
            </button>

            <div className="mb-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mb-3">
                <Lock size={22} />
              </div>
              <CardTitle className="text-xl text-white">Delete Account Request</CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1 max-w-sm">
                This will temporarily deactivate your account and schedule it for permanent deletion in 30 days. Log back in within 30 days to cancel this request.
              </CardDescription>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-5">
              {deleteError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {deleteError}
                </div>
              )}

              {/* Phone Verification Section */}
              <div className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-300">Phone Verification</label>
                  <span className="text-[10px] text-zinc-500">{account?.phone ? account.phone.replace(/(\d{2})(\d{5})(\d{5})/, '$1 ***** $3') : ''}</span>
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="4-digit OTP"
                    maxLength={4}
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                    disabled={deleting}
                    className="flex-1 bg-[#161618] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 text-center tracking-widest font-mono"
                  />
                  <button
                    type="button"
                    onClick={sendPhoneOtp}
                    disabled={phoneCountdown > 0 || deleting}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/5 hover:bg-white/10 text-white cursor-pointer transition-all disabled:opacity-50"
                  >
                    {phoneCountdown > 0 ? `Resend (${phoneCountdown}s)` : phoneOtpSent ? 'Resend' : 'Send OTP'}
                  </button>
                </div>

                {phoneOtpError && <p className="text-[10px] text-red-400 mt-1">{phoneOtpError}</p>}
                {phoneOtpSuccess && <p className="text-[10px] text-emerald-400 mt-1">{phoneOtpSuccess}</p>}
              </div>

              {/* Email Verification Section */}
              <div className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-300">Email Verification</label>
                  <span className="text-[10px] text-zinc-500 truncate max-w-[180px]">{account?.email || profile?.email || ''}</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="4-digit OTP"
                    maxLength={4}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                    disabled={deleting}
                    className="flex-1 bg-[#161618] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 text-center tracking-widest font-mono"
                  />
                  <button
                    type="button"
                    onClick={sendEmailOtp}
                    disabled={emailCountdown > 0 || deleting}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/5 hover:bg-white/10 text-white cursor-pointer transition-all disabled:opacity-50"
                  >
                    {emailCountdown > 0 ? `Resend (${emailCountdown}s)` : emailOtpSent ? 'Resend' : 'Send OTP'}
                  </button>
                </div>

                {emailOtpError && <p className="text-[10px] text-red-400 mt-1">{emailOtpError}</p>}
                {emailOtpSuccess && <p className="text-[10px] text-emerald-400 mt-1">{emailOtpSuccess}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  disabled={deleting}
                  onClick={() => {
                    setShowDeleteModal(false);
                    setPhoneOtp('');
                    setEmailOtp('');
                    setPhoneOtpSent(false);
                    setEmailOtpSent(false);
                    setPhoneOtpError('');
                    setEmailOtpError('');
                    setPhoneOtpSuccess('');
                    setEmailOtpSuccess('');
                    setDeleteError('');
                  }}
                  className="text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  disabled={!phoneOtp || !emailOtp || deleting}
                  className="bg-red-500 text-white hover:bg-red-600 font-bold text-xs"
                >
                  {deleting ? 'Deleting...' : 'Confirm Deletion'}
                </Button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </main>
  );
}
