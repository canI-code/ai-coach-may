import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { countFillers, FILLER_REGEX } from '@/lib/interview/browser/metrics';

const expectedMatches = (s: string): number =>
  (s.match(new RegExp(FILLER_REGEX.source, 'gi')) ?? []).length;

// Feature: interview-module, Property 19: Filler count equals regex matches
describe('Property 19: filler count equals regex matches', () => {
  it('equals regex match count for arbitrary text', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(countFillers(s)).toBe(expectedMatches(s));
      }),
    );
  });

  it('equals regex match count for filler-rich text', () => {
    const fillers = ['um', 'uh', 'like', 'basically', 'actually', 'you know'];
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...fillers)),
        fc.array(fc.string()),
        (fs, words) => {
          const text = [...fs, ...words].join(' ');
          expect(countFillers(text)).toBe(expectedMatches(text));
        },
      ),
    );
  });
});
