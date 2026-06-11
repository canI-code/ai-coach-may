'use client';

import React, { useCallback, useEffect, useRef, useState, useReducer, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Loader2,
  AlertCircle,
  Trophy,
  Target,
  BookOpen,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Home,
  BarChart3,
  ChevronRight,
  Check,
  ArrowLeft,
  FileText,
  Mic,
  Eye,
  Download,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  History as HistoryIcon,
  Play,
} from 'lucide-react';
import type { PerTurnRow } from '@/lib/dashboard-suite/types';
import { pollReducer } from '@/lib/dashboard-suite/poll-machine';
import { jsPDF } from 'jspdf';
import { Button } from '@/app/components/ui/Button';
import { RadarChart } from '../../components/charts/RadarChart';
import { LineChart } from '../../components/charts/LineChart';

// ── Types and Interfaces ──

interface Resource {
  id: string;
  title: string;
  url: string;
  tags: string[];
  institutionCode?: string;
  rationale?: string;
}

interface TimelineEntry {
  tSeconds: number;
  label?: string;
  event?: string;
  severity?: 'info' | 'warning' | 'critical';
}

interface CategoryScores {
  technicalAccuracy: number;
  communication: number;
  voiceCi: number;
  bodyCi: number;
}

interface ReportPayload {
  sessionId: string;
  ciScore: number;
  categoryScores: CategoryScores;
  weaknessTags: string[];
  resources: Resource[];
  narrative: string | null;
  behavioralTimeline: TimelineEntry[];
  readyAt: string | null;
  durationSeconds?: number;
  questionsAnswered?: number;
  totalQuestions?: number;
  perTurnHistory?: PerTurnRow[];
  strengths?: string[];
  improvements?: string[];
  role?: string;
  aiPersona?: string;
}

interface ReportPollResponse {
  reportId: string;
  status: 'pending' | 'ready' | 'failed';
  report?: ReportPayload;
}

// Category mappings
const CATEGORY_LABELS: Record<keyof CategoryScores, string> = {
  technicalAccuracy: 'Technical Accuracy',
  communication: 'Communication',
  voiceCi: 'Voice Confidence',
  bodyCi: 'Body Language',
};

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 65) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald-400';
  if (score >= 65) return 'bg-amber-400';
  return 'bg-red-400';
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function calculateConsistency(turns: PerTurnRow[] | undefined): number {
  if (!turns || turns.length === 0) return 70;
  const scores = turns
    .map((turn) => {
      if (!turn.evaluation) return null;
      const ev = turn.evaluation;
      const vals = [
        ev.technicalAccuracy,
        ev.communication,
        ev.voiceCi,
        ev.bodyCi,
      ].filter((v): v is number => v !== undefined && v !== null);
      if (vals.length === 0) return null;
      return vals.reduce((sum, v) => sum + v, 0) / vals.length;
    })
    .filter((v): v is number => v !== null);

  if (scores.length <= 1) return 80;

  const mean = scores.reduce((sum, v) => sum + v, 0) / scores.length;
  const variance = scores.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  const consistencyScore = Math.max(0, Math.min(100, 100 - stdDev * 2.5));
  return Math.round(consistencyScore);
}

function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

const TOPIC_IMAGES: Record<string, string> = {
  'Algorithms': 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&auto=format&fit=crop&q=60',
  'Data Structures': 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&auto=format&fit=crop&q=60',
  'System Design': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&auto=format&fit=crop&q=60',
  'Cloud Computing': 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&auto=format&fit=crop&q=60',
  'Python': 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400&auto=format&fit=crop&q=60',
  'Java': 'https://images.unsplash.com/photo-1521791136368-1a86a7c9a385?w=400&auto=format&fit=crop&q=60',
  'JavaScript': 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&auto=format&fit=crop&q=60',
  'C++': 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=400&auto=format&fit=crop&q=60',
  'VLSI': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&auto=format&fit=crop&q=60',
  'Embedded Systems': 'https://images.unsplash.com/photo-1553406830-ef25136706e6?w=400&auto=format&fit=crop&q=60',
  'Computer Networks': 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&auto=format&fit=crop&q=60',
  'Software Engineering': 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&auto=format&fit=crop&q=60',
  'Communication & STAR': 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&auto=format&fit=crop&q=60',
  'Visual Presence & Posture': 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&auto=format&fit=crop&q=60',
  'Voice Control & Fluency': 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&auto=format&fit=crop&q=60',
  'Reasoning & Logic': 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400&auto=format&fit=crop&q=60',
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&auto=format&fit=crop&q=60';

function classifyPoint(text: string): { category: 'audio' | 'video' | 'general'; tag: string } {
  const t = text.toLowerCase();
  
  // Video keywords - posture, gaze, expression, gestures, physical/visual presence
  const videoKeywords = [
    'eye contact', 'posture', 'fidget', 'camera', 'visual', 'gaze', 'face', 'facial', 
    'expression', 'gesture', 'movement', 'smile', 'look', 'body', 'physical', 'slouch',
    'straight', 'sit', 'shoulder', 'head', 'nod', 'tilt', 'frame', 'position', 'lighting',
    'composure', 'emotion', 'wear', 'dressing', 'clothing', 'background', 'distract',
    'eye-contact', 'body language', 'gazing', 'looking'
  ];
  // Audio keywords - voice, speaking, pacing, volume, silence, fillers
  const audioKeywords = [
    'voice', 'filler', 'um', 'ah', 'like', 'pitch', 'speaking', 'speak', 'audio', 'pause', 
    'tone', 'wpm', 'volume', 'fluency', 'pronounce', 'articulation', 'mumble', 'speed',
    'pace', 'fast', 'slow', 'talk', 'breath', 'hesitat', 'stutter', 'muffl', 'loud', 'quiet',
    'pronunciat', 'intonat', 'vocal', 'audible', 'sound', 'monoton', 'flow', 'fluently',
    'filler words', 'filler-word', 'talked', 'rate', 'pronunciation'
  ];

  // Determine category
  let category: 'audio' | 'video' | 'general' = 'general';
  if (videoKeywords.some(kw => t.includes(kw))) {
    category = 'video';
  } else if (audioKeywords.some(kw => t.includes(kw))) {
    category = 'audio';
  }

  // Determine tag
  let tag = 'General';
  if (t.includes('algorithm') || t.includes('data structure') || t.includes('code') || t.includes('coding') || t.includes('technical') || t.includes('complexity') || t.includes('system design') || t.includes('database') || t.includes('sql') || t.includes('api') || t.includes('framework')) {
    tag = 'Technical';
  } else if (t.includes('reasoning') || t.includes('logic') || t.includes('solve') || t.includes('approach') || t.includes('analyz') || t.includes('think') || t.includes('thought process')) {
    tag = 'Logical Reasoning';
  } else if (t.includes('star') || t.includes('structure') || t.includes('situation') || t.includes('task') || t.includes('action') || t.includes('result') || t.includes('framework') || t.includes('organize')) {
    tag = 'Structure & STAR';
  } else if (t.includes('communication') || t.includes('articulate') || t.includes('express') || t.includes('explain') || t.includes('clarity') || t.includes('clear')) {
    tag = 'Communication';
  } else if (category === 'audio') {
    tag = 'Voice & Fluency';
  } else if (category === 'video') {
    tag = 'Visual Presence';
  }

  return { category, tag };
}

function isSimilar(s1: string, s2: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const w1 = clean(s1);
  const w2 = clean(s2);
  
  if (s1.toLowerCase().trim() === s2.toLowerCase().trim()) return true;
  
  const checkKeywords = [
    'eye contact', 'posture', 'filler words', 'technical accuracy', 'star structure', 
    'speaking rate', 'pace', 'speaking speed', 'volume', 'pitch', 'tone', 'slouch',
    'explain', 'algorithm', 'system design'
  ];
  for (const kw of checkKeywords) {
    if (s1.toLowerCase().includes(kw) && s2.toLowerCase().includes(kw)) {
      return true;
    }
  }
  
  const set1 = new Set(w1);
  const set2 = new Set(w2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  if (union.size === 0) return false;
  const similarity = intersection.size / union.size;
  
  return similarity > 0.45;
}

function deduplicateImprovements(improvements: string[]): string[] {
  const unique: string[] = [];
  for (const imp of improvements) {
    if (!unique.some(existing => isSimilar(existing, imp))) {
      unique.push(imp);
    }
  }
  return unique;
}

interface ReportViewProps {
  sessionId: string;
}

export function ReportView({ sessionId }: ReportViewProps) {
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetailedReport, setShowDetailedReport] = useState(true);
  const [exportInProgress, setExportInProgress] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const router = useRouter();
  const pathParams = useParams();
  const portalType = (pathParams?.portalType as string) || 'b2c';

  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'voice' | 'visual' | 'skill_gap' | 'per_question'>('overview');
  const [dashboardMetrics, setDashboardMetrics] = useState<any | null>(null);

  const uniqueImprovements = useMemo(() => {
    if (!report) return [];
    return deduplicateImprovements(report.improvements || []);
  }, [report]);

  const voiceImprovements = useMemo(() => {
    return uniqueImprovements.filter(imp => classifyPoint(imp).category === 'audio');
  }, [uniqueImprovements]);

  const visualImprovements = useMemo(() => {
    return uniqueImprovements.filter(imp => classifyPoint(imp).category === 'video');
  }, [uniqueImprovements]);

  const generalGaps = useMemo(() => {
    return uniqueImprovements.filter(imp => {
      const { category } = classifyPoint(imp);
      return category !== 'audio' && category !== 'video';
    });
  }, [uniqueImprovements]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);

  // Initialize the robust polling state machine
  const [pollState, dispatch] = useReducer(pollReducer, {
    status: 'preparing',
    shouldPoll: true,
    consecutiveFailures: 0,
    elapsedPendingMs: 0,
  });

  useEffect(() => {
    if (pollState.status === 'ready') {
      fetch('/api/interview/dashboard')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.metrics) {
            setDashboardMetrics(data.metrics);
          }
        })
        .catch((err) => console.error('Failed to fetch dashboard metrics:', err));
    }
  }, [pollState.status]);

  const poll = useCallback(async () => {
    if (stoppedRef.current || !pollState.shouldPoll) return;

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }
    const elapsedMs = Date.now() - startTimeRef.current;

    try {
      const res = await fetch(`/api/interview/${sessionId}/report`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (res.status === 404) {
        dispatch({ type: 'not-found', elapsedMs });
        return;
      }

      if (res.status === 401) {
        stoppedRef.current = true;
        setError('Your session has expired. Please sign in again to view your report.');
        return;
      }

      if (res.status === 403) {
        stoppedRef.current = true;
        setError('You are not authorized to view this report.');
        return;
      }

      if (!res.ok) {
        dispatch({ type: 'transient-failure' });
        return;
      }

      const data: ReportPollResponse = await res.json();

      if (data.status === 'ready' && data.report) {
        stoppedRef.current = true;
        setReport(data.report);
        dispatch({ type: 'ready' });
      } else if (data.status === 'failed') {
        stoppedRef.current = true;
        dispatch({ type: 'failed' });
        setError('Report compilation failed. Please try ending the session again.');
      } else {
        dispatch({ type: 'pending', elapsedMs });
      }
    } catch {
      dispatch({ type: 'transient-failure' });
    }
  }, [sessionId, pollState.shouldPoll]);

  useEffect(() => {
    stoppedRef.current = false;
    startTimeRef.current = Date.now();
    void poll();

    const interval = setInterval(() => {
      void poll();
    }, 5000); // 5 seconds polling interval per spec

    return () => {
      stoppedRef.current = true;
      clearInterval(interval);
    };
  }, [poll]);

  const handlePdfExport = async () => {
    if (exportInProgress || pollState.status !== 'ready' || !report) return;
    setExportInProgress(true);
    setExportError(null);

    const timeoutId = setTimeout(() => {
      setExportInProgress(false);
      setExportError('Export timed out. Please try again.');
    }, 10000); // 10 second timeout per spec

    try {
      const doc = new jsPDF();
      
      // Header block
      doc.setFillColor(17, 19, 34); // Deep navy background
      doc.rect(0, 0, 210, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('Interview Performance Report', 15, 20);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(161, 161, 170); // Light gray
      doc.text(`Session ID: S-${report.sessionId.slice(-3).toUpperCase()}`, 15, 30);
      doc.text(`Completed: ${report.readyAt ? new Date(report.readyAt).toLocaleDateString() : 'N/A'}`, 15, 36);

      // Confidence Index Score Hero Block
      doc.setFillColor(244, 244, 245); // light gray container
      doc.roundedRect(15, 55, 180, 28, 3, 3, 'F');
      
      doc.setTextColor(17, 19, 34);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('CONFIDENCE INDEX SCORE', 25, 66);
      
      doc.setFontSize(24);
      doc.setTextColor(245, 158, 11); // Amber
      doc.text(`${Math.round(report.ciScore)} / 100`, 25, 76);

      // Categories breakdown
      doc.setTextColor(17, 19, 34);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Category Scores', 15, 98);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      let y = 108;
      
      const categories = [
        { label: 'Technical Accuracy', score: report.categoryScores.technicalAccuracy },
        { label: 'Communication', score: report.categoryScores.communication },
        { label: 'Voice Confidence', score: report.categoryScores.voiceCi },
        { label: 'Body Language', score: report.categoryScores.bodyCi },
      ];

      categories.forEach((cat) => {
        doc.setFont('helvetica', 'bold');
        doc.text(cat.label, 15, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${Math.round(cat.score)}%`, 170, y);
        
        // Draw progress bar
        doc.setFillColor(230, 230, 235);
        doc.roundedRect(15, y + 2, 180, 2, 1, 1, 'F');
        
        const score = cat.score;
        if (score >= 75) {
          doc.setFillColor(16, 185, 129); // emerald
        } else if (score >= 65) {
          doc.setFillColor(245, 158, 11); // amber
        } else {
          doc.setFillColor(239, 68, 68); // red
        }
        doc.roundedRect(15, y + 2, Math.max(2, (score / 100) * 180), 2, 1, 1, 'F');
        y += 15;
      });

      // Areas to Improve (Weaknesses)
      if (report.weaknessTags && report.weaknessTags.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Areas to Improve', 15, y + 5);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const tags = report.weaknessTags.map((tag) => {
          const labels: Record<string, string> = {
            technicalAccuracy: 'Technical Accuracy',
            communication: 'Communication',
            voiceCi: 'Voice Confidence',
            bodyCi: 'Body Language',
          };
          return labels[tag] || tag;
        }).join(' · ');
        
        doc.text(tags, 15, y + 13);
        y += 25;
      } else {
        y += 10;
      }

      // Coach Narrative Summary
      if (report.narrative) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text("Coach's Summary", 15, y + 5);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const textLines = doc.splitTextToSize(report.narrative, 180);
        doc.text(textLines, 15, y + 13);
        y += textLines.length * 5 + 15;
      }

      // Strengths
      if (report.strengths && report.strengths.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Strengths Identified', 15, y + 5);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        let strengthY = y + 13;
        report.strengths.forEach((s) => {
          if (strengthY > 280) { doc.addPage(); strengthY = 20; }
          doc.text(`• ${s}`, 15, strengthY);
          strengthY += 6;
        });
        y = strengthY + 10;
      }

      // Improvements
      if (uniqueImprovements && uniqueImprovements.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Recommended Improvements', 15, y + 5);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        let improvementY = y + 13;
        uniqueImprovements.forEach((i) => {
          if (improvementY > 280) { doc.addPage(); improvementY = 20; }
          doc.text(`• ${i}`, 15, improvementY);
          improvementY += 6;
        });
      }

      clearTimeout(timeoutId);
      doc.save(`S-${report.sessionId.slice(-3).toUpperCase()}_report.pdf`);
      setExportInProgress(false);
    } catch (err) {
      clearTimeout(timeoutId);
      setExportInProgress(false);
      setExportError('Failed to generate PDF. Please try again.');
    }
  };

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Polling & Preparing states ──

  if (pollState.status === 'preparing' && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <Loader2 className="mb-5 h-10 w-10 animate-spin text-amber-400" />
        <h2 className="mb-2 text-2xl font-bold text-white">Compiling your report…</h2>
        <p className="max-w-md text-sm text-[#a1a1aa]">
          Analyzing technical accuracy and behavioral metrics. This usually takes a few seconds.
        </p>
      </div>
    );
  }

  if (pollState.status === 'still-preparing' && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <AlertTriangle className="mb-5 h-10 w-10 text-amber-400 animate-pulse" />
        <h2 className="mb-2 text-2xl font-bold text-white">Still compiling your report…</h2>
        <p className="max-w-md text-sm text-[#a1a1aa] mb-6">
          This is taking longer than expected. You can trigger a manual refresh or check back in a moment.
        </p>
        <Button
          onClick={() => {
            startTimeRef.current = Date.now();
            void poll();
          }}
          icon={<RefreshCw className="w-4 h-4 animate-spin" />}
        >
          Refresh Status
        </Button>
      </div>
    );
  }

  if (pollState.status === 'status-unavailable' && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <AlertCircle className="mb-5 h-10 w-10 text-red-400" />
        <h2 className="mb-2 text-2xl font-bold text-white">Status Unavailable</h2>
        <p className="max-w-md text-sm text-[#a1a1aa] mb-6">
          We experienced consecutive connection failures. Please check your internet connection and try again.
        </p>
        <Button
          onClick={() => {
            startTimeRef.current = Date.now();
            void poll();
          }}
          icon={<RefreshCw className="w-4 h-4" />}
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  if (pollState.status === 'failed' || error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <AlertCircle className="mb-4 h-10 w-10 text-red-400" />
        <h2 className="mb-2 text-2xl font-bold text-white">Report Unavailable</h2>
        <p className="max-w-md text-sm text-[#a1a1aa] mb-6">{error || 'Report compilation failed.'}</p>
        <div className="flex gap-4">
          <Button
            variant="secondary"
            onClick={() => router.push(`/dashboard/${portalType}`)}
          >
            Dashboard
          </Button>
          <Button
            onClick={() => {
              startTimeRef.current = Date.now();
              void poll();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <RefreshCw className="mb-4 h-10 w-10 text-[#a1a1aa]" />
        <p className="text-sm text-[#a1a1aa]">No report data is available yet.</p>
      </div>
    );
  }

  const ci = Math.round(report.ciScore);
  const weaknessSet = new Set(report.weaknessTags);

  // ── Ready: Render summary card first ──
  if (pollState.status === 'ready' && !showDetailedReport) {
    const contentScore = Math.round(report.categoryScores.technicalAccuracy);
    const voiceScore = Math.round(report.categoryScores.voiceCi);
    const visualScore = Math.round(report.categoryScores.bodyCi);
    const sessionDisplayId = report.sessionId.slice(-3).toUpperCase();

    return (
      <div className="mx-auto w-full max-w-4xl py-8 flex flex-col items-center animate-fade-in-up">
        {/* Main Card */}
        <div className="w-full bg-[#111322] border border-[#242747]/30 rounded-3xl p-8 md:p-12 text-center shadow-2xl relative overflow-hidden">
          {/* Top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Success Check Badge */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.25)] text-black relative">
            <div className="flex items-center justify-center rounded-full border-2 border-black/85 p-1.5">
              <Check className="w-7 h-7 stroke-[3.5]" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-wide">
            Session Ended
          </h1>
          <p className="text-gray-400 mt-2 text-sm md:text-base">
            Great job. Here is your session summary.
          </p>
          <p className="text-xs text-gray-500 mt-2 tracking-widest font-mono uppercase">
            Session ID: S-{sessionDisplayId}
          </p>

          {/* Score Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {/* CI Score Card */}
            <div className="bg-[#161826]/70 border border-white/[0.03] rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-inner group hover:border-amber-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-3 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                <Target className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                {ci}
              </span>
              <span className="text-xs text-gray-400 mt-2 font-medium tracking-wide uppercase">
                CI Score
              </span>
            </div>

            {/* Content Score Card */}
            <div className="bg-[#161826]/70 border border-white/[0.03] rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-inner group hover:border-teal-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 mb-3 shadow-[0_0_15px_rgba(20,184,166,0.05)]">
                <FileText className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                {contentScore}%
              </span>
              <span className="text-xs text-gray-400 mt-2 font-medium tracking-wide uppercase">
                Content
              </span>
            </div>

            {/* Voice Score Card */}
            <div className="bg-[#161826]/70 border border-white/[0.03] rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-inner group hover:border-amber-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-3 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                <Mic className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                {voiceScore}%
              </span>
              <span className="text-xs text-gray-400 mt-2 font-medium tracking-wide uppercase">
                Voice
              </span>
            </div>

            {/* Visual Score Card */}
            <div className="bg-[#161826]/70 border border-white/[0.03] rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-inner group hover:border-teal-500/20 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 mb-3 shadow-[0_0_15px_rgba(20,184,166,0.05)]">
                <Eye className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                {visualScore}%
              </span>
              <span className="text-xs text-gray-400 mt-2 font-medium tracking-wide uppercase">
                Visual
              </span>
            </div>
          </div>

          <p className="text-gray-500 text-sm mt-8 font-medium">
            Duration: {formatDuration(report.durationSeconds || 0)} &middot; {report.questionsAnswered || 0}/{report.totalQuestions || 0} questions answered
          </p>

          <div className="flex flex-row justify-center items-center gap-4 mt-8">
            <button
              onClick={() => router.push(`/dashboard/${portalType}`)}
              className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 bg-white/[0.02] text-white hover:bg-white/[0.06] active:scale-95 transition-all duration-200 text-sm md:text-base font-semibold cursor-pointer shadow-md"
            >
              <Home className="w-4 h-4 text-gray-400" />
              Dashboard
            </button>
            <button
              onClick={() => setShowDetailedReport(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-black hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/20 active:scale-95 transition-all duration-200 text-sm md:text-base font-semibold cursor-pointer shadow-md"
            >
              <BarChart3 className="w-4 h-4" />
              Full Report
            </button>
          </div>
        </div>

        <div className="w-full bg-[#111322]/80 border border-white/[0.04] rounded-2xl p-5 flex items-start gap-4 mt-6 max-w-4xl shadow-lg">
          <div className="flex-shrink-0 text-amber-500 p-1">
            <Trophy className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="flex flex-col text-left justify-center">
            <h4 className="font-semibold text-white text-sm md:text-base tracking-wide">
              Keep practicing.
            </h4>
            <p className="text-gray-400 text-xs md:text-sm mt-1 leading-relaxed">
              Your full AI analysis and recommendations are available in the report.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Ready: Render full detailed Confidence Index report ──

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 py-8 animate-fade-in-up">
      {/* Header action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <Button
          variant="ghost"
          icon={<ArrowLeft className="w-4 h-4" />}
          iconPosition="left"
          onClick={() => setShowDetailedReport(false)}
        >
          Back to Summary
        </Button>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            icon={<HistoryIcon className="w-4 h-4" />}
            iconPosition="left"
            onClick={() => router.push(`/dashboard/${portalType}/interview-history`)}
          >
            History
          </Button>
          <Button
            variant="secondary"
            onClick={handlePdfExport}
            disabled={exportInProgress}
            icon={
              exportInProgress ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              ) : (
                <Download className="w-4 h-4 text-gray-400" />
              )
            }
          >
            {exportInProgress ? 'Exporting...' : 'Export PDF'}
          </Button>
          <Button
            variant="secondary"
            icon={<RotateCcw className="w-4 h-4" />}
            iconPosition="left"
            onClick={() => router.push(`/dashboard/${portalType}/interview`)}
          >
            New Interview
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-xs text-red-400 text-left">
          {exportError}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-[#0b0c16] border border-white/[0.04] rounded-full w-fit mb-4 max-w-full overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'breakdown', label: 'Breakdown' },
          { id: 'voice', label: 'Voice' },
          { id: 'visual', label: 'Visual' },
          { id: 'skill_gap', label: 'Skill Gap' },
          { id: 'per_question', label: 'Per-Question' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-2 rounded-full text-xs md:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
          {/* Top 3 Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Confidence Index Card */}
            <div className="flex flex-col items-center bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
                CONFIDENCE INDEX
              </h4>
              <div className="relative flex items-center justify-center w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="50"
                    className="text-gray-800"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="50"
                    className="text-amber-500"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={2 * Math.PI * 50 - (ci / 100) * 2 * Math.PI * 50}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-white">{ci}</span>
                  <span className="text-[10px] text-gray-400 font-mono mt-0.5">/ 100</span>
                </div>
              </div>
              
              <div className="mt-4 mb-6">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    alert("The Confidence Index is computed using a weighted evaluation across domains: Content (35%), Voice (25%), Visual (25%), STAR structure, and consistency (15%).");
                  }}
                  className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors justify-center bg-transparent border-none cursor-pointer"
                >
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-amber-500 text-[10px] font-bold">i</span>
                  How is CI calculated?
                </button>
              </div>

              <div className="w-full space-y-3 pt-4 border-t border-white/[0.04]">
                {[
                  { label: 'Content (35%)', val: report.categoryScores.technicalAccuracy },
                  { label: 'Voice (25%)', val: report.categoryScores.voiceCi },
                  { label: 'Visual (25%)', val: report.categoryScores.bodyCi },
                  { label: 'STAR Structure', val: report.categoryScores.communication },
                  { label: 'Consistency (15%)', val: calculateConsistency(report.perTurnHistory) },
                ].map((m, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-medium">{m.label}</span>
                    <span className="text-white font-bold">{Math.round(m.val)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Skill Radar Card */}
            <div className="flex flex-col items-center bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl text-left">
              <div className="w-full mb-4">
                <h4 className="text-sm font-bold text-white tracking-wide">Skill Radar</h4>
                <p className="text-xs text-gray-500 mt-0.5">Multimodal skill breakdown</p>
              </div>
              <div className="flex items-center justify-center w-full h-full min-h-[220px]">
                <RadarChart
                  axes={[
                    { label: 'Technical Accuracy', value: report.categoryScores.technicalAccuracy },
                    { label: 'Communication', value: report.categoryScores.communication },
                    { label: 'Body Language', value: report.categoryScores.bodyCi },
                    { label: 'Confidence', value: report.ciScore },
                    { label: 'Structure', value: report.categoryScores.communication },
                    { label: 'Fluency', value: report.categoryScores.voiceCi },
                  ]}
                  accent="#f59e0b"
                  size={240}
                />
              </div>
            </div>

            {/* Session Details Card */}
            <div className="flex flex-col justify-between bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl text-left">
              <div className="w-full">
                <h4 className="text-sm font-bold text-white tracking-wide mb-4">Session Details</h4>
                <div className="space-y-4">
                  {[
                    { label: 'Session ID', value: `S-${report.sessionId.slice(-3).toUpperCase()}` },
                    { label: 'Date', value: report.readyAt ? new Date(report.readyAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A' },
                    { label: 'Interview Type', value: `${report.role || 'Technical'} Interview` },
                    { label: 'Domain', value: 'Software Engineering' },
                    { label: 'Duration', value: `${Math.round((report.durationSeconds || 0) / 60)} min` },
                  ].map((d, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs pb-3 border-b border-white/[0.04]">
                      <span className="text-gray-400 font-medium">{d.label}</span>
                      <span className="text-white font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => router.push(`/dashboard/${portalType}/interview`)}
                className="w-full mt-6 py-3 rounded-xl bg-amber-500 text-black hover:bg-amber-600 font-bold text-sm tracking-wide transition-all duration-200 active:scale-98 cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-amber-500/10"
              >
                Start New Session <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Card: Score Breakdown Across Sessions */}
          {(() => {
            const completedSessions = (dashboardMetrics?.recentSessions || [])
              .filter((s: any) => s.status === 'completed' && s.categoryScores)
              .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const chartSessions = completedSessions.slice(-4);

            return (
              <div className="bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl w-full text-left">
                <h4 className="text-sm font-bold text-white tracking-wide">Score Breakdown Across Sessions</h4>
                <p className="text-xs text-gray-500 mt-0.5 mb-6">Content vs Voice vs Visual performance</p>
                
                <div className="relative h-64 flex items-end">
                  {/* Y-Axis Gridlines & Labels */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-gray-500 select-none pb-8">
                    {[100, 75, 50, 25, 0].map((tick) => (
                      <div key={tick} className="flex items-center w-full">
                        <span className="w-6 text-right pr-2">{tick}</span>
                        <div className="flex-1 border-t border-white/[0.04] border-dashed" />
                      </div>
                    ))}
                  </div>
                  
                  {/* Sessions bars */}
                  <div className="flex-1 flex justify-around items-end h-full pl-8 pb-8 relative z-10">
                    {chartSessions.length === 0 ? (
                      <div className="w-full flex items-center justify-center h-48 text-xs text-gray-500 italic">
                        No past session data to compare yet.
                      </div>
                    ) : (
                      chartSessions.map((sess: any) => {
                        const contentScore = sess.categoryScores?.technicalAccuracy ?? 0;
                        const voiceScore = sess.categoryScores?.voiceCi ?? 0;
                        const visualScore = sess.categoryScores?.bodyCi ?? 0;
                        const sessLabel = `S-${sess.sessionId.slice(-3).toUpperCase()}`;
                        
                        return (
                          <div key={sess.sessionId} className="flex flex-col items-center h-full justify-end group">
                            {/* Bars container */}
                            <div className="flex items-end gap-1.5 h-48 mb-2">
                              {/* Content (Orange) */}
                              <div 
                                className="w-4 sm:w-6 bg-amber-600 rounded-t-sm transition-all duration-500 relative group-hover:brightness-110"
                                style={{ height: `${contentScore}%` }}
                                title={`Content: ${contentScore}%`}
                              />
                              {/* Voice (Teal) */}
                              <div 
                                className="w-4 sm:w-6 bg-teal-600 rounded-t-sm transition-all duration-500 relative group-hover:brightness-110"
                                style={{ height: `${voiceScore}%` }}
                                title={`Voice: ${voiceScore}%`}
                              />
                              {/* Visual (Purple) */}
                              <div 
                                className="w-4 sm:w-6 bg-violet-600 rounded-t-sm transition-all duration-500 relative group-hover:brightness-110"
                                style={{ height: `${visualScore}%` }}
                                title={`Visual: ${visualScore}%`}
                              />
                            </div>
                            {/* Session Label */}
                            <span className="text-[10px] sm:text-xs font-mono font-bold text-gray-400 group-hover:text-white transition-colors">
                              {sessLabel}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'breakdown' && (
        <div className="space-y-8 animate-fade-in">
          {/* Category breakdown */}
          <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 shadow-md text-left">
            <div className="mb-5 flex items-center gap-2">
              <Target size={18} className="text-teal-400" />
              <h3 className="text-lg font-semibold text-white">Category Breakdown</h3>
            </div>
            <div className="space-y-5">
              {(Object.keys(CATEGORY_LABELS) as (keyof CategoryScores)[]).map((key) => {
                const value = report.categoryScores[key] ?? 0;
                const pct = clampPercent(value);
                return (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-white/90">
                        {CATEGORY_LABELS[key]}
                        {weaknessSet.has(key) && (
                          <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300 animate-pulse">
                            Weak
                          </span>
                        )}
                      </span>
                      <span className={`text-sm font-semibold ${scoreColor(value)}`}>
                        {Math.round(value)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(value)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Weakness tags */}
          <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 shadow-md text-left">
            <h3 className="mb-4 text-lg font-semibold text-white">Focus Areas</h3>
            {report.weaknessTags.length === 0 ? (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-sm">
                <CheckCircle2 size={16} />
                <span>No category scored below 65. Strong balanced performance across the board.</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {report.weaknessTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300"
                  >
                    {CATEGORY_LABELS[tag as keyof CategoryScores] ?? tag}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Narrative summary */}
          {report.narrative && (
            <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 shadow-md text-left">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-teal-400" />
                <h3 className="text-lg font-semibold text-white">Coach narrative</h3>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">
                {report.narrative}
              </p>
            </section>
          )}
        </div>
      )}

      {activeTab === 'voice' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Voice Score Card */}
            <div className="flex flex-col items-center bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl relative overflow-hidden md:col-span-1">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
                VOICE CONFIDENCE
              </h4>
              <div className="relative flex items-center justify-center w-36 h-36">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="45"
                    className="text-gray-800"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="45"
                    className="text-teal-500"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={2 * Math.PI * 45 - (report.categoryScores.voiceCi / 100) * 2 * Math.PI * 45}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-white">{Math.round(report.categoryScores.voiceCi)}%</span>
                </div>
              </div>
            </div>

            {/* Voice Cues & Tips */}
            <div className="bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl text-left md:col-span-2 space-y-4">
              <h4 className="text-sm font-bold text-white tracking-wide">Voice Cues & Insights</h4>
              <ul className="space-y-3 text-xs md:text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 shrink-0">•</span>
                  <span><strong>Optimal Pace:</strong> Keep your speaking rate between 130-150 words per minute. Speaking too fast reduces comprehension, while speaking too slowly can signal hesitation.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 shrink-0">•</span>
                  <span><strong>Filler Words:</strong> Limit filler words such as "um", "ah", "like", and "you know". Pauses are natural and give you time to structure thoughts.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 shrink-0">•</span>
                  <span><strong>Tone Variation:</strong> Avoid monotonic speech. Modulating your voice helps emphasize key accomplishments and technical keywords.</span>
                </li>
              </ul>
              {voiceImprovements.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-3">Your Specific Voice Improvements</h5>
                  <ul className="space-y-2 text-xs md:text-sm text-gray-300">
                    {voiceImprovements.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-teal-400 shrink-0">•</span>
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>


        </div>
      )}

      {activeTab === 'visual' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Visual Score Card */}
            <div className="flex flex-col items-center bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl relative overflow-hidden md:col-span-1">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
                BODY LANGUAGE
              </h4>
              <div className="relative flex items-center justify-center w-36 h-36">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="45"
                    className="text-gray-800"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="45"
                    className="text-violet-500"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={2 * Math.PI * 45 - (report.categoryScores.bodyCi / 100) * 2 * Math.PI * 45}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-white">{Math.round(report.categoryScores.bodyCi)}%</span>
                </div>
              </div>
            </div>

            {/* Visual Cues & Tips */}
            <div className="bg-[#111322] border border-[#242747]/30 rounded-3xl p-6 shadow-xl text-left md:col-span-2 space-y-4">
              <h4 className="text-sm font-bold text-white tracking-wide">Visual Cues & Insights</h4>
              <ul className="space-y-3 text-xs md:text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 shrink-0">•</span>
                  <span><strong>Eye Contact:</strong> Maintain steady visual contact with the camera. Looking away repeatedly can register as nervousness or distraction.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 shrink-0">•</span>
                  <span><strong>Posture Stability:</strong> Keep a comfortable, upright posture. Avoid excessive rocking or fidgeting in your seat.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 shrink-0">•</span>
                  <span><strong>Expressiveness:</strong> Dynamic expressions, smiles, and head nods reflect positive reinforcement and make you appear highly engaged.</span>
                </li>
              </ul>
              {visualImprovements.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-violet-400 mb-3">Your Specific Body Language Improvements</h5>
                  <ul className="space-y-2 text-xs md:text-sm text-gray-300">
                    {visualImprovements.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-violet-400 shrink-0">•</span>
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>


        </div>
      )}

      {activeTab === 'skill_gap' && (
        <div className="space-y-8 animate-fade-in">
          {/* Areas to Refine (Skill Gaps) */}
          <section className="rounded-3xl border border-amber-500/10 bg-[#111322]/60 p-6 shadow-md text-left">
            <div className="mb-4 flex items-center gap-2 text-amber-400">
              <AlertTriangle size={18} />
              <h3 className="text-lg font-semibold text-white font-medium">Areas to Refine (Skill Gaps)</h3>
            </div>
            {generalGaps.length === 0 ? (
              <p className="text-xs text-[#a1a1aa] italic">
                No skill gaps identified during this session.
              </p>
            ) : (
              <div className="space-y-3">
                {generalGaps.map((gap, idx) => {
                  const { tag } = classifyPoint(gap);
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-all">
                      <p className="text-sm text-white/90 leading-relaxed">{gap}</p>
                      <span className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider w-fit">
                        {tag}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Key Strengths Global Lists */}
          <div className="grid grid-cols-1 gap-6 text-left">
            {/* Strengths Card */}
            <section className="rounded-3xl border border-emerald-500/10 bg-emerald-500/[0.02] p-6 shadow-md">
              <div className="mb-4 flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={18} />
                <h3 className="text-lg font-semibold text-white font-medium">Key Strengths</h3>
              </div>
              {!report.strengths || report.strengths.length === 0 ? (
                <p className="text-xs text-[#a1a1aa] italic">
                  None identified during this session.
                </p>
              ) : (
                <ul className="space-y-3">
                  {report.strengths.map((str, idx) => (
                    <li key={idx} className="text-sm text-white/80 flex items-start gap-2">
                      <span className="text-emerald-400 shrink-0 mt-1">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Recommended Resources */}
          <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 shadow-md text-left">
            <div className="mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-teal-400" />
              <h3 className="text-lg font-semibold text-white">Recommended Resources</h3>
            </div>
            {report.resources.length === 0 ? (
              <p className="text-sm text-[#a1a1aa]">
                No curated resources matched your focus areas this time.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.resources.map((resource) => {
                  const ytId = getYouTubeId(resource.url);

                  return (
                    <div key={resource.id}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col h-full rounded-2xl border border-white/5 bg-[#161826]/40 overflow-hidden transition-all duration-300 hover:border-teal-400/30 hover:bg-[#161826]/75 hover:-translate-y-0.5 group"
                      >


                        {/* Card Details */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between text-left">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                ytId
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                              }`}>
                                {ytId ? 'YouTube Video' : 'Online Course'}
                              </span>
                              {resource.institutionCode && (
                                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                                  Institution
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-semibold text-white mb-2 line-clamp-2 leading-relaxed">
                              {resource.title}
                            </h4>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-white/[0.03] flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 group-hover:text-amber-300">
                              {ytId ? 'Watch Video' : 'Start Learning'} <ExternalLink size={10} />
                            </span>
                            {resource.tags.length > 0 && (
                              <span className="text-[9px] text-[#a1a1aa] truncate max-w-[150px]">
                                {resource.tags.join(' · ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'per_question' && (
        <div className="space-y-8 animate-fade-in text-left">
          {/* Turn-by-Turn Score History Accordions */}
          {report.perTurnHistory && report.perTurnHistory.length > 0 && (
            <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 shadow-md">
              <div className="mb-4 flex items-center gap-2">
                <FileText size={18} className="text-teal-400" />
                <h3 className="text-lg font-semibold text-white">Question History</h3>
              </div>
              <PerTurnHistorySection history={report.perTurnHistory} />
            </section>
          )}
        </div>
      )}

      {/* Removed Progress tab panel */}
    </div>
  );
}

// ── Interactive Per-Turn Accordion Component ──

function PerTurnHistorySection({ history }: { history: PerTurnRow[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {history.map((turn) => {
        const isExpanded = expandedIndex === turn.turnIndex;
        const hasEval = turn.evaluation !== null;
        
        return (
          <div
            key={turn.turnIndex}
            className="border border-white/5 bg-[#111322]/40 rounded-2xl overflow-hidden transition-all duration-200 shadow-sm"
          >
            <div
              onClick={() => setExpandedIndex(isExpanded ? null : turn.turnIndex)}
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-bold text-amber-400">
                  Question {turn.turnIndex + 1}
                </span>
                {turn.questionOrigin === 'generated' && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    AI
                  </span>
                )}
                {turn.questionOrigin === 'database' && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                    DB
                  </span>
                )}
                {turn.questionOrigin === 'cover' && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-red-500/10 border border-red-500/20 text-red-400">
                    C
                  </span>
                )}
                {!hasEval && (
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-400">
                    Eval Unavailable
                  </span>
                )}
              </div>
              <div className="text-[#a1a1aa]">
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {isExpanded && (
              <div className="px-6 pb-6 pt-2 border-t border-white/5 space-y-4 text-left">
                {/* Question Asked */}
                {turn.questionText && (
                  <div>
                    <h4 className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-1">
                      Question Asked
                    </h4>
                    <p className="text-sm text-zinc-300 font-medium leading-relaxed bg-white/5 p-3.5 rounded-xl border border-white/5">
                      {turn.questionText}
                    </p>
                  </div>
                )}

                {/* Transcript */}
                <div>
                  <h4 className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-1">
                    Your Response
                  </h4>
                  <p className="text-sm text-white/90 leading-relaxed italic bg-white/[0.01] p-3.5 rounded-xl border border-white/[0.03]">
                    &ldquo;{turn.transcript || 'No spoken response recorded.'}&rdquo;
                  </p>
                </div>

                {hasEval && turn.evaluation && (
                  <div className="space-y-4">
                    {/* Turn Scores Breakdown */}
                    {(turn.evaluation.technicalAccuracy !== undefined ||
                      turn.evaluation.communication !== undefined) && (
                      <div>
                        <h4 className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-2">
                          Turn Scores
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {turn.evaluation.technicalAccuracy !== undefined && (
                            <div className="bg-[#161827]/70 p-2.5 rounded-xl text-center border border-white/[0.02]">
                              <span className="block text-[10px] text-gray-400 font-medium">Technical</span>
                              <span className={`text-base font-bold ${scoreColor(turn.evaluation.technicalAccuracy)}`}>
                                {Math.round(turn.evaluation.technicalAccuracy)}%
                              </span>
                            </div>
                          )}
                          {turn.evaluation.communication !== undefined && (
                            <div className="bg-[#161827]/70 p-2.5 rounded-xl text-center border border-white/[0.02]">
                              <span className="block text-[10px] text-gray-400 font-medium">Communication</span>
                              <span className={`text-base font-bold ${scoreColor(turn.evaluation.communication)}`}>
                                {Math.round(turn.evaluation.communication)}%
                              </span>
                            </div>
                          )}
                          {turn.evaluation.voiceCi !== undefined && (
                            <div className="bg-[#161827]/70 p-2.5 rounded-xl text-center border border-white/[0.02]">
                              <span className="block text-[10px] text-gray-400 font-medium">Voice</span>
                              <span className={`text-base font-bold ${scoreColor(turn.evaluation.voiceCi)}`}>
                                {Math.round(turn.evaluation.voiceCi)}%
                              </span>
                            </div>
                          )}
                          {turn.evaluation.bodyCi !== undefined && (
                            <div className="bg-[#161827]/70 p-2.5 rounded-xl text-center border border-white/[0.02]">
                              <span className="block text-[10px] text-gray-400 font-medium">Body</span>
                              <span className={`text-base font-bold ${scoreColor(turn.evaluation.bodyCi)}`}>
                                {Math.round(turn.evaluation.bodyCi)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Turn Strengths & Improvements */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <CheckCircle2 size={12} />
                          Strengths
                        </h5>
                        {turn.evaluation.strengths && turn.evaluation.strengths.length > 0 ? (
                          <ul className="list-disc list-inside text-xs text-white/80 space-y-1 pl-1">
                            {turn.evaluation.strengths.map((str, sIdx) => (
                              <li key={sIdx}>{str}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-[#a1a1aa] italic pl-1">None tagged.</p>
                        )}
                      </div>

                      <div>
                        <h5 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <AlertTriangle size={12} />
                          Improvements
                        </h5>
                        {turn.evaluation.improvements && turn.evaluation.improvements.length > 0 ? (
                          <ul className="list-disc list-inside text-xs text-white/80 space-y-1 pl-1">
                            {turn.evaluation.improvements.map((imp, iIdx) => (
                              <li key={iIdx}>{imp}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-[#a1a1aa] italic pl-1">None tagged.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Chronological Timeline List ──

interface TimelineListProps {
  entries: TimelineEntry[];
}

function TimelineList({ entries }: TimelineListProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-[#a1a1aa] italic">
        No timeline events recorded.
      </div>
    );
  }

  // Pure stable ordering by non-decreasing tSeconds
  const sorted = [...entries].sort((a, b) => a.tSeconds - b.tSeconds);

  function formatMMSS(sec: number): string {
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  }

  const SEVERITY_STYLES: Record<string, string> = {
    info: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="space-y-3">
      {sorted.map((entry, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.01] border border-white/[0.02] text-sm"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
              {formatMMSS(entry.tSeconds)}
            </span>
            <span className="text-white/80 font-medium">{entry.event || (entry as any).label}</span>
          </div>
          {entry.severity && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${SEVERITY_STYLES[entry.severity] || 'text-[#a1a1aa]'}`}>
              {entry.severity}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default ReportView;
