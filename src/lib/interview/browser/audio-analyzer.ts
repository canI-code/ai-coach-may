import type { Pace } from '../schemas';
import { classifyPace, computeWpm, countFillers } from './metrics';

const PAUSE_SECONDS = 0.5;
const DEAD_SILENCE_SECONDS = 2.5;

export interface SpeechBlock {
  transcript: string;
  durationSeconds: number;
  wordGaps: number[]; // seconds between consecutive words
  pitchSamples: number[]; // Hz estimates
  loudnessSamples: number[]; // RMS / dB estimates
}

export interface SpeechMetrics {
  wpm: number;
  fillerCount: number;
  pace: Pace;
  pauses: number;
  deadSilences: number;
  pitchVariance: number;
  loudnessVariance: number;
  sentiment: number; // [-1, 1]
}

const POSITIVE = ['confident', 'strong', 'excellent', 'great', 'clear', 'good', 'yes'];
const NEGATIVE = ['unsure', 'nervous', 'difficult', 'bad', 'wrong', 'confused', 'no'];

export function variance(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / xs.length;
}

export function detectPauses(gaps: number[]): { pauses: number; deadSilences: number } {
  let pauses = 0;
  let deadSilences = 0;
  for (const g of gaps) {
    if (g > PAUSE_SECONDS) pauses++;
    if (g > DEAD_SILENCE_SECONDS) deadSilences++;
  }
  return { pauses, deadSilences };
}

/** Lexicon sentiment in [-1, 1]. */
export function scoreSentiment(transcript: string): number {
  const words = transcript.toLowerCase().match(/[a-z']+/g) ?? [];
  if (words.length === 0) return 0;
  let score = 0;
  for (const w of words) {
    if (POSITIVE.includes(w)) score++;
    else if (NEGATIVE.includes(w)) score--;
  }
  return Math.max(-1, Math.min(1, score / Math.sqrt(words.length)));
}

function wordCount(transcript: string): number {
  return transcript.trim().split(/\s+/).filter(Boolean).length;
}

export function analyzeSpeechBlock(block: SpeechBlock): SpeechMetrics {
  const wpm = computeWpm(wordCount(block.transcript), block.durationSeconds);
  const { pauses, deadSilences } = detectPauses(block.wordGaps);
  return {
    wpm,
    fillerCount: countFillers(block.transcript),
    pace: classifyPace(wpm),
    pauses,
    deadSilences,
    pitchVariance: variance(block.pitchSamples),
    loudnessVariance: variance(block.loudnessSamples),
    sentiment: scoreSentiment(block.transcript),
  };
}

/**
 * Browser wiring: the UI pushes Web Speech transcripts and WebAudio AnalyserNode
 * samples; `finalize` derives the per-block SpeechMetrics via the pure helpers.
 */
export class AudioAnalyzer {
  private transcript = '';
  private pitchSamples: number[] = [];
  private loudnessSamples: number[] = [];
  private wordTimestamps: number[] = [];
  private startedAt = 0;

  start(now: number = Date.now()): void {
    this.startedAt = now;
    this.transcript = '';
    this.pitchSamples = [];
    this.loudnessSamples = [];
    this.wordTimestamps = [];
  }

  ingestTranscript(text: string, now: number = Date.now()): void {
    this.transcript = text;
    this.wordTimestamps.push(now);
  }

  ingestAudioFrame(pitchHz: number, loudness: number): void {
    this.pitchSamples.push(pitchHz);
    this.loudnessSamples.push(loudness);
  }

  finalize(now: number = Date.now()): SpeechMetrics {
    const gaps: number[] = [];
    for (let i = 1; i < this.wordTimestamps.length; i++) {
      gaps.push((this.wordTimestamps[i] - this.wordTimestamps[i - 1]) / 1000);
    }
    return analyzeSpeechBlock({
      transcript: this.transcript,
      durationSeconds: Math.max(0, (now - this.startedAt) / 1000),
      wordGaps: gaps,
      pitchSamples: this.pitchSamples,
      loudnessSamples: this.loudnessSamples,
    });
  }
}
