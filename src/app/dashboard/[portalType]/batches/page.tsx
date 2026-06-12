'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GlassCard, CardTitle, Button, Input } from '@/app/components/ui';
import { BookOpen, Users, Loader2, Award, Activity, CheckCircle2, User, KeyRound, Check } from 'lucide-react';

export default function StudentBatches() {
  const params = useParams<{ portalType: string }>();
  const router = useRouter();
  const portalType = params?.portalType || 'b2c';

  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Join Batch State
  const [inviteCode, setInviteCode] = useState('');
  const [password, setPassword] = useState('');
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    if (portalType !== 'b2b') {
      router.push('/dashboard');
      return;
    }
    try {
      const batchesRes = await fetch('/api/b2b/mentee/batches');
      const profileRes = await fetch('/api/students/dashboard');
      
      if (batchesRes.ok) setBatches(await batchesRes.json());
      if (profileRes.ok) {
        const data = await profileRes.json();
        setUserProfile(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [portalType]);

  const handleJoinBatch = async () => {
    if (!inviteCode || !password) {
      setError('Please provide invite code and account password');
      return;
    }
    setError('');
    setMessage('');
    setJoining(true);

    try {
      const res = await fetch('/api/b2b/mentee/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inviteCode.toUpperCase().trim(),
          password: password,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Successfully joined the batch!');
        setInviteCode('');
        setPassword('');
        fetchData();
      } else {
        setError(data.error || 'Failed to join batch');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">My Batches</h1>
        <p className="text-sm text-[#a1a1aa] mt-1">View batches you belong to, see mentor details, and track your metrics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batches List */}
        <div className="lg:col-span-2 space-y-4">
          {batches.length === 0 ? (
            <GlassCard className="p-8 text-center text-[#a1a1aa]">You have not joined any batches yet.</GlassCard>
          ) : (
            batches.map((batch) => {
              const personal = batch.personalStats || { ciScore: null, examScore: null, totalInterviews: 0, totalExams: 0 };
              const health = batch.overallHealth !== null ? batch.overallHealth : 'N/A';
              const healthVal = typeof health === 'number' ? health : 0;
              const healthColor = healthVal >= 70 ? 'text-teal-400' : healthVal >= 40 ? 'text-amber-400' : 'text-rose-400';
              const healthBg = healthVal >= 70 ? 'bg-teal-500/20' : healthVal >= 40 ? 'bg-amber-500/20' : 'bg-rose-500/20';

              return (
                <GlassCard key={batch._id} className={`p-6 border-white/5 relative ${batch.isActive ? 'ring-1 ring-teal-500/30' : ''}`}>
                  {batch.isActive && (
                    <span className="absolute top-4 right-4 bg-teal-500/10 text-teal-400 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 border border-teal-500/20">
                      <Check className="w-3 h-3" /> Active Batch
                    </span>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-teal-500/10 shrink-0">
                      <BookOpen className="w-6 h-6 text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white truncate">{batch.name}</h3>
                      <p className="text-sm text-[#a1a1aa]">
                        {batch.department || 'N/A'} · Year {batch.year || 'N/A'}
                      </p>

                      {/* Mentor Info */}
                      <div className="mt-4 flex items-center gap-2 text-xs bg-white/5 px-3 py-2 rounded-lg w-fit">
                        <User className="w-3.5 h-3.5 text-teal-400" />
                        <span className="text-[#a1a1aa]">Mentor:</span>
                        <span className="text-white font-medium">{batch.mentorName}</span>
                        <span className="text-[#a1a1aa] ml-2">({batch.mentorEmail})</span>
                      </div>

                      {/* Performance analytics grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        {/* Overall Batch Health */}
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-[#a1a1aa] block mb-1">Batch Cumulative Health</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xl font-extrabold ${healthColor}`}>{health === 'N/A' ? 'N/A' : `${health}%`}</span>
                            </div>
                          </div>
                          <div className={`p-2 rounded-lg ${healthBg} ${healthColor}`}>
                            <Activity className="w-5 h-5" />
                          </div>
                        </div>

                        {/* Personal Growth Stats in this Batch */}
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                          <span className="text-xs text-[#a1a1aa] block mb-2">My Performance in Batch</span>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-[#a1a1aa] block text-[10px]">Avg CI Score</span>
                              <span className="text-white font-bold text-sm font-mono">{personal.ciScore !== null ? `${personal.ciScore}%` : 'N/A'}</span>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-[#a1a1aa] block text-[10px]">Avg Exam Score</span>
                              <span className="text-white font-bold text-sm font-mono">{personal.examScore !== null ? `${personal.examScore}%` : 'N/A'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-[10px] text-[#a1a1aa] mt-2 px-1">
                            <span>Interviews: {personal.totalInterviews}</span>
                            <span>Exams: {personal.totalExams}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>

        {/* Join New Batch Action Panel */}
        <div className="space-y-4">
          <GlassCard className="p-6 border-white/5">
            <CardTitle className="text-base text-white mb-4">Join New Batch</CardTitle>
            <p className="text-xs text-[#a1a1aa] mb-6">
              Enter the invite code generated by your mentor for the new batch, and confirm with your password.
            </p>

            {error && <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">{error}</div>}
            {message && <div className="mb-4 p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs">{message}</div>}

            <div className="space-y-4">
              <Input
                label="Invite Code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="XXXX XXXX"
                className="font-mono text-center tracking-[4px]"
              />
              <Input
                label="Confirm Account Password"
                type="password"
                icon={<KeyRound className="w-4 h-4 text-[#a1a1aa]" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
              <Button onClick={handleJoinBatch} fullWidth disabled={joining} className="cursor-pointer mt-2">
                {joining ? 'Joining Batch...' : 'Join Batch'}
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
