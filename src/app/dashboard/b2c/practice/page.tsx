'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { Loader2, BookOpen, Target, Check, AlertCircle, ChevronRight, Hash } from 'lucide-react';
import { INTERESTS_TAXONOMY, MAIN_FIELDS } from '@/lib/taxonomy';
import { Input, Select } from '@/app/components/ui/Input';

export default function PracticeSetup() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [profileInterests, setProfileInterests] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [startingSession, setStartingSession] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/students/dashboard');
        if (!res.ok) throw new Error('Failed to fetch profile data');
        const json = await res.json();
        
        const interests = json.profile?.interests || [];
        setProfileInterests(interests);
        setSelectedInterests(interests); // Select all by default
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, []);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleStartPractice = async () => {
    if (selectedInterests.length === 0) {
      setError('Please select at least one interest to practice.');
      return;
    }

    setStartingSession(true);
    setError('');

    try {
      const res = await fetch('/api/students/exam/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          interests: selectedInterests, 
          questionCount 
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to start practice session');
      }

      // Redirect to the active session
      router.push(`/dashboard/b2c/practice/${data.sessionId}`);

    } catch (err: any) {
      setError(err.message);
      setStartingSession(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-muted font-medium">Loading practice configuration...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
      <AmbientGlow />
      
      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Practice Exam Setup</h1>
            <p className="text-[#a1a1aa]">Configure your personalized practice session.</p>
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
                <Target size={18} className="text-amber-400" />
                Select Topics
              </CardTitle>
              <CardDescription className="mb-6">
                Choose which of your profile interests you want to focus on for this session.
              </CardDescription>
              
              <div className="flex flex-wrap gap-3">
                {profileInterests.map(interest => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2
                      ${selectedInterests.includes(interest)
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                        : 'bg-white/5 border-white/10 text-[#a1a1aa] hover:border-white/20 hover:text-white'
                      }
                    `}
                  >
                    {interest}
                    {selectedInterests.includes(interest) && <Check size={16} />}
                  </button>
                ))}
              </div>
            </GlassCard>

            <GlassCard padding="lg">
              <CardTitle className="flex items-center gap-2 mb-2">
                <Hash size={18} className="text-amber-400" />
                Number of Questions
              </CardTitle>
              <CardDescription className="mb-6">
                How long do you want to practice?
              </CardDescription>

              <div className="px-4 py-8 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center">
                <div className="text-4xl font-bold text-amber-400 mb-2">{questionCount}</div>
                <div className="text-sm text-[#a1a1aa] uppercase tracking-wider mb-8">Questions</div>
                
                <div className="w-full flex items-center gap-4">
                  <span className="text-sm font-medium text-white/50">10</span>
                  <input 
                    type="range" 
                    min="10" 
                    max="30" 
                    step="1"
                    value={questionCount} 
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    style={{ accentColor: '#f59e0b' }}
                  />
                  <span className="text-sm font-medium text-white/50">30</span>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="md:col-span-1">
            <GlassCard padding="lg" className="sticky top-8">
              <CardTitle className="mb-6">Session Summary</CardTitle>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Selected Topics</span>
                  <span className="font-bold text-white">{selectedInterests.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Total Questions</span>
                  <span className="font-bold text-white">{questionCount}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Est. Duration</span>
                  <span className="font-bold text-white">~{Math.ceil(questionCount * 1.5)} mins</span>
                </div>
                
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-start gap-2 text-xs text-amber-400/80">
                    <Target size={14} className="shrink-0 mt-0.5" />
                    <span>This session will adapt to your skill level.</span>
                  </div>
                </div>
              </div>

              <Button 
                fullWidth 
                size="lg" 
                onClick={handleStartPractice}
                disabled={startingSession || selectedInterests.length === 0}
                icon={startingSession ? <Loader2 className="animate-spin" size={18} /> : <ChevronRight size={18} />}
              >
                {startingSession ? 'Generating...' : 'Start Session'}
              </Button>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
