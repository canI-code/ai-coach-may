import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

const hoisted = vi.hoisted(() => ({ thrown: new Error('init') as unknown }));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => {
          throw hoisted.thrown;
        },
      };
    }
  },
}));

import { getLLMGateway } from '@/lib/interview/llm-gateway';

// Feature: interview-module, Property 39: Provider errors surface as typed gateway results
describe('Property 39: provider errors surface as typed results', () => {
  beforeEach(() => {
    process.env.GOOGLE_AI_API_KEY = 'test-key';
    process.env.INTERVIEW_LLM_PROVIDER = 'gemini';
  });

  it('never throws and always returns a typed { ok: false }', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          message: fc.string(),
          status: fc.option(fc.constantFrom(429, 500, 503), { nil: undefined }),
        }),
        async ({ message, status }) => {
          const err: Error & { status?: number } = new Error(message);
          if (status !== undefined) err.status = status;
          hoisted.thrown = err;

          const res = await getLLMGateway().complete({ prompt: 'hello' });
          expect(res.ok).toBe(false);
          if (!res.ok) {
            expect(['provider_error', 'timeout', 'rate_limited']).toContain(res.error.kind);
          }
        },
      ),
    );
  });
});
