'use client';

/**
 * Interview setup page (`/dashboard/b2c/interview`).
 *
 * Configures and starts a mock-interview session (Req 1): the candidate picks a role,
 * interviewer Persona, difficulty, and question count, then POSTs to
 * `/api/interview/start`. On success the orchestrator has created the `seeding` record,
 * seeded the Question_Pool, and served Turn 1; we route into the live session page.
 *
 * Next.js 16 Client Component — owns form state and the start request.
 */

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video,
  Target,
  Clock,
  Gauge,
  UserRound,
  AlertCircle,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { Select } from '@/app/components/ui/Input';
import { INTERESTS_TAXONOMY } from '@/lib/taxonomy';
import { DURATION_OPTIONS } from '@/lib/interview/duration';

// The three valid interviewer styles (Req: Persona).
const PERSONAS = [
  { value: 'general_recruiter', label: 'General Recruiter (balanced, default)' },
  { value: 'tech_lead', label: 'Tech Lead (deep technical probing)' },
  { value: 'stress_interviewer', label: 'Stress Interviewer (high pressure)' },
];

const DIFFICULTIES = [
  { value: '1', label: 'Beginner' },
  { value: '2', label: 'Easy' },
  { value: '3', label: 'Intermediate' },
  { value: '4', label: 'Advanced' },
  { value: '5', label: 'Expert' },
];

// Difficulty bands explored adaptively around the chosen starting difficulty.
const DIFFICULTY_MIN = 1;
const DIFFICULTY_MAX = 5;

export default function InterviewSetupPage() {
  const router = useRouter();

  // Flattened role list from the central taxonomy (e.g. "Computer Science · Algorithms").
  const roleOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const [field, skills] of Object.entries(INTERESTS_TAXONOMY)) {
      for (const skill of skills) {
        opts.push({ value: skill, label: `${field} · ${skill}` });
      }
    }
    return opts;
  }, []);

  const [role, setRole] = useState<string>('');
  const [persona, setPersona] = useState<string>('general_recruiter');
  const [difficulty, setDifficulty] = useState<number>(3);
  const [durationMinutes, setDurationMinutes] = useState<number>(DURATION_OPTIONS[0]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async () => {
    if (!role) {
      setError('Please choose a role to interview for.');
      return;
    }
    setStarting(true);
    setError('');

    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          difficulty,
          durationMinutes,
          aiPersona: persona,
          difficultyMin: DIFFICULTY_MIN,
          difficultyMax: DIFFICULTY_MAX,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to start the interview.');
      }

      // createSession returns the served Turn 1 with the new sessionId.
      router.push(`/dashboard/b2c/interview/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start the interview.');
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
      <AmbientGlow color="teal" size="lg" />

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400">
            <Video size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Mock Interview Setup</h1>
            <p className="text-[#a1a1aa]">
              Configure your adaptive, AI-driven interview session.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <GlassCard padding="lg">
              <CardTitle className="flex items-center gap-2 mb-2">
                <Target size={18} className="text-teal-400" />
                Role
              </CardTitle>
              <CardDescription className="mb-6">
                Which role do you want to be interviewed for?
              </CardDescription>
              <Select
                label="Role"
                placeholder="Select a role…"
                options={roleOptions}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </GlassCard>

            <GlassCard padding="lg">
              <CardTitle className="flex items-center gap-2 mb-2">
                <UserRound size={18} className="text-teal-400" />
                Interviewer Persona
              </CardTitle>
              <CardDescription className="mb-6">
                Sets the tone and style of your interviewer.
              </CardDescription>
              <Select
                label="Persona"
                options={PERSONAS}
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
              />
            </GlassCard>

            <GlassCard padding="lg">
              <CardTitle className="flex items-center gap-2 mb-2">
                <Gauge size={18} className="text-teal-400" />
                Starting Difficulty
              </CardTitle>
              <CardDescription className="mb-6">
                The interview adapts up or down from here as you answer.
              </CardDescription>
              <Select
                label="Difficulty"
                options={DIFFICULTIES}
                value={String(difficulty)}
                onChange={(e) => setDifficulty(parseInt(e.target.value, 10))}
              />
            </GlassCard>

            <GlassCard padding="lg">
              <CardTitle className="flex items-center gap-2 mb-2">
                <Clock size={18} className="text-teal-400" />
                Interview Duration
              </CardTitle>
              <CardDescription className="mb-6">How long do you want to practice?</CardDescription>

              <div className="grid grid-cols-2 gap-3">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDurationMinutes(opt)}
                    className={`px-4 py-4 rounded-xl border text-center transition-all ${
                      durationMinutes === opt
                        ? 'border-teal-400 bg-teal-500/10 text-teal-400'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                    }`}
                  >
                    <div className="text-2xl font-bold">{opt}</div>
                    <div className="text-xs uppercase tracking-wider mt-1">minutes</div>
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>

          <div className="md:col-span-1">
            <GlassCard padding="lg" className="sticky top-8">
              <CardTitle className="mb-6">Session Summary</CardTitle>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Role</span>
                  <span className="font-bold text-white text-right max-w-[60%] truncate">
                    {role || '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Persona</span>
                  <span className="font-bold text-white">
                    {PERSONAS.find((p) => p.value === persona)?.label.split(' (')[0]}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Difficulty</span>
                  <span className="font-bold text-white">
                    {DIFFICULTIES.find((d) => d.value === String(difficulty))?.label}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Duration</span>
                  <span className="font-bold text-white">{durationMinutes} mins</span>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-start gap-2 text-xs text-teal-400/80">
                    <Video size={14} className="shrink-0 mt-0.5" />
                    <span>Webcam and microphone access are required for live coaching.</span>
                  </div>
                </div>
              </div>

              <Button
                fullWidth
                size="lg"
                onClick={handleStart}
                disabled={starting || !role}
                icon={
                  starting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )
                }
              >
                {starting ? 'Preparing…' : 'Start Interview'}
              </Button>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
