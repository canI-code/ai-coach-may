'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { 
  Loader2, ChevronRight, Clock, Target, CheckCircle2, 
  AlertCircle, ArrowRight, Trophy, Zap, Shield, X
} from 'lucide-react';
import { INTERESTS_TAXONOMY, MAIN_FIELDS } from '@/lib/taxonomy';

export default function InitialAssessment() {
  const router = useRouter();
  const params = useParams();
  const portalType = (params?.portalType as string) || 'b2c';
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(true);
  const [error, setError] = useState('');
  const [userInterests, setUserInterests] = useState<string[]>([]);

  // New interest selector state hooks
  const [showInterestSelector, setShowInterestSelector] = useState(false);
  const [selectedField, setSelectedField] = useState<string>('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);
  const [saveError, setSaveError] = useState('');
  
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
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [hasConsented, setHasConsented] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Intercept Browser Back Button (popstate)
  useEffect(() => {
    if (!hasConsented || finished || loading || error || preparing) return;

    window.history.pushState({ trap: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      setShowLeaveModal(true);
      window.history.pushState({ trap: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasConsented, finished, loading, error, preparing]);

  // Global Session Tracking & Sidebar Interception
  useEffect(() => {
    if (!hasConsented || finished || loading || error || preparing) {
      if (typeof window !== 'undefined') (window as any).__ACTIVE_EXAM_SESSION = false;
      return;
    }

    if (typeof window !== 'undefined') (window as any).__ACTIVE_EXAM_SESSION = true;

    const handleSidebarLeave = (e: any) => {
      setPendingPath(e.detail.path);
      setShowLeaveModal(true);
    };

    window.addEventListener('EXAM_LEAVE_ATTEMPT', handleSidebarLeave);

    return () => {
      if (typeof window !== 'undefined') (window as any).__ACTIVE_EXAM_SESSION = false;
      window.removeEventListener('EXAM_LEAVE_ATTEMPT', handleSidebarLeave);
    };
  }, [hasConsented, finished, loading, error, preparing]);

  // Disable text selection and copying
  useEffect(() => {
    if (!hasConsented || finished || loading || error || preparing) return;

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
    
    const style = document.createElement('style');
    style.id = 'disable-selection-style-assessment';
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
      const styleElement = document.getElementById('disable-selection-style-assessment');
      if (styleElement) styleElement.remove();
    };
  }, [hasConsented, finished, loading, error, preparing]);

  // Browser back/refresh guard
  useEffect(() => {
    if (!hasConsented || finished || loading || error || preparing) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasConsented, finished, loading, error, preparing]);

  const handleAutoSubmit = async () => {
    setSubmitting(true);
    try {
      // 1. Auto-submit assessment
      await fetch('/api/students/assessment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId })
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

  const prepareAssessment = async () => {
    setPreparing(true);
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/students/assessment/prepare', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        const errMsg = err.message || err.error || '';
        if (res.status === 404 || res.status === 400 || errMsg.includes('Profile not found') || errMsg.includes('interests')) {
          setShowInterestSelector(true);
          setPreparing(false);
          setLoading(false);
          return;
        }
        throw new Error(errMsg || 'Failed to prepare assessment');
      }
      const data = await res.json();
      setAssessmentId(data.assessmentId);
      setQuestions(data.questions);
      setStartedTime(Date.now());
      setShowInterestSelector(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreparing(false);
      setLoading(false);
    }
  };

  const handleSaveInterests = async () => {
    if (!selectedField) {
      setSaveError('Please select a main field of study.');
      return;
    }
    if (selectedInterests.length < 3) {
      setSaveError('Please select at least 3 interests.');
      return;
    }

    setSavingInterests(true);
    setSaveError('');
    try {
      const res = await fetch('/api/students/profile/interests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainField: selectedField,
          interests: selectedInterests
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save interests');
      }

      const data = await res.json();
      if (data.profile?.interests) {
        setUserInterests(data.profile.interests);
      }
      
      // Successfully saved! Now prepare the assessment
      await prepareAssessment();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSavingInterests(false);
    }
  };

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

  if (showInterestSelector) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-4 overflow-y-auto">
        <AmbientGlow color="amber" size="xl" position="center" />
        <div className="w-full max-w-xl animate-in zoom-in-95 duration-300 py-8">
          <GlassCard className="border-amber-500/20 overflow-hidden relative shadow-2xl" padding="lg">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-teal-500 to-amber-500" />
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 animate-pulse">
                <Target size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white leading-tight">Configure Your Profile</h2>
                <p className="text-amber-500/80 text-sm font-semibold uppercase tracking-wider">Select Interests to Begin</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Step 1: Select Main Field */}
              <div>
                <label className="block text-sm font-semibold text-white/90 mb-3">
                  1. Select your Main Field of Study
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {MAIN_FIELDS.map((field) => {
                    const isSelected = selectedField === field;
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => {
                          setSelectedField(field);
                          setSelectedInterests([]); // Reset interests when field changes
                          setSaveError('');
                        }}
                        className={`p-4 rounded-xl border text-center transition-all duration-300 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-bold shadow-lg shadow-amber-500/5'
                            : 'border-white/5 bg-white/5 text-[#a1a1aa] hover:border-white/10 hover:bg-white/[0.08] cursor-pointer'
                        }`}
                      >
                        {field}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Select Interests */}
              {selectedField && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-semibold text-white/90">
                      2. Select Interests (Select at least 3)
                    </label>
                    <span className="text-xs text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">
                      Selected: {selectedInterests.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {INTERESTS_TAXONOMY[selectedField].map((interest) => {
                      const isSelected = selectedInterests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedInterests(prev => prev.filter(i => i !== interest));
                            } else {
                              setSelectedInterests(prev => [...prev, interest]);
                            }
                            setSaveError('');
                          }}
                          className={`px-3 py-2 rounded-xl text-sm border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'border-teal-500/50 bg-teal-500/15 text-teal-400 font-medium'
                              : 'border-white/5 bg-white/5 text-[#a1a1aa] hover:border-white/10 hover:bg-white/[0.08]'
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {saveError && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-sm font-medium animate-in shake duration-300">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="ghost" 
                  fullWidth 
                  onClick={() => router.push(`/dashboard/${portalType}`)}
                  disabled={savingInterests}
                >
                  Return to Dashboard
                </Button>
                <Button 
                  variant="primary" 
                  fullWidth 
                  disabled={savingInterests || !selectedField || selectedInterests.length < 3}
                  className="bg-amber-500 hover:bg-amber-600 text-black border-none font-bold disabled:opacity-50 cursor-pointer"
                  onClick={handleSaveInterests}
                  icon={savingInterests ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight size={18} />}
                >
                  {savingInterests ? 'Saving...' : 'Start Assessment'}
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

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
          <Button fullWidth onClick={() => router.push(`/dashboard/${portalType}`)}>
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
            <Button className="mt-6" onClick={() => router.push(`/dashboard/${portalType}`)}>Return to Dashboard</Button>
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
              <Button fullWidth size="lg" icon={<ArrowRight size={20} />} onClick={() => router.push(`/dashboard/${portalType}`)}>
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

  if (!hasConsented) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0a0a0b] flex items-center justify-center p-4">
        <AmbientGlow color="amber" size="xl" position="center" />
        <div className="w-full max-w-xl animate-in zoom-in-95 duration-300">
          <GlassCard className="border-amber-500/30 overflow-hidden relative" padding="lg">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500" />
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Shield size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white leading-tight">Assessment Lockdown Protocol</h2>
                <p className="text-amber-500/80 text-sm font-semibold uppercase tracking-wider">Mandatory Consent Required</p>
              </div>
            </div>

            <div className="space-y-4 mb-8 text-[#a1a1aa]">
              <div className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="mt-1 p-1 rounded-md bg-amber-500/20 text-amber-500">
                  <Clock size={14} />
                </div>
                <p className="text-sm"><span className="text-white font-medium">Session Locked:</span> This assessment is critical for your personalized coaching. Once you start, the sidebar and browser back navigation will be restricted.</p>
              </div>
              
              <div className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="mt-1 p-1 rounded-md bg-amber-500/20 text-amber-500">
                  <AlertCircle size={14} />
                </div>
                <p className="text-sm"><span className="text-white font-medium">Auto-Submission:</span> If you attempt to leave or sign out mid-session, your assessment will be <span className="text-amber-400 font-bold uppercase">Submitted Automatically</span> with your current progress.</p>
              </div>

              <div className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="mt-1 p-1 rounded-md bg-amber-500/20 text-amber-500">
                  <X size={14} />
                </div>
                <p className="text-sm"><span className="text-white font-medium">No External Help:</span> Text selection, copying, and right-click menus are disabled to maintain the accuracy of your proficiency evaluation.</p>
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
                I understand that this is a timed, locked assessment. I agree that any attempt to leave or sign out will result in an automatic submission of my results.
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
                Start Assessment
              </Button>
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

      {/* Lockdown Disclaimer */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 text-center">
        <p className="text-xs md:text-sm text-amber-500 font-medium flex items-center justify-center gap-2">
          <AlertCircle size={14} className="animate-pulse" />
          <span><b>Assessment Locked:</b> Leaving or signing out will auto-submit your current progress.</span>
        </p>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <AmbientGlow />
        
        <div className="w-full max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-4">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-widest">
              {currentQuestion.interest}
            </span>
            <h2 className="text-xl md:text-2xl font-semibold text-white/80 leading-relaxed">
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
              className="min-w-[160px] h-14 text-lg bg-amber-500 hover:bg-amber-600 text-black border-none font-bold"
              disabled={!selectedChoiceId || submitting}
              onClick={() => handleNext(false)}
              icon={submitting ? <Loader2 className="animate-spin" size={20} /> : <ChevronRight size={20} />}
            >
              {submitting ? 'Processing...' : currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Assessment'}
            </Button>
          </div>
        </div>
      </main>

      {/* Exit Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-[#111113] shadow-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
            
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-6">
              <AlertCircle size={40} />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Leave Assessment?</h3>
            <p className="text-[#a1a1aa] mb-8 leading-relaxed">
              Your progress will be <span className="text-white font-semibold">automatically submitted</span>. 
              The remaining <span className="text-amber-400 font-semibold">{questions.length - currentIndex} questions</span> will be marked as skipped and your level will be calculated based on current data.
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
                Continue Assessment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
