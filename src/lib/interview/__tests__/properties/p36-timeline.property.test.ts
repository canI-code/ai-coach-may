import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildTimeline, formatTimestamp, type Cue } from '@/lib/interview/browser/realtime-coach';

const CUES: Cue[] = [
  'too-fast',
  'too-slow',
  'too-many-fillers',
  'poor-eye-contact',
  'poor-posture',
  'negative-emotion',
];

// Feature: interview-module, Property 36: Behavioral timeline is ordered and format-faithful
describe('Property 36: behavioral timeline ordered and format-faithful', () => {
  it('is ordered by non-decreasing timestamp with valid severities', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            tSeconds: fc.double({ min: 0, max: 6000, noNaN: true }),
            cue: fc.constantFrom(...CUES),
          }),
        ),
        (events) => {
          const tl = buildTimeline(events);
          expect(tl.length).toBe(events.length);
          for (let i = 1; i < tl.length; i++) {
            expect(tl[i].tSeconds).toBeGreaterThanOrEqual(tl[i - 1].tSeconds);
          }
          for (const e of tl) expect(['info', 'warning', 'critical']).toContain(e.severity);
        },
      ),
    );
  });

  it('formats mm:ss exactly from the timestamp in seconds', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100000, noNaN: true }), (t) => {
        const total = Math.floor(t);
        const mm = Math.floor(total / 60);
        const ss = total % 60;
        const expected = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
        expect(formatTimestamp(t)).toBe(expected);
      }),
    );
  });
});
