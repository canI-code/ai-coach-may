'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { 
  Loader2, ChevronRight, Clock, Target, CheckCircle2, 
  AlertCircle, ArrowRight, Trophy, Zap
} from 'lucide-react';

export default function InitialAssessment() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(true);
  const [error, setError] = useState('');
  const [userInterests, setUserInterests] = useState<string[]>([]);
  
  const [assessmentId, setAssessmentId] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentStep] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  
  // Timer state
  const [totalTime, setTotalTime] = useState(0); // Cumulative stopwatch
  const [startTime, setStartedTime] = useState<number>(Date.now()); // Per-question start
  
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    const fetchProfileInterests = async () => {
      try {
        const res = await fetch('/api/students/dashboard');
        const json = await res.json();
        if (json.profile?.interests) {
          setUserInterests(json.profile.interests);
        }
      } catch (e) {
        console.error('Failed to fetch interests for loader');
      }
    };
    
    fetchProfileInterests();

    const prepareAssessment = async () => {
      try {
        const res = await fetch('/api/students/assessment/prepare', { method: 'POST' });
        if (!res.ok) {
          const err = await res.json();
          // Fix: Use err.message for the professional error message
          throw new Error(err.message || err.error || 'Failed to prepare assessment');
        }
        const data = await res.json();
        setAssessmentId(data.assessmentId);
        setQuestions(data.questions);
        setStartedTime(Date.now());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setPreparing(false);
        setLoading(false);
      }
    };

    prepareAssessment();
  }, []);

  // Total Timer interval (Persistent Stopwatch)
  useEffect(() => {
    if (preparing || finished || submitting) return;

    const timer = setInterval(() => {
      setTotalTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [preparing, finished, submitting]);

  const handleNext = async (skipped = false) => {
    if (!skipped && !selectedChoiceId) return;

    setSubmitting(true);
    const questionId = questions[currentIndex]._id;
    const duration = Math.floor((Date.now() - startTime) / 1000);

    try {
      // Submit answer (send a special flag or null choice if skipped)
      await fetch('/api/students/assessment/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId,
          questionId,
          chosenChoiceId: skipped ? 'skipped' : selectedChoiceId,
          timeSpentSeconds: duration
        })
      });

      if (currentIndex < questions.length - 1) {
        // Reset for next question
        setCurrentStep(currentIndex + 1);
        setSelectedChoiceId(null);
        setStartedTime(Date.now());
      } else {
        // Complete assessment
        const res = await fetch('/api/students/assessment/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assessmentId })
        });
        const data = await res.json();
        setResults(data);
        setFinished(true);
      }
    } catch (err: any) {
      setError('Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    const isIncompleteError = error.includes('try again after some time');
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <GlassCard className="max-w-md text-center border-red-500/20" padding="lg">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <CardTitle className="text-xl mb-2">
            {isIncompleteError ? 'Assessment Unavailable' : 'Something went wrong'}
          </CardTitle>
          <CardDescription className="mb-6">
            {error}
          </CardDescription>
          <Button fullWidth onClick={() => router.push('/dashboard/b2c')}>
            Return to Dashboard
          </Button>
        </GlassCard>
      </div>
    );
  }

  if (loading || preparing || (questions.length === 0 && !finished)) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <div className="text-center max-w-md">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-amber-500">
              <Zap size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-4">
            {questions.length === 0 && !preparing ? 'Assessment Unavailable' : 'Generating Your Assessment'}
          </h2>
          <p className="text-[#a1a1aa] mb-2">
            {questions.length === 0 && !preparing 
              ? 'There was an issue preparing your assessment. Please try again after some time.' 
              : 'Our AI is hand-picking questions based on your interests:'}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {userInterests.length > 0 ? userInterests.map(interest => (
              <span key={interest} className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-semibold animate-pulse">
                {interest}
              </span>
            )) : (
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs animate-pulse">Analyzing profile...</span>
            )}
          </div>
          {questions.length === 0 && !preparing && (
            <Button className="mt-6" onClick={() => router.push('/dashboard/b2c')}>Return to Dashboard</Button>
          )}
        </div>
      </div>
    );
  }

  if (finished) {
    const { levelDetermined, scorePercentage } = results;
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-4 overflow-y-auto">
        <AmbientGlow />
        <div className="w-full max-w-2xl py-12">
          <GlassCard className="text-center border-amber-400/20 overflow-hidden relative" padding="lg">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-teal-500 to-amber-500" />
            
            <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto mb-6">
              <Trophy size={40} />
            </div>
            
            <h1 className="text-4xl font-bold mb-2">Assessment Complete!</h1>
            <p className="text-[#a1a1aa] mb-12">We've calculated your initial proficiency levels.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
                <div className="text-[#a1a1aa] text-sm uppercase tracking-wider mb-2">Overall Score</div>
                <div className="text-4xl font-bold text-amber-500">{Math.round(scorePercentage)}%</div>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
                <div className="text-[#a1a1aa] text-sm uppercase tracking-wider mb-2">Determined Level</div>
                <div className="text-4xl font-bold text-teal-400">{levelDetermined}</div>
              </div>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <Button fullWidth size="lg" icon={<ArrowRight size={20} />} onClick={() => router.push('/dashboard/b2c')}>
                Go to Dashboard
              </Button>
              <p className="text-xs text-[#a1a1aa]">
                You can now access practice exams and mock interviews tailored to your <b>{levelDetermined}</b> level.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
      {/* Navbar / Header */}
      <nav className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0a0b]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
            <Target size={18} />
          </div>
          <div>
            <div className="text-sm font-bold text-white uppercase tracking-tight">Initial Assessment</div>
            <div className="text-[10px] text-amber-500 uppercase font-semibold">Question {currentIndex + 1} of {questions.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <Clock size={14} className="text-[#a1a1aa]" />
            <span className="text-sm font-mono font-medium text-white">
              {Math.floor(totalTime / 60)}:{(totalTime % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      </nav>

      {/* Progress Bar */}
      <div className="h-1 w-full bg-white/5">
        <div 
          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <AmbientGlow />
        
        <div className="w-full max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-4">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-widest">
              {currentQuestion.interest}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">
              {currentQuestion.text}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {currentQuestion.choices.map((choice: any) => (
              <button
                key={choice.id}
                onClick={() => setSelectedChoiceId(choice.id)}
                disabled={submitting}
                className={`
                  w-full p-5 rounded-2xl text-left transition-all duration-200 border group
                  ${selectedChoiceId === choice.id 
                    ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]' 
                    : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.07]'}
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border transition-colors
                    ${selectedChoiceId === choice.id ? 'bg-amber-500 border-amber-500 text-black' : 'bg-[#18181b] border-white/10 text-[#a1a1aa]'}
                  `}>
                    {choice.id.toUpperCase()}
                  </div>
                  <span className={`text-lg font-medium transition-colors ${selectedChoiceId === choice.id ? 'text-white' : 'text-[#a1a1aa] group-hover:text-white'}`}>
                    {choice.text}
                  </span>
                  {selectedChoiceId === choice.id && (
                    <div className="ml-auto text-amber-500">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              size="lg"
              className="h-14 text-lg"
              disabled={submitting}
              onClick={() => handleNext(true)}
            >
              Skip
            </Button>
            <Button
              size="lg"
              className="min-w-[160px] h-14 text-lg"
              disabled={!selectedChoiceId || submitting}
              onClick={() => handleNext(false)}
              icon={submitting ? <Loader2 className="animate-spin" size={20} /> : <ChevronRight size={20} />}
            >
              {submitting ? 'Processing...' : currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Assessment'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
