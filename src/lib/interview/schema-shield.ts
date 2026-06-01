import type { ZodType } from 'zod';
import type { LLMGateway, LLMRequest } from './llm-gateway';

export type ShieldResult<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; error: { kind: 'validation_failed'; lastError: string; attempts: number } };

/** Strip markdown code fences and surrounding prose, isolating the JSON body. */
export function localRepair(raw: string): string {
  let s = raw.replace(/```(?:json)?/gi, '').trim();
  const starts = [s.indexOf('{'), s.indexOf('[')].filter((i) => i !== -1);
  const start = starts.length ? Math.min(...starts) : -1;
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (start !== -1 && end >= start) s = s.slice(start, end + 1);
  return s.trim();
}

export function safeParse<T>(
  schema: ZodType<T>,
  raw: string,
): { ok: true; value: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${(e as Error).message}` };
  }
  const res = schema.safeParse(json);
  return res.success ? { ok: true, value: res.data } : { ok: false, error: res.error.message };
}

/**
 * Dispatch → parse → local repair (no new call) → re-prompt with the validation
 * error appended, up to `maxRetries` additional calls. Total LLM calls ≤ 1 + maxRetries.
 */
export async function validateWithShield<T>(
  schema: ZodType<T>,
  gateway: LLMGateway,
  initial: LLMRequest,
  opts?: { maxRetries?: number },
): Promise<ShieldResult<T>> {
  const maxRetries = opts?.maxRetries ?? 3;
  let attempts = 0;
  let lastError = '';
  let req = initial;

  for (let i = 0; i <= maxRetries; i++) {
    const res = await gateway.complete(req);
    attempts++;

    if (!res.ok) {
      lastError = res.error.message;
    } else {
      const direct = safeParse(schema, res.text);
      if (direct.ok) return { ok: true, value: direct.value, attempts };
      const repaired = safeParse(schema, localRepair(res.text));
      if (repaired.ok) return { ok: true, value: repaired.value, attempts };
      lastError = repaired.error;
    }

    req = {
      ...initial,
      prompt: `${initial.prompt}\n\nYour previous response was invalid: ${lastError}\nReturn ONLY JSON matching the required schema.`,
    };
  }

  return { ok: false, error: { kind: 'validation_failed', lastError, attempts } };
}
