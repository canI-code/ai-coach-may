'use client';

/**
 * Interview session page — the browser Realtime Layer for the Interview Module.
 *
 * Responsibilities (Req 11.7, 15.1, 15.2):
 *  - Capture webcam + mic locally via `react-webcam` and the Web Speech API.
 *  - Drive the browser analysis modules:
 *      • AudioAnalyzer (Web Speech transcript + WebAudio AnalyserNode → speech metrics)
 *      • VisionAnalyzer / analyzeVisionFrame (MediaPipe Face + Pose landmarks → vision metrics)
 *      • RealtimeCoach / evaluateCues / buildAnswerPayload (rule-based cues + timeline + aggregation)
 *  - Render live coaching cues and metrics entirely client-side — NO network in the hot path.
 *  - On submit, aggregate the buffered NUMERIC metrics + transcript into a strict
 *    AnswerSubmitPayload and POST it to /api/interview/[sessionId]/answer. Raw audio/video
 *    frames are NEVER transmitted — only derived numbers and the transcript leave the browser.
 *
 * Next.js 16: this is a Client Component (`'use client'`) because it needs webcam/mic,
 * `useState`/`useEffect`, and browser-only APIs. The dynamic `sessionId` route param is a
 * Promise and is unwrapped with React's `use()` hook.
 */

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Webcam from 'react-webcam';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Send,
  LoaderCircle,
  Square,
  ArrowRight,
  TriangleAlert,
  Volume2,
  VolumeX,
  Timer,
  Shield,
  AlertCircle,
  X,
  Clock,
  Lightbulb,
  CheckCircle2,
  Lock,
  Briefcase,
  Cpu,
  Hash,
  Check,
  Target,
  FileText,
  Eye,
  Home,
  BarChart3,
} from 'lucide-react';

import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';

import { AudioAnalyzer } from '@/lib/interview/browser/audio-analyzer';
import {
  VisionAnalyzer,
  analyzeVisionFrame,
  type Emotion,
  type VisionFrame,
} from '@/lib/interview/browser/vision-analyzer';
import {
  RealtimeCoach,
  evaluateCues,
  buildAnswerPayload,
  type Cue,
  type MetricBuffers,
} from '@/lib/interview/browser/realtime-coach';
import type { TimelineEntry, QuestionEvaluation } from '@/lib/interview/schemas';

import { LiveCoachPanel, type LiveMetricsView } from '../components/LiveCoachPanel';
import { CueOverlay } from '../components/CueOverlay';
import { HardwareCheck } from '../components/HardwareCheck';
import { BehavioralTimeline } from '../components/BehavioralTimeline';

// ── Constants ───────────────────────────────────────────────────────────────

/** One vision frame per capture interval (Req 10.8) — not every animation frame. */
const VISION_INTERVAL_MS = 500;
/** Public path where the MediaPipe wasm + .task assets are served from. */
const MEDIAPIPE_WASM_BASE = '/mediapipe';

const PERSONA_DETAILS: Record<
  string,
  { label: string; description: string; badgeColor: string }
> = {
  general_recruiter: {
    label: 'General Recruiter',
    description: 'Balanced, conversational assessment focusing on structure and basic competencies.',
    badgeColor: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  },
  tech_lead: {
    label: 'Technical Lead',
    description: 'Deep technical probing, system design constraints, and logic evaluation.',
    badgeColor: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  },
  stress_interviewer: {
    label: 'Stress Interviewer',
    description: 'High pressure scenario questioning, challenging edge cases, and pushbacks.',
    badgeColor: 'bg-red-500/10 border-red-500/20 text-red-400',
  },
};

type Phase = 'idle' | 'answering' | 'reviewing' | 'submitting' | 'complete' | 'error';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

// ── Minimal Web Speech API typings (not in the DOM lib) ─────────────────────

interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onstart?: (() => void) | null;
}

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

// ── MediaPipe landmark geometry helpers (browser-only) ──────────────────────

const RAD2DEG = 180 / Math.PI;

/** Approximate head yaw/pitch (degrees) from face landmarks. */
function estimateHeadPose(landmarks: { x: number; y: number; z: number }[]): {
  yawDeg: number;
  pitchDeg: number;
} {
  // Nose tip (1), left eye outer (33), right eye outer (263), chin (152), forehead (10).
  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const chin = landmarks[152];
  const forehead = landmarks[10];
  if (!nose || !leftEye || !rightEye || !chin || !forehead) {
    return { yawDeg: 0, pitchDeg: 0 };
  }
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeWidth = Math.abs(rightEye.x - leftEye.x) || 1e-6;
  // Horizontal offset of the nose from the eye midpoint → yaw.
  const yawDeg = Math.atan2(nose.x - eyeMidX, eyeWidth) * RAD2DEG * 1.5;
  const faceHeight = Math.abs(chin.y - forehead.y) || 1e-6;
  const faceMidY = (chin.y + forehead.y) / 2;
  // Vertical offset of the nose from the face midpoint → pitch (down is positive y).
  const pitchDeg = -Math.atan2(nose.y - faceMidY, faceHeight) * RAD2DEG * 2;
  return { yawDeg, pitchDeg };
}

/** Shoulder-slope deviation (degrees) from pose landmarks 11 (L) and 12 (R). */
function estimateShoulderSlope(landmarks: { x: number; y: number }[]): number {
  const left = landmarks[11];
  const right = landmarks[12];
  if (!left || !right) return 0;
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  if (dx === 0 && dy === 0) return 0;
  return Math.atan2(dy, Math.abs(dx) || 1e-6) * RAD2DEG;
}

/** Map face blendshape categories to the module's emotion distribution. */
function blendshapesToEmotions(
  categories: { categoryName: string; score: number }[],
): Partial<Record<Emotion, number>> {
  const get = (name: string) =>
    categories.find((c) => c.categoryName === name)?.score ?? 0;
  const smile = (get('mouthSmileLeft') + get('mouthSmileRight')) / 2;
  const frown = (get('mouthFrownLeft') + get('mouthFrownRight')) / 2;
  const browDown = (get('browDownLeft') + get('browDownRight')) / 2;
  const browUp = (get('browInnerUp') + get('browOuterUpLeft') + get('browOuterUpRight')) / 3;
  const jawOpen = get('jawOpen');
  const dist: Partial<Record<Emotion, number>> = {
    happy: smile,
    sad: frown,
    angry: browDown,
    surprised: Math.max(browUp - 0.2, 0) + Math.max(jawOpen - 0.3, 0),
    confused: Math.max(browUp * browDown, 0),
    calm: Math.max(0.4 - smile - frown - browDown, 0),
    neutral: 0.25,
  };
  return dist;
}

// ── The page ─────────────────────────────────────────────────────────────────

export default function InterviewSessionPage({ params }: PageProps) {
  const { sessionId } = use(params);
  const router = useRouter();
  const pathParams = useParams();
  const portalType = (pathParams?.portalType as string) || 'b2c';

  // Question / loop state.
  const [questionText, setQuestionText] = useState<string>('');
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  // The total-questions cap is intentionally NOT tracked in UI state — the candidate
  // paces themselves by the countdown timer, never by a question count. The backend
  // still enforces the duration-derived cap server-side.
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastFeedback, setLastFeedback] = useState<QuestionEvaluation | null>(null);

  // Live, browser-derived metrics (numeric only — never raw media).
  const [liveMetrics, setLiveMetrics] = useState<LiveMetricsView>({
    wpm: 0,
    pace: 'normal',
    fillerCount: 0,
    eyeContact: 100,
    composure: 100,
    postureDistortion: false,
    emotion: 'neutral',
  });
  const [activeCues, setActiveCues] = useState<Cue[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  // TTS mute toggle.
  const [ttsMuted, setTtsMuted] = useState(false);
  const ttsMutedRef = useRef(false);

  // Keep ref in sync with state for use in async callbacks.
  useEffect(() => { ttsMutedRef.current = ttsMuted; }, [ttsMuted]);

  // Suppress TensorFlow Lite XNNPACK delegate messages in the console
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalInfo = console.info;
    const originalLog = console.log;
    console.info = (...args: any[]) => {
      const msg = args.map(String).join(' ');
      if (msg.includes('TensorFlow Lite') || msg.includes('XNNPACK')) return;
      originalInfo(...args);
    };
    console.log = (...args: any[]) => {
      const msg = args.map(String).join(' ');
      if (msg.includes('TensorFlow Lite') || msg.includes('XNNPACK')) return;
      originalLog(...args);
    };
    return () => {
      console.info = originalInfo;
      console.log = originalLog;
    };
  }, []);

  // TTS playback helper.
  const playTts = useCallback(async (text: string) => {
    if (ttsMutedRef.current || !text) return;
    try {
      const res = await fetch('/api/interview/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      audio.play().catch(() => URL.revokeObjectURL(url));
    } catch { /* best-effort TTS */ }
  }, []);

  // Live transcript display (interim + final, read-only).
  const [liveTranscriptDisplay, setLiveTranscriptDisplay] = useState('');
  // Countdown timer state.
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [startedAtMs, setStartedAtMs] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // End popup state — natural completion (time/cap reached, set by /answer response).
  const [showEndPopup, setShowEndPopup] = useState(false);

  const [completedReport, setCompletedReport] = useState<any | null>(null);
  const [completedReportStatus, setCompletedReportStatus] = useState<'pending' | 'ready' | 'failed'>('pending');

  const [selectedWebcamId, setSelectedWebcamId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [webcams, setWebcams] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);

  // ── Review Phase States ───────────────────────────────────────────────────
  const [originalTranscript, setOriginalTranscript] = useState('');
  const [reviewSecondsLeft, setReviewSecondsLeft] = useState(180);
  const [reviewTimerActive, setReviewTimerActive] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editStats, setEditErrorStats] = useState({ diffCount: 0, limit: 0, percent: 0 });

  // History for Undo/Redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushToHistory = useCallback((text: string) => {
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      if (next[next.length - 1] === text) return prev;
      const updated = [...next, text].slice(-20); // Limit history to 20 entries
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      const text = history[nextIdx];
      setLiveTranscriptDisplay(text);
      transcriptRef.current = text;
      setHistoryIndex(nextIdx);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const text = history[nextIdx];
      setLiveTranscriptDisplay(text);
      transcriptRef.current = text;
      setHistoryIndex(nextIdx);
    }
  }, [history, historyIndex]);

  // Global keydown listener for Ctrl+Z and Ctrl+Y undo/redo during the review phase
  useEffect(() => {
    if (phase !== 'reviewing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [phase, undo, redo]);

  const getWordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

  const validateEditLimit = useCallback((currentText: string, originalText: string) => {
    const origWords = originalText.trim().split(/\s+/).filter(Boolean);
    const currWords = currentText.trim().split(/\s+/).filter(Boolean);
    
    // Word-level Levenshtein distance
    const dp: number[][] = [];
    for (let i = 0; i <= origWords.length; i++) {
      dp[i] = [i];
    }
    for (let j = 0; j <= currWords.length; j++) {
      dp[0][j] = j;
    }
    for (let i = 1; i <= origWords.length; i++) {
      for (let j = 1; j <= currWords.length; j++) {
        if (origWords[i - 1] === currWords[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // deletion
            dp[i][j - 1] + 1, // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }
    const diffCount = dp[origWords.length][currWords.length];
    const limit = Math.ceil(origWords.length * 0.3);
    return {
      valid: diffCount <= limit,
      diffCount,
      limit,
      percent: origWords.length > 0 ? Math.round((diffCount / origWords.length) * 100) : 0
    };
  }, []);

  // ── Extra UI States for local feedback ─────────────────────────────────────
  const [questionElapsedSeconds, setQuestionElapsedSeconds] = useState<number>(0);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [difficulty, setDifficulty] = useState<number>(3);
  const [totalQuestions, setTotalQuestions] = useState<number>(4);
  const [role, setRole] = useState<string>('');
  const [aiPersona, setAiPersona] = useState<string>('general_recruiter');
  const [tags, setTags] = useState<string[]>([]);

  const toggleMic = useCallback(() => {
    setMicMuted((prev) => {
      const next = !prev;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cachedCam = localStorage.getItem('preferred_webcam_id') || '';
    const cachedMic = localStorage.getItem('preferred_mic_id') || '';
    setSelectedWebcamId(cachedCam);
    setSelectedMicId(cachedMic);

    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === 'videoinput');
        const mics = devices.filter((d) => d.kind === 'audioinput');
        setWebcams(cams);
        setMicrophones(mics);

        if (!cachedCam && cams.length > 0) {
          setSelectedWebcamId(cams[0].deviceId);
        }
        if (!cachedMic && mics.length > 0) {
          setSelectedMicId(mics[0].deviceId);
        }
      } catch (err) {
        console.error('Error enumerating devices:', err);
      }
    }
    getDevices();
  }, []);

  const changeWebcam = useCallback((deviceId: string) => {
    setSelectedWebcamId(deviceId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_webcam_id', deviceId);
    }
    console.log('[interview] Switched camera to:', deviceId);
  }, []);

  const changeMic = useCallback(async (deviceId: string) => {
    setSelectedMicId(deviceId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_mic_id', deviceId);
    }

    if (phaseRef.current === 'answering') {
      try {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getAudioTracks().forEach((track) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { ideal: deviceId } }
        });

        if (mediaStreamRef.current) {
          const currentAudioTracks = mediaStreamRef.current.getAudioTracks();
          currentAudioTracks.forEach((track) => {
            mediaStreamRef.current!.removeTrack(track);
            track.stop();
          });
          stream.getAudioTracks().forEach((track) => {
            track.enabled = !micMuted;
            mediaStreamRef.current!.addTrack(track);
          });
        } else {
          mediaStreamRef.current = stream;
        }

        if (audioCtxRef.current && analyserRef.current) {
          const source = audioCtxRef.current.createMediaStreamSource(stream);
          source.connect(analyserRef.current);
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          try {
            mediaRecorderRef.current.stop();
          } catch {}
          audioChunksRef.current = [];
          const recorder = new MediaRecorder(stream, { mimeType: recordMimeRef.current });
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
          };
          recorder.start(1000);
          mediaRecorderRef.current = recorder;
        }

        console.log('[interview] Seamlessly switched active microphone input during session');
      } catch (err) {
        console.error('[interview] Failed to switch microphone input:', err);
      }
    }
  }, [micMuted]);

  // ── Question elapsed timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'answering') {
      setQuestionElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setQuestionElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // ── Lockdown / anti-cheat state ────────────────────────────────────────────
  // Same shape as the exam lockdown so the candidate cannot silently abandon and
  // re-attempt to game stats/burn LLM credits. The candidate must explicitly consent
  // before the session UI is exposed; once consented, the back button, sidebar, and
  // refresh/close are all trapped and route through the leave modal which auto-ends
  // the session via /api/interview/[sessionId]/end (counted as a completed attempt).
  const [hasConsented, setHasConsented] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showHardwareCheck, setShowHardwareCheck] = useState(false);

  const handleStartInterview = useCallback(async () => {
    setShowHardwareCheck(true);
  }, []);

  const handleHardwarePass = useCallback(async () => {
    setShowHardwareCheck(false);
    setHasConsented(true);

    try {
      const res = await fetch(`/api/interview/${sessionId}/resume?start=true`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.startedAt) {
          setStartedAtMs(new Date(data.startedAt).getTime());
        }
      }
    } catch (err) {
      console.error('Error starting session timer:', err);
    }

    // Play TTS for the initial question only after consent and hardware verification.
    if (questionText) playTts(questionText);
  }, [questionText, playTts, sessionId]);

  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  // Refs for the capture pipeline (avoid re-renders in the hot path).
  const webcamRef = useRef<Webcam>(null);
  const audioAnalyzerRef = useRef<AudioAnalyzer>(new AudioAnalyzer());
  const visionAnalyzerRef = useRef<VisionAnalyzer>(new VisionAnalyzer());
  const coachRef = useRef<RealtimeCoach>(new RealtimeCoach());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<unknown>(null);
  const poseLandmarkerRef = useRef<unknown>(null);
  const visionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerStartRef = useRef<number>(0);
  const transcriptRef = useRef<string>('');

  // MediaRecorder captures the answer audio for authoritative Groq Whisper STT on
  // submit. The recorded audio is sent to our own /api/interview/transcribe route only
  // (transient, never stored) — the live Web Speech transcript above still drives the
  // zero-latency coaching cues where the browser supports it.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordMimeRef = useRef<string>('audio/webm');

  // Buffers aggregated into the AnswerSubmitPayload on submit (numeric only).
  const buffersRef = useRef<MetricBuffers>(emptyBuffers());

  function emptyBuffers(): MetricBuffers {
    return {
      wpmArr: [],
      fillerCount: 0,
      eyeContactArr: [],
      postureArr: [],
      pitchVariance: 0,
      loudnessVariance: 0,
      sentiment: 0,
      dominantEmotion: 'neutral',
      composure: 100,
    };
  }

  // ── Load the current question (resume serves the persisted index) ──────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/interview/${sessionId}/resume`, { method: 'POST' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setErrorMessage(data?.error ?? 'Failed to load session');
          setPhase('error');
          setLoading(false);
          return;
        }
        if (data.report) {
          // The session is already finished — go straight to the report.
          router.replace(`/dashboard/${portalType}/interview/${sessionId}/report`);
          return;
        }
        setQuestionText(data.questionText ?? '');
        setQuestionIndex(data.currentQuestionIndex ?? 0);
        if (data.difficulty) setDifficulty(data.difficulty);
        if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
        if (data.role) setRole(data.role);
        if (data.aiPersona) setAiPersona(data.aiPersona);
        if (data.tags) setTags(data.tags);
        // Duration and start time for countdown.
        if (data.durationMinutes) {
          setDurationMinutes(data.durationMinutes);
          if (data.startedAt) {
            const start = new Date(data.startedAt).getTime();
            setStartedAtMs(start);
            const left = Math.max(0, Math.ceil(((data.durationMinutes * 60_000) - (Date.now() - start)) / 1000));
            setRemainingSeconds(left);
          } else {
            setRemainingSeconds(data.durationMinutes * 60);
          }
        }
        setLoading(false);
      } catch {
        if (cancelled) return;
        setErrorMessage('Network error loading the session');
        setPhase('error');
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router, playTts]);

  const [totalPausedMs, setTotalPausedMs] = useState(0);
  const reviewStartTimeRef = useRef<number | null>(null);

  // Camera pause / shutter warning states
  const [isPausedDueToCamera, setIsPausedDueToCamera] = useState(false);
  const [lockdownSecondsLeft, setLockdownSecondsLeft] = useState(120);
  const missingFaceFramesRef = useRef(0);

  // Refs to avoid stale closures in setInterval
  const analyzeFrameRef = useRef<() => void>(() => {});
  const sampleAudioRef = useRef<() => void>(() => {});
  const stopCaptureRef = useRef<() => void>(() => {});

  const handleCameraLockdownTimeout = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    stopCaptureRef.current();
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    try {
      await fetch(`/api/interview/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'camera_lockdown_timeout' }),
      });
    } catch {
      /* best-effort */
    }
    if (typeof window !== 'undefined') {
      (window as unknown as { __ACTIVE_INTERVIEW_SESSION?: boolean }).__ACTIVE_INTERVIEW_SESSION = false;
    }
    router.push(`/dashboard/${portalType}/interview/${sessionId}/report`);
  }, [ending, router, sessionId]);

  // ── Camera Pause / Shutter Lockdown Timer ──────────────────────────────────
  useEffect(() => {
    if (!isPausedDueToCamera) return;

    const interval = setInterval(() => {
      setLockdownSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleCameraLockdownTimeout();
          return 0;
        }
        return prev - 1;
      });

      // Keep freezing the main interview countdown
      setTotalPausedMs((prev) => prev + 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPausedDueToCamera, handleCameraLockdownTimeout]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!durationMinutes || !startedAtMs) return;
    const totalMs = durationMinutes * 60_000;
    const tick = () => {
      if (phase === 'reviewing') return;

      const elapsed = Date.now() - startedAtMs;
      const left = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
      setRemainingSeconds(Math.min(durationMinutes * 60, left));
      if (left <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [durationMinutes, startedAtMs, phase]);

  // ── Review Phase Timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!reviewTimerActive) return;
    const timer = setInterval(() => {
      setReviewSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [reviewTimerActive]);



  // ── Poll Report on Complete ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'complete') return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval>;

    async function checkReport() {
      try {
        const res = await fetch(`/api/interview/${sessionId}/report`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.status === 'ready' && data.report) {
          setCompletedReport(data.report);
          setCompletedReportStatus('ready');
          clearInterval(intervalId);
        } else if (data.status === 'failed') {
          setCompletedReportStatus('failed');
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Error polling report:', err);
      }
    }

    checkReport();
    intervalId = setInterval(checkReport, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [phase, sessionId]);

  // ── Lockdown protocol (Req: prevent fake/abandoned attempts) ───────────────
  // Mirrors the Exam Lockdown so the candidate cannot silently abandon and re-attempt
  // to game stats or burn LLM credits. The lock is ACTIVE only after the candidate
  // has consented, while loading is finished, and while the session is still in
  // progress (not naturally complete and not in a fatal error state).
  const lockdownActive =
    hasConsented && !loading && phase !== 'complete' && phase !== 'error';

  // 1. Browser back-button trap — push a dummy history entry so a back press fires
  //    `popstate` (intercepted) instead of leaving the route.
  useEffect(() => {
    if (!lockdownActive) return;

    window.history.pushState({ trap: true }, '');

    const handlePopState = () => {
      setShowLeaveModal(true);
      // Re-arm the trap so the next back press also fires popstate, not navigation.
      window.history.pushState({ trap: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [lockdownActive]);

  // 2. Refresh / close-tab guard — the browser's native confirmation dialog. Note:
  //    this cannot auto-end the session by itself (no async work after unload), so
  //    the auto-end safety net relies on the natural lifecycle (the user's NEXT
  //    return resumes via /resume, and the time/cap completion check still fires).
  useEffect(() => {
    if (!lockdownActive) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lockdownActive]);

  // 3. Sidebar / global-link interception — set a window-level flag that the shared
  //    Sidebar checks before any navigation. When set, the Sidebar dispatches an
  //    `INTERVIEW_LEAVE_ATTEMPT` custom event with the desired destination instead of
  //    routing; we catch it here, surface the leave modal, and remember the path so
  //    `handleAutoEnd` can finish the redirect after the auto-end POST.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!lockdownActive) {
      (window as unknown as { __ACTIVE_INTERVIEW_SESSION?: boolean }).__ACTIVE_INTERVIEW_SESSION = false;
      return;
    }

    (window as unknown as { __ACTIVE_INTERVIEW_SESSION?: boolean }).__ACTIVE_INTERVIEW_SESSION = true;

    const handleSidebarLeave = (e: Event) => {
      const detail = (e as CustomEvent<{ path?: string }>).detail;
      setPendingPath(detail?.path ?? null);
      setShowLeaveModal(true);
    };

    window.addEventListener('INTERVIEW_LEAVE_ATTEMPT', handleSidebarLeave);
    return () => {
      (window as unknown as { __ACTIVE_INTERVIEW_SESSION?: boolean }).__ACTIVE_INTERVIEW_SESSION = false;
      window.removeEventListener('INTERVIEW_LEAVE_ATTEMPT', handleSidebarLeave);
    };
  }, [lockdownActive]);

  // 4. Anti-cheat — disable text selection, copy, and the right-click context menu
  //    on the interview surface so question text cannot be trivially exfiltrated to
  //    an outside model while answering.
  useEffect(() => {
    if (!lockdownActive) return;

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
    style.id = 'interview-lockdown-style';
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
      const styleEl = document.getElementById('interview-lockdown-style');
      if (styleEl) styleEl.remove();
    };
  }, [lockdownActive]);

  // ── Lazy-init MediaPipe landmarkers once ───────────────────────────────────
  const ensureLandmarkers = useCallback(async () => {
    if (faceLandmarkerRef.current && poseLandmarkerRef.current) return;
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
    faceLandmarkerRef.current = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${MEDIAPIPE_WASM_BASE}/face_landmarker.task` },
      outputFaceBlendshapes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
    });
    poseLandmarkerRef.current = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${MEDIAPIPE_WASM_BASE}/pose_landmarker_lite.task` },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }, []);

  // ── Per-interval vision frame analysis (Req 10.8: one frame per interval) ──
  // Merge a coach tick from either the audio or vision path and refresh the UI.
  const liveSnapshotRef = useRef({
    wpm: 0,
    fillerCount: 0,
    eyeContact: 100,
    postureDistortion: false,
    emotion: 'neutral' as string,
    composure: 100,
  });

  const pushCoachTick = useCallback(
    (
      tSeconds: number,
      partial: Partial<{
        wpm: number;
        fillerCount: number;
        eyeContact: number;
        postureDistortion: boolean;
        emotion: string;
        composure: number;
      }>,
    ) => {
      const snap = { ...liveSnapshotRef.current, ...partial };
      liveSnapshotRef.current = snap;

      // The stateful coach records timeline events for the cues it sees this tick.
      coachRef.current.tick(tSeconds, {
        wpm: snap.wpm,
        fillerCount: snap.fillerCount,
        eyeContact: snap.eyeContact,
        postureDistortion: snap.postureDistortion,
        emotion: snap.emotion,
      });

      // The displayed overlay reflects the current snapshot (pure evaluation).
      const displayCues = evaluateCues({
        wpm: snap.wpm,
        fillerCount: snap.fillerCount,
        eyeContact: snap.eyeContact,
        postureDistortion: snap.postureDistortion,
        emotion: snap.emotion,
      });

      setActiveCues(displayCues);
      setTimeline(coachRef.current.timeline());
      setLiveMetrics((prev) => ({
        ...prev,
        wpm: snap.wpm,
        fillerCount: snap.fillerCount,
        eyeContact: snap.eyeContact,
        composure: snap.composure,
        postureDistortion: snap.postureDistortion,
        emotion: snap.emotion,
        pace: snap.wpm > 170 ? 'fast' : snap.wpm > 0 && snap.wpm < 90 ? 'slow' : 'normal',
      }));
    },
    [],
  );

  const analyzeFrame = useCallback(() => {
    const video = webcamRef.current?.video;
    if (!video || video.readyState < 2) return;
    const now = performance.now();

    const face = faceLandmarkerRef.current as {
      detectForVideo?: (v: HTMLVideoElement, t: number) => {
        faceLandmarks: { x: number; y: number; z: number }[][];
        faceBlendshapes: { categories: { categoryName: string; score: number }[] }[];
      };
    } | null;
    const pose = poseLandmarkerRef.current as {
      detectForVideo?: (v: HTMLVideoElement, t: number) => {
        landmarks: { x: number; y: number }[][];
      };
    } | null;
    if (!face?.detectForVideo || !pose?.detectForVideo) return;

    // 1. If camera lockdown is active, check if face has returned to unpause
    if (isPausedDueToCamera) {
      try {
        const faceRes = face.detectForVideo(video, now);
        const lm = faceRes.faceLandmarks?.[0];
        if (lm && lm.length > 0) {
          setIsPausedDueToCamera(false);
          missingFaceFramesRef.current = 0;
        }
      } catch {
        /* ignore */
      }
      return;
    }

    let yawDeg = 0;
    let pitchDeg = 0;
    let emotionDistribution: Partial<Record<Emotion, number>> = { neutral: 1 };
    let shoulderSlopeDeviationDeg = 0;
    let hasFace = false;

    try {
      const faceRes = face.detectForVideo(video, now);
      const lm = faceRes.faceLandmarks?.[0];
      if (lm && lm.length > 0) {
        hasFace = true;
        const pose2d = estimateHeadPose(lm);
        yawDeg = pose2d.yawDeg;
        pitchDeg = pose2d.pitchDeg;
      }
      const blend = faceRes.faceBlendshapes?.[0]?.categories;
      if (blend && blend.length > 0) {
        emotionDistribution = blendshapesToEmotions(blend);
      }
    } catch {
      /* transient detection error — skip this frame */
    }

    // 2. Handle missing face and lockdown trigger
    if (!hasFace) {
      if (phase === 'answering') {
        missingFaceFramesRef.current += 1;
        if (missingFaceFramesRef.current >= 6) { // 3 seconds at 500ms intervals
          setIsPausedDueToCamera(true);
          setLockdownSecondsLeft(120);
          return;
        }
      }
    } else {
      missingFaceFramesRef.current = 0;
    }

    try {
      const poseRes = pose.detectForVideo(video, now);
      const plm = poseRes.landmarks?.[0];
      if (plm && plm.length > 0) {
        shoulderSlopeDeviationDeg = estimateShoulderSlope(plm);
      }
    } catch {
      /* skip frame */
    }

    const tSeconds = (now - answerStartRef.current) / 1000;
    visionAnalyzerRef.current.recordYaw(tSeconds, yawDeg);

    // Calculate metrics based on whether face was detected
    let vm;
    if (!hasFace) {
      vm = {
        eyeContact: 0,
        gazeDown: true,
        postureDistortion: true,
        dominantEmotion: 'neutral' as Emotion,
        composure: 0,
      };
    } else {
      const frame: VisionFrame = {
        yawDeg,
        pitchDeg,
        shoulderSlopeDeviationDeg,
        emotionDistribution,
      };
      vm = analyzeVisionFrame(frame);
    }

    // Buffer the numeric vision metrics for the eventual aggregated payload.
    const b = buffersRef.current;
    b.eyeContactArr.push(vm.eyeContact);
    b.postureArr.push(vm.postureDistortion ? 0 : 100);
    b.composure = vm.composure;
    b.dominantEmotion = vm.dominantEmotion;

    pushCoachTick(tSeconds, {
      eyeContact: vm.eyeContact,
      postureDistortion: vm.postureDistortion,
      emotion: vm.dominantEmotion,
      composure: vm.composure,
    });
  }, [pushCoachTick, phase, isPausedDueToCamera]);

  // ── WebAudio loudness/pitch sampling driven off the AnalyserNode ────────────
  const sampleAudio = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    // RMS loudness from the time-domain samples.
    let sumSq = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / buf.length);
    // Crude zero-crossing-based pitch proxy (Hz) — numeric only, never raw audio.
    let crossings = 0;
    for (let i = 1; i < buf.length; i++) {
      if ((buf[i - 1] - 128) * (buf[i] - 128) < 0) crossings++;
    }
    const sampleRate = audioCtxRef.current?.sampleRate ?? 48000;
    const pitchHz = (crossings / 2) * (sampleRate / buf.length);
    audioAnalyzerRef.current.ingestAudioFrame(pitchHz, rms * 100);

    // Regularly update speech metrics in real-time
    const now = Date.now();
    const speech = audioAnalyzerRef.current.finalize(now);
    const b = buffersRef.current;
    if (phase === 'answering') {
      b.wpmArr.push(speech.wpm);
      b.fillerCount = speech.fillerCount;
      b.pitchVariance = speech.pitchVariance;
      b.loudnessVariance = speech.loudnessVariance;
      b.sentiment = speech.sentiment;
      
      const tSeconds = (performance.now() - answerStartRef.current) / 1000;
      pushCoachTick(tSeconds, { wpm: speech.wpm, fillerCount: speech.fillerCount });
    }
  }, [phase, pushCoachTick]);

  // ── Start answering: open mic + webcam pipelines ───────────────────────────
  const startAnswering = useCallback(async () => {
    setErrorMessage('');
    setLastFeedback(null);
    buffersRef.current = emptyBuffers();
    coachRef.current.reset();
    visionAnalyzerRef.current.reset();
    setTimeline([]);
    setActiveCues([]);
    liveSnapshotRef.current = {
      wpm: 0,
      fillerCount: 0,
      eyeContact: 100,
      postureDistortion: false,
      emotion: 'neutral',
      composure: 100,
    };
    transcriptRef.current = '';
    answerStartRef.current = performance.now();
    audioAnalyzerRef.current.start(Date.now());

    // Microphone → WebAudio AnalyserNode (numeric features only).
    try {
      const constraints = selectedMicId
        ? { audio: { deviceId: { ideal: selectedMicId } } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !micMuted;
      });
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Record the answer audio for authoritative Groq Whisper transcription on submit.
      audioChunksRef.current = [];
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const mime =
        preferred.find(
          (m) =>
            typeof MediaRecorder !== 'undefined' &&
            typeof MediaRecorder.isTypeSupported === 'function' &&
            MediaRecorder.isTypeSupported(m),
        ) ?? '';
      recordMimeRef.current = mime || 'audio/webm';
      try {
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start(1000); // collect in 1s chunks
        mediaRecorderRef.current = recorder;
      } catch {
        // MediaRecorder unsupported — fall back to the Web Speech transcript only.
        mediaRecorderRef.current = null;
      }
    } catch (err: any) {
      console.error('[Audio error]:', err);
      const msg = err.name === 'NotReadableError'
        ? 'Microphone is already in use by another application. Please close other apps and try again.'
        : 'Microphone access is required to answer. Please check browser permissions.';
      setErrorMessage(msg);
      setPhase('error');
      return;
    }

    // Web Speech API → live transcript + WPM/filler metrics.
    const recognition = getSpeechRecognition();
    if (recognition) {
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onspeechstart = () => console.log('[interview] Speech detected');
      recognition.onspeechend = () => console.log('[interview] Speech ended');
      recognition.onstart = () => console.log('[interview] Recognition engine started');
      recognition.onresult = (e: SpeechRecognitionEventLike) => {
        let full = '';
        for (let i = 0; i < e.results.length; i++) {
          const part = e.results[i][0].transcript;
          if (part) full += part + ' ';
        }
        const text = full.trim();
        if (text) {
          console.log('[interview] Transcript update:', text);
          transcriptRef.current = text;
          setLiveTranscriptDisplay(text);
        }
        
        const now = Date.now();
        audioAnalyzerRef.current.ingestTranscript(text, now);
        const speech = audioAnalyzerRef.current.finalize(now);
        const b = buffersRef.current;
        b.wpmArr.push(speech.wpm);
        b.fillerCount = speech.fillerCount;
        b.pitchVariance = speech.pitchVariance;
        b.loudnessVariance = speech.loudnessVariance;
        b.sentiment = speech.sentiment;
        const tSeconds = (performance.now() - answerStartRef.current) / 1000;
        pushCoachTick(tSeconds, { wpm: speech.wpm, fillerCount: speech.fillerCount });
      };
      recognition.onerror = (event: any) => {
        console.error('[interview] Web Speech Recognition error:', event.error);
        /* transient recognition error — keep capturing */
      };
      recognition.onend = () => {
        if (phaseRef.current === 'answering') {
          try {
            recognition.start();
            console.log('[interview] Web Speech Recognition auto-restarted after end event');
          } catch (err) {
            console.error('[interview] Web Speech Recognition failed to auto-restart:', err);
          }
        } else {
          console.log('[interview] Recognition engine ended naturally');
        }
      };
      try {
        recognition.start();
        recognitionRef.current = recognition;
        console.log('[interview] Web Speech Recognition started');
      } catch (err) {
        console.error('[interview] Web Speech Recognition start failed:', err);
      }
    }

    // MediaPipe vision pipeline + per-interval frame analysis.
    try {
      await ensureLandmarkers();
    } catch {
      // Vision is best-effort; audio coaching still works without it.
      setErrorMessage('Vision analysis unavailable — continuing with audio coaching only.');
    }
    if (visionTimerRef.current) clearInterval(visionTimerRef.current);
    visionTimerRef.current = setInterval(() => {
      analyzeFrameRef.current();
      sampleAudioRef.current();
    }, VISION_INTERVAL_MS);

    setPhase('answering');
  }, [ensureLandmarkers, micMuted]);

  // ── Stop the answer audio recording and return the captured blob ───────────
  const finalizeRecording = useCallback((): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return Promise.resolve(null);
    return new Promise((resolve) => {
      const finish = () => {
        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          resolve(null);
          return;
        }
        resolve(new Blob(chunks, { type: recordMimeRef.current }));
      };
      recorder.onstop = finish;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
        else finish();
      } catch {
        finish();
      }
      mediaRecorderRef.current = null;
    });
  }, []);

  // ── Tear down the capture pipeline ─────────────────────────────────────────
  const stopCapture = useCallback(() => {
    if (visionTimerRef.current) {
      clearInterval(visionTimerRef.current);
      visionTimerRef.current = null;
    }
    if (recognitionRef.current) {
      // Detach handlers BEFORE stop() so any in-flight Web Speech results that the
      // browser fires after the stop call cannot overwrite transcriptRef — by the
      // time submitAnswer reaches the Whisper override, this handler is silent.
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
      } catch {
        /* ignore — best-effort handler cleanup */
      }
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    analyzeFrameRef.current = analyzeFrame;
    sampleAudioRef.current = sampleAudio;
    stopCaptureRef.current = stopCapture;
  }, [analyzeFrame, sampleAudio, stopCapture]);

  // Clean up on unmount.
  useEffect(() => () => stopCaptureRef.current(), []);

  // ── Submit: enter review phase first, then post to /answer ──────────────────
  const startReview = useCallback(async () => {
    setPhase('submitting'); // Briefly show evaluating while transcribing

    // Stop recording and stream teardown
    await finalizeRecording();
    stopCapture();

    // Use browser-native offline transcription
    const text = transcriptRef.current.trim();
    setOriginalTranscript(text);
    setLiveTranscriptDisplay(text);
    setHistory([text]);
    setHistoryIndex(0);
    setPhase('reviewing');
    setReviewSecondsLeft(180);
    setReviewTimerActive(true);
    setEditError(null);
    setEditErrorStats({ diffCount: 0, limit: Math.ceil(getWordCount(text) * 0.3), percent: 0 });
    reviewStartTimeRef.current = Date.now();

    // Upfront notification about the 30% limit
    setErrorMessage('Review Phase: You have 3 minutes to fix transcription errors. You can edit up to 30% of the words.');
    setTimeout(() => setErrorMessage(''), 8000);
  }, [finalizeRecording, stopCapture]);

  const finalSubmitAnswer = useCallback(async () => {
    const editCheck = validateEditLimit(liveTranscriptDisplay, originalTranscript);
    if (!editCheck.valid) {
      setEditError(
        `Review limit exceeded: You've modified ${editCheck.percent}% of the words. ` +
        `The limit is 30% (${editCheck.limit} words). Please revert some edits to continue.`
      );
      return;
    }

    setPhase('submitting');
    setReviewTimerActive(false);
    if (reviewStartTimeRef.current) {
      setTotalPausedMs((prev) => prev + (Date.now() - reviewStartTimeRef.current!));
      reviewStartTimeRef.current = null;
    }

    // Finalize the audio analyzer against the POTENTIALLY EDITED text.
    audioAnalyzerRef.current.ingestTranscript(liveTranscriptDisplay, Date.now());
    const speech = audioAnalyzerRef.current.finalize(Date.now());
    const b = buffersRef.current;
    b.wpmArr.push(speech.wpm);
    b.fillerCount = speech.fillerCount;
    b.sentiment = speech.sentiment;

    const built = buildAnswerPayload(questionIndex, liveTranscriptDisplay, buffersRef.current);
    if (!built.ok) {
      setErrorMessage(`Could not aggregate metrics: ${built.error.message}`);
      setPhase('error');
      return;
    }

    try {
      const res = await fetch(`/api/interview/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.value),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data?.message ?? data?.error ?? 'Failed to submit answer');
        setPhase('error');
        return;
      }

      setLastFeedback(data.feedback ?? null);

      if (data.complete || data.nextQuestion === null) {
        stopCapture();
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setShowEndPopup(true);
        setPhase('complete');
        return;
      }

      setQuestionText(data.nextQuestion ?? '');
      setQuestionIndex(typeof data.index === 'number' ? data.index : questionIndex + 1);
      if (data.difficulty) setDifficulty(data.difficulty);
      if (data.total) setTotalQuestions(data.total);
      if (data.role) setRole(data.role);
      if (data.aiPersona) setAiPersona(data.aiPersona);
      if (data.tags) setTags(data.tags);
      setLiveMetrics({
        wpm: 0,
        pace: 'normal',
        fillerCount: 0,
        eyeContact: 100,
        composure: 100,
        postureDistortion: false,
        emotion: 'neutral',
      });
      setActiveCues([]);
      setLiveTranscriptDisplay('');
      setPhase('idle');
      if (data.nextQuestion) playTts(data.nextQuestion);
    } catch {
      setErrorMessage('Network error submitting your answer.');
      setPhase('error');
    }
  }, [
    liveTranscriptDisplay,
    originalTranscript,
    validateEditLimit,
    questionIndex,
    sessionId,
    stopCapture,
    playTts,
  ]);

  // Automatically submit answer when review timer reaches 0
  useEffect(() => {
    if (reviewTimerActive && reviewSecondsLeft === 0) {
      finalSubmitAnswer();
    }
  }, [reviewTimerActive, reviewSecondsLeft, finalSubmitAnswer]);

  const skipQuestion = useCallback(async () => {
    setPhase('submitting');
    stopCapture();

    const built = buildAnswerPayload(
      questionIndex,
      "Candidate skipped this question.",
      {
        wpmArr: [],
        fillerCount: 0,
        eyeContactArr: [],
        postureArr: [],
        pitchVariance: 0,
        loudnessVariance: 0,
        sentiment: 0,
        dominantEmotion: 'neutral',
        composure: 100,
      }
    );

    if (!built.ok) {
      setErrorMessage(`Could not aggregate metrics: ${built.error.message}`);
      setPhase('error');
      return;
    }

    try {
      const res = await fetch(`/api/interview/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.value),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data?.message ?? data?.error ?? 'Failed to skip question');
        setPhase('error');
        return;
      }

      setLastFeedback(data.feedback ?? null);

      if (data.complete || data.nextQuestion === null) {
        stopCapture();
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        setShowEndPopup(true);
        setPhase('complete');
        return;
      }

      // Advance to the next question and reset the live UI.
      setQuestionText(data.nextQuestion ?? '');
      setQuestionIndex(typeof data.index === 'number' ? data.index : questionIndex + 1);
      if (data.difficulty) setDifficulty(data.difficulty);
      if (data.total) setTotalQuestions(data.total);
      if (data.role) setRole(data.role);
      if (data.aiPersona) setAiPersona(data.aiPersona);
      if (data.tags) setTags(data.tags);
      setLiveMetrics({
        wpm: 0,
        pace: 'normal',
        fillerCount: 0,
        eyeContact: 100,
        composure: 100,
        postureDistortion: false,
        emotion: 'neutral',
      });
      setActiveCues([]);
      setLiveTranscriptDisplay('');
      setPhase('idle');
      // Play TTS for the new question.
      if (data.nextQuestion) playTts(data.nextQuestion);
    } catch {
      setErrorMessage('Network error skipping question.');
      setPhase('error');
    }
  }, [questionIndex, sessionId, stopCapture, playTts]);

  // ── End the interview early ────────────────────────────────────────────────
  // ── End the interview (lockdown-aware) ─────────────────────────────────────
  // Unified terminator used by both the explicit "End interview" button (via the
  // leave modal confirmation) AND every escape attempt the lockdown traps (back
  // button, sidebar link, logout). Posts to /end so the attempt is recorded as a
  // completed session (preventing abandon-and-restart fake-attempt loops), then
  // routes per `pendingPath`:
  //  • 'LOGOUT'  → log out and go to the public root
  //  • specific path → router.push(path)        (sidebar destination preserved)
  //  • null      → /report (default — view the report for what was answered)
  const handleAutoEnd = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    stopCapture();
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    try {
      await fetch(`/api/interview/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'candidate_exit' }),
      });
    } catch {
      /* best-effort — server-side time cap will still finalize on the next resume */
    }
    // Release the lockdown flag before navigating so the destination route doesn't
    // see a stale active-session signal.
    if (typeof window !== 'undefined') {
      (window as unknown as { __ACTIVE_INTERVIEW_SESSION?: boolean }).__ACTIVE_INTERVIEW_SESSION = false;
    }
    if (pendingPath === 'LOGOUT') {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        /* best-effort */
      }
      router.push('/');
      router.refresh();
    } else if (pendingPath) {
      router.push(pendingPath);
    } else {
      router.push(`/dashboard/${portalType}/interview/${sessionId}/report`);
    }
  }, [ending, pendingPath, router, sessionId, stopCapture]);

  /** Surface the leave-confirmation modal — triggered by the explicit End button. */
  const requestEndInterview = useCallback(() => {
    setPendingPath(null);
    setShowLeaveModal(true);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted">
          <LoaderCircle className="w-5 h-5 animate-spin" />
          Loading your interview…
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    if (completedReportStatus === 'pending') {
      return (
        <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 relative">
          <AmbientGlow color="amber" size="xl" position="center" />
          <div className="glass-card p-10 max-w-md text-center border-amber-500/20 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-500" />
            <LoaderCircle className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-3 animate-pulse">Compiling Report</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Your Confidence Index report is being generated using AI behavior analysis. This will take just a moment…
            </p>
          </div>
        </div>
      );
    }

    if (completedReportStatus === 'failed') {
      return (
        <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 relative">
          <AmbientGlow color="red" size="xl" position="center" />
          <div className="glass-card p-10 max-w-md text-center border-red-500/20 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500" />
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-3">Compilation Failed</h1>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              Something went wrong while generating your Confidence Index report.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/${portalType}/interview`)}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl"
            >
              Back to Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    if (completedReportStatus === 'ready' && completedReport) {
      const ci = Math.round(completedReport.ciScore);
      const contentScore = Math.round(completedReport.categoryScores.technicalAccuracy);
      const voiceScore = Math.round(completedReport.categoryScores.voiceCi);
      const visualScore = Math.round(completedReport.categoryScores.bodyCi);
      const sessionDisplayId = completedReport.sessionId.slice(-3).toUpperCase();
      
      const durSec = completedReport.durationSeconds || 0;
      const mm = Math.floor(durSec / 60);
      const ss = durSec % 60;
      const durationStr = `${mm}:${String(ss).padStart(2, '0')}`;

      return (
        <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4 md:p-6 relative">
          <AmbientGlow color="amber" size="xl" position="center" />
          <div className="w-full max-w-2xl bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 md:p-8 text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-black relative">
              <div className="flex items-center justify-center rounded-full border-2 border-black/85 p-1">
                <Check className="w-5 h-5 stroke-[3.5]" />
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wide">
              Session Ended
            </h1>
            <p className="text-zinc-400 mt-1.5 text-xs md:text-sm">
              Great job. Here is your session summary.
            </p>
            <p className="text-[10px] text-zinc-500 mt-1 tracking-widest font-mono uppercase">
              SESSION ID: S-{sessionDisplayId}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6">
              <div className="bg-[#161826]/70 border border-white/[0.03] rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-inner group hover:border-amber-500/20 transition-all duration-300">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2">
                  <Target className="w-4 h-4" />
                </div>
                <span className="text-3xl font-extrabold text-white tracking-tight">
                  {ci}
                </span>
                <span className="text-[10px] text-zinc-400 mt-1.5 font-medium tracking-wide uppercase">
                  CI Score
                </span>
              </div>

              <div className="bg-[#161826]/70 border border-white/[0.03] rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-inner group hover:border-teal-500/20 transition-all duration-300">
                <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 mb-2">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-3xl font-extrabold text-white tracking-tight">
                  {contentScore}%
                </span>
                <span className="text-[10px] text-zinc-400 mt-1.5 font-medium tracking-wide uppercase">
                  Content
                </span>
              </div>

              <div className="bg-[#161826]/70 border border-white/[0.03] rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-inner group hover:border-amber-500/20 transition-all duration-300">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2">
                  <Mic className="w-4 h-4" />
                </div>
                <span className="text-3xl font-extrabold text-white tracking-tight">
                  {voiceScore}%
                </span>
                <span className="text-[10px] text-zinc-400 mt-1.5 font-medium tracking-wide uppercase">
                  Voice
                </span>
              </div>

              <div className="bg-[#161826]/70 border border-white/[0.03] rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-inner group hover:border-teal-500/20 transition-all duration-300">
                <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 mb-2">
                  <Eye className="w-4 h-4" />
                </div>
                <span className="text-3xl font-extrabold text-white tracking-tight">
                  {visualScore}%
                </span>
                <span className="text-[10px] text-zinc-400 mt-1.5 font-medium tracking-wide uppercase">
                  Visual
                </span>
              </div>
            </div>

            <p className="text-zinc-500 text-xs mt-6 font-medium">
              Duration: {durationStr} &middot; {completedReport.questionsAnswered || 0}/{completedReport.totalQuestions || 0} questions answered
            </p>

            <div className="flex flex-row justify-center items-center gap-3 mt-6">
              <button
                onClick={() => router.push(`/dashboard/${portalType}`)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.02] text-white hover:bg-white/[0.06] active:scale-95 transition-all duration-200 text-xs font-semibold cursor-pointer shadow-md"
              >
                <Home className="w-3.5 h-3.5 text-zinc-400" />
                Dashboard
              </button>
              <button
                onClick={() => router.push(`/dashboard/${portalType}/interview/${sessionId}/report`)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 text-black hover:bg-amber-600 active:scale-95 transition-all duration-200 text-xs font-semibold cursor-pointer shadow-md"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Full Report
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // ── Consent gate (Interview Lockdown Protocol) ─────────────────────────────
  // Same pattern as the Exam Lockdown — the candidate cannot reach the live session
  // UI without explicitly accepting that any escape attempt counts as a completed
  // attempt. This is what stops fake/abandoned attempts: after consent the page is
  // locked (back button, sidebar, refresh, copy, right-click, selection) until the
  // session ends naturally OR the candidate confirms via the leave modal — both
  // routes finalize via /api/interview/[sessionId]/end so the attempt is recorded.
  if (!hasConsented && !errorMessage) {
    return (
      <>
        <div className="fixed inset-0 z-[100] bg-[#0a0a0b] flex items-center justify-center p-4">
          <AmbientGlow color="amber" size="xl" position="center" />
          <div className="w-full max-w-[60vw] max-h-[80vh] flex animate-in zoom-in-95 duration-300">
            <GlassCard className="border-amber-500/30 overflow-y-auto relative flex flex-col w-full max-h-[80vh]" padding="lg">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500" />

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Shield size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    Interview Lockdown Protocol
                  </h2>
                  <p className="text-amber-500/80 text-sm font-semibold uppercase tracking-wider">
                    Mandatory Consent Required
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-8 text-[#a1a1aa]">
                {permissionError && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                    <TriangleAlert className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{permissionError}</p>
                  </div>
                )}
                
                <div className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="mt-1 p-1 rounded-md bg-amber-500/20 text-amber-500">
                    <Video size={14} />
                  </div>
                  <p className="text-sm">
                    <span className="text-white font-medium">Hardware Access:</span>{' '}
                    This interview requires active camera and microphone access for behavioral
                    analysis. Permissions will be requested upon clicking start.
                  </p>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="mt-1 p-1 rounded-md bg-amber-500/20 text-amber-500">
                    <Clock size={14} />
                  </div>
                  <p className="text-sm">
                    <span className="text-white font-medium">Session Locked:</span>{' '}
                    Once you start, you cannot navigate away. The browser back button and
                    sidebar links will be disabled for the duration of the interview.
                  </p>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="mt-1 p-1 rounded-md bg-amber-500/20 text-amber-500">
                    <AlertCircle size={14} />
                  </div>
                  <p className="text-sm">
                    <span className="text-white font-medium">Auto-Submission:</span>{' '}
                    Attempting to exit, sign out, or refresh will result in{' '}
                    <span className="text-amber-400 font-bold uppercase">
                      Immediate End of the Interview
                    </span>
                    . Whatever you have answered will be scored — the rest of the time
                    is forfeit and this attempt will be counted in your history.
                  </p>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="mt-1 p-1 rounded-md bg-amber-500/20 text-amber-500">
                    <X size={14} />
                  </div>
                  <p className="text-sm">
                    <span className="text-white font-medium">Anti-Cheat Enabled:</span>{' '}
                    Text selection, copying, and right-click menus are disabled to keep
                    the interview honest.
                  </p>
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
                  I understand that this is a timed, locked session. I agree that any
                  attempt to leave, refresh, or sign out will count as a completed
                  attempt and end the interview automatically.
                </span>
              </label>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => router.push(`/dashboard/${portalType}/interview`)}
                >
                  Back to Setup
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  disabled={!consentChecked || requestingPermissions}
                  className="bg-amber-500 hover:bg-amber-600 text-black border-none font-bold disabled:opacity-50"
                  onClick={handleStartInterview}
                  icon={
                    requestingPermissions ? (
                      <LoaderCircle className="animate-spin" size={18} />
                    ) : (
                      <ArrowRight size={18} />
                    )
                  }
                >
                  {requestingPermissions ? 'Verifying Hardware...' : 'Start Interview Now'}
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>
        {showHardwareCheck && (
          <HardwareCheck 
            onPass={handleHardwarePass} 
            onCancel={() => {
              setShowHardwareCheck(false);
              setHasConsented(false);
            }} 
          />
        )}
      </>
    );
  }

  const activeStageName =
    questionIndex === 0
      ? 'Introduction'
      : questionIndex === 1
        ? 'Profile Follow-up'
        : questionIndex >= 2 && questionIndex <= 4
          ? 'Domain Core Inquiry'
          : 'Dynamic Deep-Dive';

  const DIFFICULTIES_MAP = ['Beginner', 'Easy', 'Intermediate', 'Advanced', 'Expert'];
  const difficultyLabel = DIFFICULTIES_MAP[difficulty - 1] || 'Intermediate';

  const voiceClarity = Math.max(
    50,
    Math.min(
      100,
      Math.round(
        100 -
          liveMetrics.fillerCount * 4 -
          (liveMetrics.pace !== 'normal' ? 12 : 0) -
          (phase === 'answering' && questionElapsedSeconds > 3 && liveMetrics.wpm === 0 ? 30 : 0)
      )
    )
  );
  const engagement = Math.max(40, Math.min(100, Math.round((liveMetrics.eyeContact * 0.6) + (liveMetrics.composure * 0.4) - (liveMetrics.postureDistortion ? 10 : 0))));

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Top Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap bg-[#111113]/40 border border-white/5 rounded-2xl p-4 backdrop-blur-md">
          {/* Left indicators */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Recording pill */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 ${
              phase === 'answering'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-white/5 border-white/10 text-zinc-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                phase === 'answering' ? 'bg-red-500 animate-pulse' : 'bg-zinc-500'
              }`} />
              <span>{phase === 'answering' ? 'Recording' : 'Ready'}</span>
            </div>

            {/* Target Role Badge */}
            {role && (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-orange-500/10 border border-orange-500/20 text-orange-400">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Role:</span>
                <span>{role}</span>
              </div>
            )}

            {/* Question Elapsed Timer Pill */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-white font-mono">
              <span>{String(Math.floor(Math.floor(questionElapsedSeconds) / 60)).padStart(2, '0')}:</span>
              <span>{String(Math.floor(questionElapsedSeconds) % 60).padStart(2, '0')}</span>
            </div>

            {/* Session Remaining Timer Pill */}
            {durationMinutes > 0 && (
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-white font-mono">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  {String(Math.floor(Math.floor(remainingSeconds) / 60)).padStart(2, '0')}:
                  {String(Math.floor(remainingSeconds) % 60).padStart(2, '0')}
                </span>
              </div>
            )}

            {/* Difficulty Badge Pill */}
            <div className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-teal-500/10 border border-teal-500/20 text-teal-400">
              {difficultyLabel}
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Webcam Selector Dropdown */}
            {webcams.length > 0 && (
              <div className="relative flex items-center">
                <Video size={14} className="absolute left-3 text-zinc-400 pointer-events-none" />
                <select
                  value={selectedWebcamId}
                  onChange={(e) => changeWebcam(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-white/5 bg-[#111113] text-zinc-300 text-xs font-semibold outline-none focus:border-orange-500/30 focus:bg-white/[0.06] transition-colors appearance-none cursor-pointer max-w-[140px]"
                >
                  {webcams.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `Camera ${webcams.indexOf(cam) + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Mic Selector Dropdown */}
            {microphones.length > 0 && (
              <div className="relative flex items-center">
                <Mic size={14} className="absolute left-3 text-zinc-400 pointer-events-none" />
                <select
                  value={selectedMicId}
                  onChange={(e) => changeMic(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-white/5 bg-[#111113] text-zinc-300 text-xs font-semibold outline-none focus:border-orange-500/30 focus:bg-white/[0.06] transition-colors appearance-none cursor-pointer max-w-[140px]"
                >
                  {microphones.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || `Microphone ${microphones.indexOf(mic) + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Mic Toggle Button */}
            <button
              type="button"
              onClick={toggleMic}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors hover:bg-white/10 ${
                micMuted
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-white/10 bg-white/5 text-zinc-300'
              }`}
              title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>



            {/* End Session Button */}
            <button
              type="button"
              onClick={requestEndInterview}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all shadow-lg shadow-red-950/20"
            >
              <X size={16} />
              End Session
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (Webcam, Live Analysis, Questions Checklist) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Webcam Preview Card */}
            <div className="glass-card p-2 relative overflow-hidden">
              <div className="relative rounded-xl overflow-hidden bg-black/40 aspect-video">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  mirrored
                  screenshotFormat="image/jpeg"
                  videoConstraints={
                    selectedWebcamId
                      ? { deviceId: { ideal: selectedWebcamId } }
                      : { facingMode: 'user' }
                  }
                  onUserMedia={(stream) => {
                    stream.getVideoTracks().forEach((track) => {
                      track.enabled = !cameraMuted;
                    });
                  }}
                  onUserMediaError={(err: any) => {
                    console.error('[Webcam Error]:', err);
                    const msg = err.name === 'NotReadableError' || err.message?.includes('Could not start video source')
                      ? 'Webcam is already in use by another application (e.g. Zoom, Teams, or another tab). Please close other apps and try again.'
                      : err.name === 'OverconstrainedError'
                      ? 'The selected camera does not support the requested configuration. Please select a different camera in your profile.'
                      : err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
                      ? 'Webcam access was denied. Please allow camera permissions in your browser settings.'
                      : 'Could not start video source. Please check your camera connection and browser permissions.';
                    setErrorMessage(msg);
                    setPhase('error');
                  }}
                  className="w-full h-full object-cover"
                />
                
                {/* Flashing RED REC overlay badge */}
                {phase === 'answering' && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/50 text-[10px] uppercase font-bold text-red-500 tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                    REC
                  </div>
                )}

                {cameraMuted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0b]/90">
                    <span className="flex items-center gap-2 text-sm text-zinc-400">
                      <VideoOff className="w-5 h-5 text-red-400" />
                      Camera feed disabled
                    </span>
                  </div>
                )}

                {/* HUD Alignment Guide Overlay (Helping lines for posture and eye contact) */}
                {!cameraMuted && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                    <div 
                      className={`w-32 h-40 rounded-[50%] border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center ${
                        !liveMetrics.postureDistortion && liveMetrics.eyeContact >= 70
                          ? 'border-emerald-500/50 bg-emerald-500/[0.02] shadow-[0_0_12px_rgba(16,185,129,0.12)]'
                          : 'border-red-500/50 bg-red-500/[0.02] shadow-[0_0_12px_rgba(239,68,68,0.12)]'
                      }`}
                    >
                      <span className={`text-[7px] uppercase tracking-widest font-black ${
                        !liveMetrics.postureDistortion && liveMetrics.eyeContact >= 70
                          ? 'text-emerald-400/80'
                          : 'text-red-400/80'
                      }`}>
                        {!liveMetrics.postureDistortion && liveMetrics.eyeContact >= 70 ? 'Aligned' : 'Align Posture'}
                      </span>
                    </div>

                    <div className="absolute bottom-1 w-full px-8 flex justify-between">
                      <div className={`w-12 h-0.5 border-t border-dashed transition-colors duration-500 ${
                        !liveMetrics.postureDistortion ? 'border-emerald-500/40' : 'border-red-500/40'
                      }`} />
                      <div className={`w-12 h-0.5 border-t border-dashed transition-colors duration-500 ${
                        !liveMetrics.postureDistortion ? 'border-emerald-500/40' : 'border-red-500/40'
                      }`} />
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-center">
                <CueOverlay cues={activeCues} />
              </div>
            </div>

            {/* Live Analysis Card */}
            <div className="glass-card p-5 space-y-4">
              <h4 className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Live Analysis</h4>
              <div className="space-y-4">
                {/* Confidence Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-zinc-400">Confidence</span>
                    <span className="text-orange-400 font-mono">{liveMetrics.composure}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                      style={{ width: `${liveMetrics.composure}%` }}
                    />
                  </div>
                </div>

                {/* Eye Contact Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-zinc-400">Eye Contact</span>
                    <span className="text-cyan-400 font-mono">{liveMetrics.eyeContact}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-300"
                      style={{ width: `${liveMetrics.eyeContact}%` }}
                    />
                  </div>
                </div>

                {/* Voice Clarity Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-zinc-400">Voice Clarity</span>
                    <span className="text-orange-400 font-mono">{voiceClarity}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                      style={{ width: `${voiceClarity}%` }}
                    />
                  </div>
                </div>

                {/* Engagement Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-zinc-400">Engagement</span>
                    <span className="text-cyan-400 font-mono">{engagement}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-300"
                      style={{ width: `${engagement}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>



          </div>

          {/* Right Column (Question Card, Answer Editor Card, Feedback Card) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Question Text Card */}
            <div className="glass-card p-6 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md">
                  {activeStageName}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  Time Remaining: {String(Math.floor(Math.floor(remainingSeconds) / 60)).padStart(2, '0')}:
                  {String(Math.floor(remainingSeconds) % 60).padStart(2, '0')}
                </span>
              </div>
              
              <p className="text-lg md:text-xl font-bold text-white leading-relaxed mt-4">
                {questionText || 'Preparing your question…'}
              </p>
            </div>

            {/* Your Answer / Editor Card */}
            <div className="glass-card p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold tracking-wider text-zinc-500">Your Answer</span>
                    {phase === 'reviewing' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={undo}
                          disabled={historyIndex <= 0}
                          className="p-1 rounded bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Undo (Ctrl+Z)"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        </button>
                        <button
                          onClick={redo}
                          disabled={historyIndex >= history.length - 1}
                          className="p-1 rounded bg-white/5 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Redo (Ctrl+Y)"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {phase === 'reviewing' && (
                    <div className="flex items-center gap-2 text-xs">
                      <Timer size={14} className="text-orange-400" />
                      <span className="text-orange-400 font-bold">
                        Reviewing: {Math.floor(Math.floor(reviewSecondsLeft) / 60)}:{String(Math.floor(reviewSecondsLeft) % 60).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      phase === 'answering' ? 'bg-amber-500 animate-pulse' : phase === 'reviewing' ? 'bg-orange-500' : 'bg-zinc-600'
                    }`} />
                    <span>{phase === 'answering' ? 'Voice ready' : phase === 'reviewing' ? 'Edit Mode' : 'Voice idle'}</span>
                    <span className="text-zinc-600 font-bold">·</span>
                    <span>{getWordCount(liveTranscriptDisplay)} words</span>
                  </div>
                  {phase === 'reviewing' && (
                    <div className={`text-[10px] font-bold uppercase tracking-tight ${editStats.percent > 30 ? 'text-red-400' : 'text-orange-400/80'}`}>
                      Edits: {editStats.percent}% / 30% ({editStats.diffCount} / {editStats.limit} words)
                    </div>
                  )}
                </div>
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{editError}</p>
                </div>
              )}

              <textarea
                value={phase === 'answering' && !liveTranscriptDisplay ? 'Listening for your voice...' : liveTranscriptDisplay}
                onChange={(e) => {
                  if (phase === 'reviewing') {
                    const newText = e.target.value;
                    setLiveTranscriptDisplay(newText);
                    transcriptRef.current = newText;
                    setEditError(null);
                    
                    // Live edit stats update
                    const stats = validateEditLimit(newText, originalTranscript);
                    setEditErrorStats(stats);

                    // Push to history for undo/redo
                    pushToHistory(newText);
                  }
                }}
                onCopy={(e) => { if (phase === 'answering') e.preventDefault(); }}
                onCut={(e) => { if (phase === 'answering') e.preventDefault(); }}
                onPaste={(e) => { if (phase === 'answering') e.preventDefault(); }}
                onSelect={(e) => { if (phase === 'answering') e.preventDefault(); }}
                onContextMenu={(e) => { if (phase === 'answering') e.preventDefault(); }}
                onKeyDown={(e) => {
                  if (phase === 'answering') {
                    if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }
                  // Standard Undo/Redo key bindings for the textarea
                  if (phase === 'reviewing') {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                      e.preventDefault();
                      undo();
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                      e.preventDefault();
                      redo();
                    }
                  }
                }}
                placeholder={phase === 'reviewing' ? "Edit your response to fix transcription errors (max 30% words)..." : "Your spoken answer will appear here..."}
                readOnly={phase === 'answering'}
                disabled={['idle', 'submitting', 'complete', 'error'].includes(phase)}
                className={`w-full min-h-[300px] bg-transparent border rounded-2xl p-4 text-base leading-relaxed placeholder-zinc-700 focus:outline-none transition-all resize-none font-sans ${
                  phase === 'answering' ? 'border-white/5 cursor-default italic text-zinc-500' : 
                  phase === 'reviewing' ? 'border-orange-500/30 ring-1 ring-orange-500/10 text-white' : 
                  'border-white/5 text-white'
                }`}
              />

              {phase === 'idle' && typeof window !== 'undefined' && !getSpeechRecognition() && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] uppercase font-bold flex items-center gap-2">
                  <AlertCircle size={14} />
                  Browser Voice recognition not supported. High-fidelity Whisper STT will still be used after submission.
                </div>
              )}

              <div className="flex items-center justify-end gap-4 mt-2">
                {phase === 'idle' ? (
                  <button
                    type="button"
                    onClick={startAnswering}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-orange-500 to-amber-500 text-black flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-orange-950/20"
                  >
                    <Mic size={16} />
                    Start Answering
                  </button>
                ) : phase === 'submitting' ? (
                  <button
                    disabled
                    type="button"
                    className="px-5 py-2.5 rounded-xl font-bold text-sm bg-zinc-800 text-zinc-500 flex items-center gap-1.5 opacity-60"
                  >
                    <LoaderCircle size={16} className="animate-spin" />
                    Processing...
                  </button>
                ) : phase === 'reviewing' ? (
                  <button
                    type="button"
                    onClick={finalSubmitAnswer}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm bg-teal-500 text-black flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-teal-950/20"
                  >
                    <CheckCircle2 size={16} />
                    {questionIndex + 1 === totalQuestions ? 'Save & Submit Interview' : 'Finish Review & Submit'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startReview}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-orange-500 to-amber-500 text-black flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-orange-950/20"
                  >
                    <span>Stop & Review</span>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Last feedback (per-turn) */}
            {lastFeedback && (
              <div className="glass-card p-6 space-y-4">
                <h4 className="text-white font-semibold text-sm">Feedback on your last answer</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <ScoreStat label="Technical" value={lastFeedback.technicalAccuracy} />
                  <ScoreStat label="Communication" value={lastFeedback.communication} />
                  <ScoreStat label="Voice" value={lastFeedback.voiceCi} />
                  <ScoreStat label="Body language" value={lastFeedback.bodyCi} />
                </div>
                
                {lastFeedback.strengths.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-teal-400 font-bold">Strengths</p>
                    <ul className="list-disc list-inside text-sm text-zinc-300 space-y-0.5">
                      {lastFeedback.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {lastFeedback.improvements.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-amber-400 font-bold">Improvements</p>
                    <ul className="list-disc list-inside text-sm text-zinc-300 space-y-0.5">
                      {lastFeedback.improvements.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Hardware Check Layer */}
      {showHardwareCheck && (
        <HardwareCheck 
          onPass={handleHardwarePass} 
          onCancel={() => {
            setShowHardwareCheck(false);
            setHasConsented(false);
          }} 
        />
      )}

      {/* End popup modal */}
      {showEndPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-8 max-w-sm text-center">
            <h2 className="text-xl font-bold text-white mb-3">
              The interviewer has ended the interview. This session is over.
            </h2>
            <button
              type="button"
              onClick={() => setShowEndPopup(false)}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl mt-4"
            >
              View Session Summary
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Camera warning countdown modal */}
      {isPausedDueToCamera && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-[#0d0d0e] shadow-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />
            
            <div className="w-24 h-24 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-6 relative group">
              <span className="absolute inset-0 rounded-2xl bg-red-500/5 animate-ping" />
              <VideoOff size={48} className="animate-pulse" />
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3 tracking-wide">
              Camera Feed Lost / Shutter Detected
            </h2>
            <p className="text-zinc-400 mb-8 text-sm leading-relaxed max-w-md mx-auto">
              We cannot detect your face. Please open your camera shutter, ensure you are fully in the video frame, and have adequate lighting.
              <strong> If you fail to fix this issue or turn on the camera within 2 minutes, your interview will be automatically finalized and submitted by the system.</strong>
            </p>

            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 mb-8 max-w-sm mx-auto">
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-400/80 block mb-1">
                Termination Countdown
              </span>
              <span className="text-5xl font-extrabold text-red-500 font-mono tracking-wider tabular-nums animate-pulse">
                {String(Math.floor(lockdownSecondsLeft / 60)).padStart(2, '0')}
                :
                {String(lockdownSecondsLeft % 60).padStart(2, '0')}
              </span>
            </div>

            <div className="text-xs text-zinc-500 flex flex-col gap-1.5 justify-center items-center">
              <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Interview Paused — time limit is currently frozen
              </span>
              <span>Position yourself in front of the camera to resume automatically.</span>
            </div>
          </div>
        </div>
      )}

      {/* Leave-attempt modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-[#111113] shadow-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />

            <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-6">
              <AlertCircle size={40} />
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">Leave Interview?</h3>
            <p className="text-[#a1a1aa] mb-8 leading-relaxed">
              Your progress will be{' '}
              <span className="text-white font-semibold">submitted automatically</span>.
              The remaining time is forfeit and this attempt will count in your interview
              history. Whatever you have answered so far will be scored.
            </p>

            <div className="space-y-3">
              <Button
                fullWidth
                size="lg"
                onClick={handleAutoEnd}
                disabled={ending}
                icon={
                  ending ? (
                    <LoaderCircle className="animate-spin" size={20} />
                  ) : (
                    <ArrowRight size={20} />
                  )
                }
                className="h-14 font-bold bg-red-500 hover:bg-red-600 text-white border-none"
              >
                {ending ? 'Submitting…' : 'Confirm & Leave'}
              </Button>
              <Button
                fullWidth
                variant="ghost"
                size="lg"
                onClick={() => {
                  setShowLeaveModal(false);
                  setPendingPath(null);
                }}
                disabled={ending}
                className="h-14"
              >
                Continue Interview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreStat({ label, value }: { label: string; value: number }) {
  const tone = value < 65 ? 'text-amber-300' : 'text-teal-300';
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{Math.round(value)}</p>
    </div>
  );
}

function formatTimestamp(tSeconds: number): string {
  const total = Math.max(0, Math.floor(tSeconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function getStageState(stageIdx: number, currentIdx: number): 'completed' | 'active' | 'upcoming' {
  if (stageIdx === 0) {
    if (currentIdx > 0) return 'completed';
    if (currentIdx === 0) return 'active';
    return 'upcoming';
  }
  if (stageIdx === 1) {
    if (currentIdx > 1) return 'completed';
    if (currentIdx === 1) return 'active';
    return 'upcoming';
  }
  if (stageIdx === 2) {
    if (currentIdx > 4) return 'completed';
    if (currentIdx >= 2 && currentIdx <= 4) return 'active';
    return 'upcoming';
  }
  if (stageIdx === 3) {
    if (currentIdx >= 5) return 'active';
    return 'upcoming';
  }
  return 'upcoming';
}
