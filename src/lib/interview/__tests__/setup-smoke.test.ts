import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
// Validates the `@/` alias resolution against a real source module.
import { INTERESTS_TAXONOMY } from '@/lib/taxonomy';
import { z } from 'zod';

describe('toolchain smoke', () => {
  it('runs a fast-check property', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => a + b === b + a),
      { numRuns: 100 },
    );
  });

  it('resolves the @/ alias to src', () => {
    expect(INTERESTS_TAXONOMY).toBeDefined();
  });

  it('loads zod', () => {
    expect(z.string().parse('ok')).toBe('ok');
  });
});
