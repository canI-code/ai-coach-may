'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { 
  Loader2, ChevronRight, Clock, BookOpen, CheckCircle2, 
  AlertCircle, ArrowRight, Trophy, Target, Flag, X, Shield, Eye, EyeOff
} from 'lucide-react';

export default function PracticeExam({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const urlParams = useParams();
  const portalType = (urlParams?.portalType as string) || 'b2c';
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
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReasonType, setFlagReasonType] = useState<'incorrect_question' | 'incorrect_answer' | 'spelling_mistake' | 'other'>('incorrect_question');
  const [flagReasonText, setFlagReasonText] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [flagError, setFlagError] = useState('');
  
  // Timer state
  const [totalTime, setTotalTime] = useState(0); // Cumulative stopwatch
  const [startTime, setStartedTime] = useState<number>(Date.now()); // Per-question start
  
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [hasConsented, setHasConsented] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Reveal answer state
  const [revealedQuestions, setRevealedQuestions] = useState<Set<string>>(new Set());
  const [showRevealModal, setShowRevealModal] = useState(false);

  // Intercept Browser Back Button (popstate)
  useEffect(() => {
    if (!hasConsented || finished || loading || error) return;

    // Push a dummy state to the history stack so "back" triggers popstate instead of leaving
    window.history.pushState({ trap: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      // Show modal and push state back to keep them here
      setShowLeaveModal(true);
      window.history.pushState({ trap: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasConsented, finished, loading, error]);

  // Global Session Tracking & Sidebar Interception
  useEffect(() => {
    if (!hasConsented || finished || loading || error) {
      if (typeof window !== 'undefined') (window as any).__ACTIVE_EXAM_SESSION = false;
      return;
    }

    // Set global flag for Sidebar to check
    if (typeof window !== 'undefined') (window as any).__ACTIVE_EXAM_SESSION = true;

    // Listen for custom event from Sidebar
    const handleSidebarLeave = (e: any) => {
      setPendingPath(e.detail.path);
      setShowLeaveModal(true);
    };

    window.addEventListener('EXAM_LEAVE_ATTEMPT', handleSidebarLeave);

    return () => {
      if (typeof window !== 'undefined') (window as any).__ACTIVE_EXAM_SESSION = false;
      window.removeEventListener('EXAM_LEAVE_ATTEMPT', handleSidebarLeave);
    };
  }, [hasConsented, finished, loading, error]);

  // Disable text selection and copying
  useEffect(() => {
    if (!hasConsented || finished || loading || error) return;

    const preventCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    const preventRightClick = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('copy', preventCopy);
    document.addEventListener('contextmenu', preventRightClick);
    
    // Add CSS to disable selection
    const style = document.createElement('style');
    style.id = 'disable-selection-style';
    style.innerHTML = `
      body {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('contextmenu', preventRightClick);
      const styleElement = document.getElementById('disable-selection-style');
      if (styleElement) styleElement.remove();
    };
  }, [hasConsented, finished, loading, error]);

  // Browser back/refresh guard
  useEffect(() => {
    if (!hasConsented || finished || loading || error) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Trigger browser confirmation dialog
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasConsented, finished, loading, error]);

  const handleAutoSubmit = async () => {
    setSubmitting(true);
    try {
      // 1. Auto-submit exam
      await fetch('/api/students/exam/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId })
      });

      // 2. Handle redirection or logout
      if (pendingPath === 'LOGOUT') {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
        router.refresh();
      } else if (pendingPath) {
        router.push(pendingPath);
      } else {
        router.push(`/dashboard/${portalType}`);
      }
    } catch (err) {
      console.error('Auto-submit failed:', err);
      router.push(`/dashboard/${portalType}`);
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleRevealClick = () => {
    setShowRevealModal(true);
  };

  const confirmReveal = () => {
    const qId = questions[currentIndex]._id;
    setRevealedQuestions(prev => new Set(prev).add(qId));
    setShowRevealModal(false);
  };

  const handleNext = async (skipped = false) => {
    if (!skipped && !selectedChoiceId) return;

    setSubmitting(true);
    const questionId = questions[currentIndex]._id;
    const duration = Math.floor((Date.now() - startTime) / 1000);

    try {
      const isRevealed = revealedQuestions.has(questionId);
      await fetch('/api/students/exam/session/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionId,
          chosenChoiceId: skipped ? 'skipped' : selectedChoiceId,
          timeSpentSeconds: duration,
          ...(isRevealed ? { revealed: true } : {})
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

  const handleFlagQuestion = async () => {
    const reason = flagReasonText.trim();
    const wordCount = reason ? reason.split(/\s+/).filter(Boolean).length : 0;

    if (flagReasonType === 'other' && !reason) {
      setFlagError('Please add a reason when selecting Other.');
      return;
    }

    if (wordCount > 150) {
      setFlagError('Reason must be 150 words or fewer.');
      return;
    }

    setFlagging(true);
    setFlagError('');

    try {
      const currentQuestion = questions[currentIndex];
      const res = await fetch('/api/students/exam/question-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionId: currentQuestion._id,
          reasonType: flagReasonType,
          reasonText: reason
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to flag question');
      }

      if (data.replacementQuestion) {
        setQuestions(prev => {
          const next = [...prev];
          next[currentIndex] = data.replacementQuestion;
          return next;
        });
      }

      setSelectedChoiceId(null);
      setShowFlagModal(false);
      setFlagReasonText('');
      setFlagReasonType('incorrect_question');
    } catch (err: any) {
      setFlagError(err.message || 'Failed to flag question.');
    } finally {
      setFlagging(false);
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
          <Button fullWidth onClick={() => router.push(`/dashboard/${portalType}`)}>
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
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-teal-500 via-emerald-500 to-teal-500" />
            
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
              <Button fullWidth size="lg" icon={<ArrowRight size={20} />} onClick={() => router.push(`/dashboard/${portalType}`)}>
                Back to Dashboard
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  if (!hasConsented) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0a0a0b] flex items-center justify-center p-4">
        <AmbientGlow color="amber" size="xl" position="center" />
        <div className="w-full max-w-xl animate-in zoom-in-95 duration-300">
          <GlassCard className="border-amber-500/30 overflow-hidden relative" padding="lg">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500" />
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Shield size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white leading-tight">Exam Lockdown Protocol</h2>
                <p className="text-amber-500/80 text-sm font-semibold uppercase tracking-wider">Mandatory Consent Required</p>
              </div>
            </div>

            <div className="space-y-4 mb-8 text-[#a1a1aa]">
              <div className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="mt-1 p-1 rounded-md bg-amber-500/20 text-amber-500">
                  <Clock size={14} />
                </div>
                <p className="text-sm"><span className="text-white font-medium">Session Locked:</span> Once you start, you cannot navigate away. The browser back button and sidebar links will be disabled.</p>
              </div>
              
              <div className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="mt-1 p-1 rounded-md bg-amber-500/20 text-amber-500">
                  <AlertCircle size={14} />
                </div>
                <p className="text-sm"><span className="text-white font-medium">Auto-Submission:</span> Attempting to force-quit, sign out, or refresh will result in <span className="text-amber-400 font-bold uppercase">Immediate Submission</span> of all current progress.</p>
              </div>

              <div className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="mt-1 p-1 rounded-md bg-amber-500/20 text-amber-500">
                  <X size={14} />
                </div>
                <p className="text-sm"><span className="text-white font-medium">Anti-Cheat Enabled:</span> Text selection, copying, and right-click menus are disabled to ensure exam integrity.</p>
              </div>
            </div>

            <label className="flex items-start gap-3 p-4 rounded-2xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/[0.08] transition-colors group mb-8">
              <input 
                type="checkbox" 
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1.5 w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500/40 accent-amber-500"
              />
              <span className="text-sm text-white font-medium leading-relaxed group-hover:text-white transition-colors">
                I understand that this is a timed, locked session. I agree that any attempt to leave or sign out will count as a completed attempt and submit my results automatically.
              </span>
            </label>

            <div className="flex gap-3">
              <Button 
                variant="ghost" 
                fullWidth 
                onClick={() => router.push(`/dashboard/${portalType}`)}
              >
                Back to Dashboard
              </Button>
              <Button 
                variant="primary" 
                fullWidth 
                disabled={!consentChecked}
                className="bg-amber-500 hover:bg-amber-600 text-black border-none font-bold"
                onClick={() => setHasConsented(true)}
                icon={<ArrowRight size={18} />}
              >
                Start Exam Now
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

      <div className="h-1 w-full bg-white/5 flex gap-px overflow-hidden">
        {Array.from({ length: 20 }).map((_, index) => {
          const filled = index < Math.ceil((progress / 100) * 20);
          return (
            <div
              key={index}
              className={`h-full flex-1 transition-colors duration-500 ${filled ? 'bg-linear-to-r from-teal-500 to-emerald-400' : 'bg-transparent'}`}
            />
          );
        })}
      </div>

      <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 text-center">
        <p className="text-xs md:text-sm text-amber-500 font-medium flex items-center justify-center gap-2">
          <AlertCircle size={14} className="animate-pulse" />
          <span><b>Lockdown Mode Active:</b> Leaving or signing out will auto-submit your current progress. Attempt will be counted.</span>
        </p>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <AmbientGlow />
        
        <div className="w-full max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-4 relative">
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-bold uppercase tracking-widest">
                {currentQuestion.interest}
              </span>
              <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-widest ${getDifficultyColor(currentQuestion.difficulty)}`}>
                {currentQuestion.difficulty || 'Medium'}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-white/80 leading-relaxed">
              {currentQuestion.text}
            </h2>
          </div>

          {(() => {
            const isRevealed = revealedQuestions.has(currentQuestion._id);
            const correctChoice = currentQuestion.correctChoiceId
              ? currentQuestion.choices.find((c: any) => c.id === currentQuestion.correctChoiceId)
              : null;
            return (
              <>
                <div className="grid grid-cols-1 gap-3">
                  {currentQuestion.choices.map((choice: any) => {
                    const isCorrectChoice = isRevealed && correctChoice?.id === choice.id;
                    return (
                      <button
                        key={choice.id}
                        onClick={() => {
                          if (!isRevealed) setSelectedChoiceId(choice.id);
                        }}
                        disabled={submitting || isRevealed}
                        className={`
                          w-full p-5 rounded-2xl text-left transition-all duration-200 border group
                          ${isCorrectChoice
                            ? 'bg-emerald-500/15 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                            : selectedChoiceId === choice.id && !isRevealed
                              ? 'bg-teal-500/10 border-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.1)]'
                              : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.07]'}
                          ${isRevealed ? 'cursor-default opacity-80' : 'cursor-pointer'}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border transition-colors
                            ${isCorrectChoice ? 'bg-emerald-500 border-emerald-500 text-black' : selectedChoiceId === choice.id && !isRevealed ? 'bg-teal-500 border-teal-500 text-black' : 'bg-[#18181b] border-white/10 text-[#a1a1aa]'}
                          `}>
                            {choice.id.toUpperCase()}
                          </div>
                          <span className={`text-lg font-medium transition-colors ${isCorrectChoice ? 'text-emerald-400' : selectedChoiceId === choice.id && !isRevealed ? 'text-white' : 'text-[#a1a1aa] group-hover:text-white'}`}>
                            {choice.text}
                          </span>
                          {isCorrectChoice && (
                            <div className="ml-auto text-emerald-500">
                              <CheckCircle2 size={20} />
                            </div>
                          )}
                          {isRevealed && isCorrectChoice && (
                            <span className="ml-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                              Correct Answer
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {isRevealed && currentQuestion.explanation && (
                  <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/15">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2 text-sm">
                      <BookOpen size={16} />
                      Explanation
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                )}
              </>
            );
          })()}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              size="lg"
              className="h-14 text-lg"
              disabled={submitting}
              onClick={() => setShowFlagModal(true)}
              icon={<Flag size={18} />}
            >
              Flag
            </Button>
            {revealedQuestions.has(currentQuestion._id) ? (
              <Button
                variant="secondary"
                size="lg"
                className="h-14 text-lg border-amber-500/20 text-amber-400 bg-amber-500/5 cursor-default"
                disabled
                icon={<EyeOff size={18} />}
              >
                Answer Revealed
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="lg"
                className="h-14 text-lg"
                disabled={submitting}
                onClick={handleRevealClick}
                icon={<Eye size={18} />}
              >
                Show Answer
              </Button>
            )}
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
              className="min-w-40 h-14 text-lg bg-teal-500 hover:bg-teal-600 text-black border-none"
              disabled={!selectedChoiceId || submitting}
              onClick={() => handleNext(false)}
              icon={submitting ? <Loader2 className="animate-spin" size={20} /> : <ChevronRight size={20} />}
            >
              {submitting ? 'Processing...' : currentIndex < totalNeeded - 1 ? 'Next Question' : 'Finish Practice'}
            </Button>
          </div>
        </div>
      </main>

      {showFlagModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111113] shadow-2xl p-6 relative">
            <button
              onClick={() => setShowFlagModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10"
              aria-label="Close flag dialog"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Flag size={18} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Flag this question</h3>
                <p className="text-sm text-[#a1a1aa]">Choose a reason and add details if needed.</p>
              </div>
            </div>

            {flagError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {flagError}
              </div>
            )}

            <div className="space-y-3">
              {[
                { id: 'incorrect_question', label: 'Incorrect question' },
                { id: 'incorrect_answer', label: 'Incorrect answer' },
                { id: 'spelling_mistake', label: 'Spelling mistake' },
                { id: 'other', label: 'Other' },
              ].map((option) => (
                <label
                  key={option.id}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-colors ${flagReasonType === option.id ? 'border-amber-500/60 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <input
                    type="radio"
                    name="flagReason"
                    value={option.id}
                    checked={flagReasonType === option.id}
                    onChange={() => setFlagReasonType(option.id as any)}
                    className="accent-amber-500"
                  />
                  <span className="text-sm text-white font-medium">{option.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-white mb-2">Extra details</label>
              <textarea
                value={flagReasonText}
                onChange={(e) => setFlagReasonText(e.target.value)}
                placeholder="Optional for preset reasons. Required for Other."
                className="w-full min-h-32 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <div className="mt-2 text-xs text-[#a1a1aa] flex justify-between gap-4">
                <span>Max 150 words</span>
                <span>{flagReasonText.trim() ? flagReasonText.trim().split(/\s+/).filter(Boolean).length : 0}/150</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setShowFlagModal(false)} disabled={flagging}>
                Cancel
              </Button>
              <Button
                fullWidth
                onClick={handleFlagQuestion}
                disabled={flagging}
                icon={flagging ? <Loader2 className="animate-spin" size={18} /> : <Flag size={18} />}
                className="bg-amber-500 hover:bg-amber-600 text-black border-none"
              >
                {flagging ? 'Saving...' : 'Submit flag'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showRevealModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/20 bg-[#111113] shadow-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 mx-auto mb-4">
              <Eye size={28} />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Reveal Answer?</h3>
            <p className="text-[#a1a1aa] text-sm mb-6 leading-relaxed">
              You will see the correct answer and explanation for this question.
              <span className="block mt-2 text-amber-400 font-semibold">
                You will receive 0 points for this question.
              </span>
            </p>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                fullWidth
                size="lg"
                onClick={() => setShowRevealModal(false)}
                className="h-12"
              >
                Cancel
              </Button>
              <Button
                fullWidth
                size="lg"
                onClick={confirmReveal}
                className="h-12 bg-amber-500 hover:bg-amber-600 text-black font-semibold border-none"
                icon={<Eye size={18} />}
              >
                Show Answer
              </Button>
            </div>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-[#111113] shadow-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
            
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-6">
              <AlertCircle size={40} />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Leave Practice Exam?</h3>
            <p className="text-[#a1a1aa] mb-8 leading-relaxed">
              Your progress will be <span className="text-white font-semibold">automatically submitted</span>. 
              The remaining <span className="text-amber-400 font-semibold">{totalNeeded - currentIndex} questions</span> will be marked as skipped and this attempt will be counted.
            </p>

            <div className="space-y-3">
              <Button
                fullWidth
                variant="danger"
                size="lg"
                onClick={handleAutoSubmit}
                disabled={submitting}
                icon={submitting ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                className="h-14 font-bold"
              >
                {submitting ? 'Submitting...' : 'Confirm & Leave'}
              </Button>
              <Button
                fullWidth
                variant="ghost"
                size="lg"
                onClick={() => {
                  setShowLeaveModal(false);
                  setPendingPath(null);
                }}
                disabled={submitting}
                className="h-14"
              >
                Continue Practice
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
