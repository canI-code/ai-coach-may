import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export type LLMProvider = 'gemini' | 'openai' | 'openrouter' | 'nvidia' | 'mock' | 'groq';

export interface LLMRequest {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export type LLMError = {
  kind: 'provider_error' | 'timeout' | 'rate_limited';
  message: string;
};

export type LLMResult = { ok: true; text: string } | { ok: false; error: LLMError };

export interface LLMGateway {
  complete(req: LLMRequest): Promise<LLMResult>;
}

const GEMINI_MODEL = 'gemini-2.5-flash';

function classify(err: unknown): LLMError {
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  const lower = message.toLowerCase();
  if (status === 429 || lower.includes('rate') || lower.includes('quota')) {
    return { kind: 'rate_limited', message };
  }
  if (lower.includes('timeout') || lower.includes('abort') || lower.includes('etimedout')) {
    return { kind: 'timeout', message };
  }
  return { kind: 'provider_error', message };
}

class GeminiGateway implements LLMGateway {
  async complete(req: LLMRequest): Promise<LLMResult> {
    try {
      const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) return { ok: false, error: { kind: 'provider_error', message: 'GOOGLE_AI_API_KEY not set' } };
      const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: GEMINI_MODEL,
        ...(req.system ? { systemInstruction: req.system } : {}),
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
        generationConfig: { maxOutputTokens: req.maxTokens, temperature: req.temperature },
      });
      return { ok: true, text: result.response.text() };
    } catch (err) {
      return { ok: false, error: classify(err) };
    }
  }
}

interface CompatConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
  label: string;
}

/** Generic OpenAI-compatible adapter — used for OpenAI, OpenRouter, and NVIDIA NIM. */
class OpenAICompatGateway implements LLMGateway {
  constructor(private readonly cfg: CompatConfig) {}

  async complete(req: LLMRequest): Promise<LLMResult> {
    try {
      if (!this.cfg.apiKey) {
        return { ok: false, error: { kind: 'provider_error', message: `${this.cfg.label}: API key not set` } };
      }
      const client = new OpenAI({
        apiKey: this.cfg.apiKey,
        ...(this.cfg.baseURL ? { baseURL: this.cfg.baseURL } : {}),
      });
      const resp = await client.chat.completions.create({
        model: this.cfg.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        messages: [
          ...(req.system ? [{ role: 'system' as const, content: req.system }] : []),
          { role: 'user' as const, content: req.prompt },
        ],
      });
      return { ok: true, text: resp.choices[0]?.message?.content ?? '' };
    } catch (err) {
      return { ok: false, error: classify(err) };
    }
  }
}

/**
 * Offline test gateway — returns deterministic, schema-valid JSON without any network
 * call or API key. Opt-in via `INTERVIEW_LLM_PROVIDER=mock`. It inspects the prompt to
 * decide which schema is expected (the prompt-builder names the output fields).
 */
class MockGateway implements LLMGateway {
  async complete(req: LLMRequest): Promise<LLMResult> {
    const p = req.prompt;
    if (p.includes('atsScore') || p.includes('ResumeAnalysisSchema') || p.includes('resumeText')) {
      return {
        ok: true,
        text: JSON.stringify({
          atsScore: 85,
          formattingScore: 90,
          skillsScore: 80,
          experienceScore: 75,
          hardSkills: ['React', 'TypeScript', 'Node.js', 'MongoDB'],
          softSkills: ['Communication', 'Leadership', 'Problem Solving'],
          formattingFeedback: [
            'Use standard font sizes and margins.',
            'Ensure consistent bullet points layout.'
          ],
          googleXyzSuggestions: [
            {
              original: 'Led a team to build a web app.',
              improved: 'Accomplished 30% speedup in web app rendering by leading a team of 4 to refactor React components.',
              reason: 'Uses the Google XYZ formula: Accomplished [X] as measured by [Y], by doing [Z].'
            }
          ],
          jobDescriptionMatch: {
            roleName: 'Frontend Engineer',
            matchPercentage: 85,
            missingSkills: ['Tailwind CSS', 'Next.js'],
            recommendations: [
              'Add Next.js projects to showcase modern framework experience.',
              'Highlight responsive styling work.'
            ]
          }
        }),
      };
    }
    if (p.includes('technicalAccuracy')) {
      return {
        ok: true,
        text: JSON.stringify({
          technicalAccuracy: 75,
          communication: 78,
          voiceCi: 72,
          bodyCi: 74,
          strengths: ['Clear structure', 'Relevant examples'],
          improvements: ['Add more specifics', 'Tighten the conclusion'],
          difficultyAdjustment: 'same',
        }),
      };
    }
    if (p.includes('questionText')) {
      return {
        ok: true,
        text: JSON.stringify({
          questionText: 'Can you walk me through your reasoning on that in more depth?',
          idealAnswer: 'A strong answer expands on the prior point with concrete detail.',
          tags: ['follow-up'],
          difficulty: 3,
        }),
      };
    }
    if (p.includes('narrative')) {
      return {
        ok: true,
        text: JSON.stringify({
          narrative:
            'Overall a solid performance with clear communication; focus next on depth and specificity.',
          recommendations: [
            {
              title: 'Mock Technical Guide',
              url: 'https://example.com/tech',
              rationale: 'Mock rationale.',
              weaknessTag: 'technicalAccuracy',
            }
          ],
        }),
      };
    }
    return { ok: true, text: '{}' };
  }
}

/** Tries each provider in order; returns the first success, else the last error. */
class FallbackGateway implements LLMGateway {
  constructor(private readonly chain: LLMGateway[]) {}

  async complete(req: LLMRequest): Promise<LLMResult> {
    let last: LLMResult = {
      ok: false,
      error: { kind: 'provider_error', message: 'no LLM providers configured' },
    };
    for (const gateway of this.chain) {
      const res = await gateway.complete(req);
      if (res.ok) return res;
      last = res;
    }
    return last;
  }
}

const KEY_ENV: Record<Exclude<LLMProvider, 'mock'>, string> = {
  gemini: 'GOOGLE_AI_API_KEY',
  openai: 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  groq: 'GROQ_API_KEY',
};

/** Default provider order; each is skipped at runtime if its key is absent. */
const DEFAULT_ORDER: LLMProvider[] = ['gemini', 'groq', 'nvidia', 'openrouter', 'openai'];

function hasKey(name: LLMProvider): boolean {
  if (name === 'mock') return true;
  if (name === 'gemini') {
    const k1 = process.env.GOOGLE_AI_API_KEY;
    const k2 = process.env.GEMINI_API_KEY;
    return (typeof k1 === 'string' && k1.trim().length > 0) || (typeof k2 === 'string' && k2.trim().length > 0);
  }
  const v = process.env[KEY_ENV[name]];
  return typeof v === 'string' && v.trim().length > 0;
}

function buildProvider(name: LLMProvider): LLMGateway {
  switch (name) {
    case 'gemini':
      return new GeminiGateway();
    case 'mock':
      return new MockGateway();
    case 'openai':
      return new OpenAICompatGateway({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        label: 'openai',
      });
    case 'openrouter':
      return new OpenAICompatGateway({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
        label: 'openrouter',
      });
    case 'nvidia':
      return new OpenAICompatGateway({
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: 'https://integrate.api.nvidia.com/v1',
        model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct',
        label: 'nvidia',
      });
    case 'groq':
      return new OpenAICompatGateway({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
        model: process.env.GROQ_MODEL || 'llama3-70b-8192',
        label: 'groq',
      });
  }
}

/**
 * Resolve the active LLM gateway.
 *  - `INTERVIEW_LLM_PROVIDER` set to one or more (comma-separated) of gemini|nvidia|
 *    openrouter|openai|mock → use exactly those (a single value forces one provider).
 *  - Unset (default) → a fallback chain over `DEFAULT_ORDER`, skipping providers whose
 *    API key is absent, so a failed/missing provider transparently falls through to the
 *    next. `mock` is only used when explicitly requested.
 */
export function getLLMGateway(): LLMGateway {
  const env = process.env.INTERVIEW_LLM_PROVIDER?.trim();

  if (env) {
    const list = env.split(',').map((s) => s.trim()).filter(Boolean) as LLMProvider[];
    if (list.length === 1) return buildProvider(list[0]);
    if (list.length > 1) return new FallbackGateway(list.map(buildProvider));
  }

  const active = DEFAULT_ORDER.filter(hasKey);
  const chain = (active.length ? active : (['gemini'] as LLMProvider[])).map(buildProvider);
  return new FallbackGateway(chain);
}
