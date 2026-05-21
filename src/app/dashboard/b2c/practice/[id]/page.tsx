'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { 
  Loader2, ChevronRight, Clock, BookOpen, CheckCircle2, 
  AlertCircle, ArrowRight, Trophy, Target
} from 'lucide-react';

export default function PracticeExam({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const sessionId = unwrappedParams.id;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [totalNeeded, setTotalNeeded] = useState(0);
  const [currentIndex, setCurrentStep] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [fetchingChunk, setFetchingChunk] = useState(false);
  
  // Timer state
  const [totalTime, setTotalTime] = useState(0); // Cumulative stopwatch
  const [startTime, setStartedTime] = useState<number>(Date.now()); // Per-question start
  
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await fetch(`/api/students/exam/session/${sessionId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || err.error || 'Failed to load session');
        }
        const data = await res.json();
        
        if (data.status === 'completed') {
          setError('This practice session has already been completed.');
          setLoading(false);
          return;
        }

        setAttemptId(data.attemptId);
        setQuestions(data.questions);
        setTotalNeeded(data.totalQuestionCount);
        
        if (data.answeredCount > 0 && data.answeredCount < data.questions.length) {
          setCurrentStep(data.answeredCount);
        }

        setStartedTime(Date.now());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  // Background chunk fetcher
  useEffect(() => {
    const fetchNextChunk = async () => {
      if (fetchingChunk || questions.length === 0 || questions.length >= totalNeeded) return;
      
      // If we are within 2 questions of running out
      if (currentIndex >= questions.length - 2) {
        setFetchingChunk(true);
        try {
          const res = await fetch('/api/students/exam/session/fetch-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attemptId })
          });
          const data = await res.json();
          if (data.newQuestions && data.newQuestions.length > 0) {
            setQuestions(prev => [...prev, ...data.newQuestions]);
          }
        } catch (err) {
          console.error('Background fetch failed:', err);
        } finally {
          setFetchingChunk(false);
        }
      }
    };

    fetchNextChunk();
  }, [currentIndex, questions.length, totalNeeded, attemptId, fetchingChunk]);

  useEffect(() => {
    if (loading || finished || submitting || error) return;

    const timer = setInterval(() => {
      setTotalTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, finished, submitting, error]);

  const handleNext = async (skipped = false) => {
    if (!skipped && !selectedChoiceId) return;

    setSubmitting(true);
    const questionId = questions[currentIndex]._id;
    const duration = Math.floor((Date.now() - startTime) / 1000);

    try {
      await fetch('/api/students/exam/session/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionId,
          chosenChoiceId: skipped ? 'skipped' : selectedChoiceId,
          timeSpentSeconds: duration
        })
      });

      if (currentIndex < totalNeeded - 1) {
        setCurrentStep(currentIndex + 1);
        setSelectedChoiceId(null);
        setStartedTime(Date.now());
      } else {
        const res = await fetch('/api/students/exam/session/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attemptId })
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
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <GlassCard className="max-w-md text-center border-red-500/20" padding="lg">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <CardTitle className="text-xl mb-2">Practice Unavailable</CardTitle>
          <CardDescription className="mb-6">{error}</CardDescription>
          <Button fullWidth onClick={() => router.push('/dashboard/b2c')}>
            Return to Dashboard
          </Button>
        </GlassCard>
      </div>
    );
  }

  if (loading || (questions.length === 0 && !finished)) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <div className="text-center max-w-md">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Loading Session...</h2>
          <p className="text-[#a1a1aa]">Retrieving your customized questions.</p>
        </div>
      </div>
    );
  }

  if (finished) {
    const { levelAchieved, scorePercentage, avgDifficultyAchieved } = results;
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-4 overflow-y-auto">
        <AmbientGlow />
        <div className="w-full max-w-2xl py-12">
          <GlassCard className="text-center border-teal-400/20 overflow-hidden relative" padding="lg">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500" />
            
            <div className="w-20 h-20 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-500 mx-auto mb-6">
              <Trophy size={40} />
            </div>
            
            <h1 className="text-4xl font-bold mb-2">Practice Complete!</h1>
            <p className="text-[#a1a1aa] mb-12">Great job. Here is how you performed in this session.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
                <div className="text-[#a1a1aa] text-xs uppercase tracking-wider mb-2">Time-Weighted Score</div>
                <div className="text-3xl font-bold text-amber-500">{Math.round(scorePercentage)}%</div>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
                <div className="text-[#a1a1aa] text-xs uppercase tracking-wider mb-2">Avg Difficulty</div>
                <div className="text-3xl font-bold text-white">{avgDifficultyAchieved.toFixed(1)} <span className="text-sm text-muted">/ 4</span></div>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
                <div className="text-[#a1a1aa] text-xs uppercase tracking-wider mb-2">Performance Rank</div>
                <div className="text-3xl font-bold text-teal-400">{levelAchieved}</div>
              </div>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <Button fullWidth size="lg" icon={<ArrowRight size={20} />} onClick={() => router.push('/dashboard/b2c')}>
                Back to Dashboard
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / totalNeeded) * 100;

  const getDifficultyColor = (diff: string) => {
    switch(diff?.toLowerCase()) {
      case 'easy': return 'text-green-400 border-green-400/20 bg-green-400/10';
      case 'medium': return 'text-blue-400 border-blue-400/20 bg-blue-400/10';
      case 'hard': return 'text-orange-400 border-orange-400/20 bg-orange-400/10';
      case 'expert': return 'text-red-400 border-red-400/20 bg-red-400/10';
      default: return 'text-blue-400 border-blue-400/20 bg-blue-400/10';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
      <nav className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0a0b]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400">
            <BookOpen size={18} />
          </div>
          <div>
            <div className="text-sm font-bold text-white uppercase tracking-tight">Practice Session</div>
            <div className="text-[10px] text-teal-500 uppercase font-semibold">Question {currentIndex + 1} of {totalNeeded}</div>
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

      <div className="h-1 w-full bg-white/5">
        <div 
          className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <AmbientGlow />
        
        <div className="w-full max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-4">
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-bold uppercase tracking-widest">
                {currentQuestion.interest}
              </span>
              <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-widest ${getDifficultyColor(currentQuestion.difficulty)}`}>
                {currentQuestion.difficulty || 'Medium'}
              </span>
            </div>
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
                    ? 'bg-teal-500/10 border-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.1)]' 
                    : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.07]'}
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border transition-colors
                    ${selectedChoiceId === choice.id ? 'bg-teal-500 border-teal-500 text-black' : 'bg-[#18181b] border-white/10 text-[#a1a1aa]'}
                  `}>
                    {choice.id.toUpperCase()}
                  </div>
                  <span className={`text-lg font-medium transition-colors ${selectedChoiceId === choice.id ? 'text-white' : 'text-[#a1a1aa] group-hover:text-white'}`}>
                    {choice.text}
                  </span>
                  {selectedChoiceId === choice.id && (
                    <div className="ml-auto text-teal-500">
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
              className="min-w-[160px] h-14 text-lg bg-teal-500 hover:bg-teal-600 text-black border-none"
              disabled={!selectedChoiceId || submitting}
              onClick={() => handleNext(false)}
              icon={submitting ? <Loader2 className="animate-spin" size={20} /> : <ChevronRight size={20} />}
            >
              {submitting ? 'Processing...' : currentIndex < totalNeeded - 1 ? 'Next Question' : 'Finish Practice'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
