import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { z } from 'zod';
import { validateWithShield } from '@/lib/interview/schema-shield';
import type { LLMGateway, LLMResult } from '@/lib/interview/llm-gateway';

const S = z.object({ a: z.number(), b: z.string() });

// prose with no braces/brackets/backticks so it cannot interfere with extraction
const safe = fc.string().map((s) => s.replace(/[{}[\]`]/g, ''));

function oneShotGateway(text: string): LLMGateway & { calls: number } {
  const g = {
    calls: 0,
    async complete(): Promise<LLMResult> {
      g.calls++;
      return { ok: true, text };
    },
  };
  return g;
}

// Feature: interview-module, Property 29: Code-fenced valid JSON is repaired locally without re-prompting
describe('Property 29: fenced JSON repaired without re-prompt', () => {
  it('succeeds with exactly one LLM call', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ a: fc.integer(), b: safe }),
        safe,
        safe,
        async (obj, pre, post) => {
          const text = `${pre}\n\`\`\`json\n${JSON.stringify(obj)}\n\`\`\`\n${post}`;
          const gateway = oneShotGateway(text);
          const result = await validateWithShield(S, gateway, { prompt: 'p' });
          expect(result.ok).toBe(true);
          if (result.ok) expect(result.attempts).toBe(1);
          expect(gateway.calls).toBe(1);
        },
      ),
    );
  });
});
