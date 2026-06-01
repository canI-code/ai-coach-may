import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { classifyPace, computeWpm } from '@/lib/interview/browser/metrics';

// Feature: interview-module, Property 20: WPM is non-negative and pace classification respects thresholds
describe('Property 20: WPM non-negative and pace thresholds', () => {
  it('WPM is >= 0 for any word count and positive duration', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5000 }),
        fc.double({ min: 0.001, max: 3600, noNaN: true }),
        (words, duration) => {
          expect(computeWpm(words, duration)).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });

  it('classifies pace strictly by threshold', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (wpm) => {
        const pace = classifyPace(wpm);
        if (wpm > 160) expect(pace).toBe('fast');
        else if (wpm > 0 && wpm < 55) expect(pace).toBe('slow');
        else expect(pace).toBe('normal');
      }),
    );
  });
});
