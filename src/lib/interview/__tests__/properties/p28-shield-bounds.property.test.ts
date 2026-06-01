import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { z } from 'zod';
import { validateWithShield } from '@/lib/interview/schema-shield';
import type { LLMGateway, LLMResult } from '@/lib/interview/llm-gateway';

const S = z.object({ a: z.number() });

type Kind = 'valid' | 'invalidJson' | 'wrongShape' | 'providerError';

function response(kind: Kind): LLMResult {
  switch (kind) {
    case 'valid':
      return { ok: true, text: '{"a":1}' };
    case 'invalidJson':
      return { ok: true, text: 'not json at all' };
    case 'wrongShape':
      return { ok: true, text: '{"a":"not-a-number"}' };
    case 'providerError':
      return { ok: false, error: { kind: 'provider_error', message: 'boom' } };
  }
}

function countingGateway(kinds: Kind[]): LLMGateway & { calls: number } {
  const g = {
    calls: 0,
    async complete(): Promise<LLMResult> {
      const kind = kinds[g.calls] ?? 'wrongShape';
      g.calls++;
      return response(kind);
    },
  };
  return g;
}

// Feature: interview-module, Property 28: Schema Shield bounds LLM calls and never returns invalid data
describe('Property 28: shield call bound and validity', () => {
  it('makes <= 4 calls and only returns schema-valid data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom<Kind>('valid', 'invalidJson', 'wrongShape', 'providerError'), {
          maxLength: 8,
        }),
        async (kinds) => {
          const gateway = countingGateway(kinds);
          const result = await validateWithShield(S, gateway, { prompt: 'p' });
          expect(gateway.calls).toBeLessThanOrEqual(4);
          if (result.ok) {
            expect(result.attempts).toBe(gateway.calls);
            expect(S.safeParse(result.value).success).toBe(true);
          } else {
            expect(result.error.kind).toBe('validation_failed');
            expect(result.error.attempts).toBeLessThanOrEqual(4);
          }
        },
      ),
    );
  });
});
