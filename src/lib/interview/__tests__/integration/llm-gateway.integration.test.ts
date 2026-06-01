import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLLMGateway } from '@/lib/interview/llm-gateway';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const interviewRoot = path.resolve(thisDir, '../..'); // src/lib/interview

async function collectTs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await collectTs(full)));
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('LLM_Gateway integration: provider selection + no-direct-SDK rule', () => {
  afterEach(() => {
    delete process.env.INTERVIEW_LLM_PROVIDER;
  });

  it('defaults to a fallback chain over multiple providers', () => {
    delete process.env.INTERVIEW_LLM_PROVIDER;
    expect(getLLMGateway().constructor.name).toBe('FallbackGateway');
  });

  it('forces a single provider via env (gemini / openai)', () => {
    process.env.INTERVIEW_LLM_PROVIDER = 'gemini';
    expect(getLLMGateway().constructor.name).toBe('GeminiGateway');
    process.env.INTERVIEW_LLM_PROVIDER = 'openai';
    expect(getLLMGateway().constructor.name).toBe('OpenAICompatGateway');
  });

  it('no interview module imports a provider SDK directly except llm-gateway.ts', async () => {
    const files = await collectTs(interviewRoot);
    const offenders: string[] = [];
    for (const f of files) {
      if (f.endsWith('llm-gateway.ts')) continue;
      if (f.includes(`${path.sep}__tests__${path.sep}`)) continue;
      const src = await fs.readFile(f, 'utf8');
      if (/from\s+['"]@google\/generative-ai['"]/.test(src) || /from\s+['"]openai['"]/.test(src)) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });
});
