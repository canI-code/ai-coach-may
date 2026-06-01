import type { AggregatedMetrics, Persona } from './schemas';
import type { LLMRequest } from './llm-gateway';

export interface TurnScoreSummary {
  index: number;
  technicalAccuracy: number;
  communication: number;
  voiceCi: number;
  bodyCi: number;
}

export interface EvaluationPromptArgs {
  questionText: string;
  idealAnswer: string;
  metrics: AggregatedMetrics;
  priorHistory: TurnScoreSummary[];
  transcript: string;
  persona: Persona;
}

export interface GenerationPromptArgs {
  role: string;
  difficulty: number;
  windowTranscripts: string[];
  excludedQuestions: string[];
  persona: Persona;
  focusTags?: string[];
}

export interface NarrativePromptArgs {
  ciScore: number;
  categoryScores: Record<string, number>;
  weaknessTags: string[];
  strengths: string[];
  improvements: string[];
}

/** Compact prior-turn numeric scores into a sliding-window history block. */
export function compressHistory(history: TurnScoreSummary[]): string {
  if (history.length === 0) return '(none)';
  return history
    .map(
      (h) =>
        `T${h.index}: tech=${h.technicalAccuracy} comm=${h.communication} voice=${h.voiceCi} body=${h.bodyCi}`,
    )
    .join('; ');
}

// numeric-only serialization of metrics (no raw audio/video ever)
function metricsBlock(m: AggregatedMetrics): string {
  return [
    `wpm=[${m.wpmArr.join(',')}]`,
    `fillerCount=${m.fillerCount}`,
    `eyeContact=[${m.eyeContactArr.join(',')}]`,
    `posture=[${m.postureArr.join(',')}]`,
    `pitchVariance=${m.pitchVariance}`,
    `loudnessVariance=${m.loudnessVariance}`,
    `sentiment=${m.sentiment}`,
    `dominantEmotion=${m.dominantEmotion}`,
    `composure=${m.composure}`,
    `pace=${m.pace}`,
  ].join(' ');
}

const SYSTEM = 'You are an expert technical interview evaluator. Respond with strict JSON only.';

export function buildEvaluationPrompt(args: EvaluationPromptArgs): LLMRequest {
  const prompt = [
    `Persona: ${args.persona}`,
    `Question: ${args.questionText}`,
    `Ideal answer: ${args.idealAnswer}`,
    `Candidate transcript (VERBATIM, unedited): ${args.transcript}`,
    `Aggregated numeric metrics: ${metricsBlock(args.metrics)}`,
    `Prior-turn scores: ${compressHistory(args.priorHistory)}`,
    '',
    'TRANSCRIPT POLICY:',
    'The candidate transcript above is a raw, verbatim speech-to-text result. It may',
    'include filler words (um, uh, like, you know), false starts, repeated words,',
    'casual punctuation, and ungrammatical phrasing. Treat these as SIGNAL about',
    "voice confidence, composure, and communication clarity — they are NOT errors to",
    'penalise on technicalAccuracy. Score the underlying ideas, not the surface form.',
    '',
    'SCORING SCALE (read carefully):',
    'Every score (technicalAccuracy, communication, voiceCi, bodyCi) MUST be an INTEGER from 0 to 100.',
    'Do NOT use a 0-1 scale. Do NOT use decimals or fractions (e.g. 0.8 is INVALID; write 80).',
    'Rubric anchors: 0-40 = poor/struggling, 41-64 = below expectations, 65-79 = solid, 80-100 = strong/exceptional.',
    '',
    'HOW TO DERIVE EACH SCORE:',
    '- technicalAccuracy: how correct/complete the answer is versus the ideal answer.',
    '- communication: clarity, structure, and relevance of the spoken response.',
    '- voiceCi: derive ONLY from the speech metrics — wpm/pace, fillerCount, pitchVariance, loudnessVariance, and sentiment. Do not guess or return a constant.',
    '- bodyCi: derive ONLY from the body metrics — eyeContact array, posture array, composure, and dominantEmotion. Do not guess or return a constant.',
    '',
    'DIFFICULTY ADJUSTMENT (choose exactly one):',
    "- 'increase' if the candidate performed strongly this turn (technicalAccuracy AND communication both >= 75).",
    "- 'decrease' if the candidate struggled (either technicalAccuracy OR communication < 50).",
    "- 'same' otherwise.",
    '',
    'Return strict JSON only with these exact keys: { technicalAccuracy, communication, voiceCi, bodyCi, strengths[], improvements[], difficultyAdjustment }.',
  ].join('\n');
  return { prompt, system: SYSTEM };
}

export function buildGenerationPrompt(args: GenerationPromptArgs): LLMRequest {
  const prompt = [
    `Persona: ${args.persona}`,
    `Generate one ${args.role} interview question at difficulty ${args.difficulty}.`,
    args.focusTags && args.focusTags.length > 0
      ? `The question MUST focus on these specific areas/skills: ${args.focusTags.join(', ')}.`
      : '',
    `Recent answer context: ${args.windowTranscripts.join(' | ') || '(none)'}`,
    `Do NOT repeat any of these questions: ${args.excludedQuestions.join(' | ') || '(none)'}`,
    'Return JSON: { questionText, idealAnswer, tags[], difficulty }.',
  ].filter(Boolean).join('\n');
  return { prompt, system: SYSTEM };
}

export function buildNarrativePrompt(args: NarrativePromptArgs): LLMRequest {
  const prompt = [
    `Overall Confidence Index Score: ${args.ciScore} / 100`,
    `Category Scores: ${JSON.stringify(args.categoryScores)}`,
    `Weaknesses Flagged (Score < 65): ${args.weaknessTags.join(', ') || '(none)'}`,
    `Candidate's Strengths: ${JSON.stringify(args.strengths)}`,
    `Areas of Improvement: ${JSON.stringify(args.improvements)}`,
    '',
    'Your task is to:',
    '1. Generate a descriptive narrative summary (narrative) evaluating the candidate\'s overall interview performance, highlighting their strengths and advising on how to address their gaps.',
    '2. Generate a list of personalized recommendations (recommendations). For each weakness tag flagged, generate 1 to 2 targeted study recommendations.',
    '   Each recommendation must include:',
    '   - title: A specific, clear name for the study resource/topic.',
    '   - url: A high-quality, real, and publicly accessible web URL for learning more about this topic (e.g. developer.mozilla.org, system-design-primer on github, harvard business review, or similar high-quality references). Make sure the URL is valid and relevant.',
    '   - rationale: A highly personalized explanation of why this resource is recommended based on the candidate\'s specific session metrics and performance.',
    '   - weaknessTag: The exact tag key matching this recommendation (e.g. "technicalAccuracy", "communication", "voiceCi", "bodyCi").',
    '',
    'Return JSON with the exact shape: { narrative, recommendations: [{ title, url, rationale, weaknessTag }] }.',
  ].join('\n');
  return { prompt, system: SYSTEM };
}
