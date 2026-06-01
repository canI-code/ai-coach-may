import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { eyeContactScore } from '@/lib/interview/browser/metrics';

// Feature: interview-module, Property 21: Eye-contact score is bounded and decays with angle
describe('Property 21: eye-contact score bounded and decays', () => {
  it('always lies within [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true }),
        fc.double({ min: -90, max: 90, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (yaw, pitch, gaze) => {
          const s = eyeContactScore(yaw, pitch, gaze);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(100);
        },
      ),
    );
  });

  it('is exactly 100 when |yaw| and |pitch| are below 10 deg (default gaze)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -9.999, max: 9.999, noNaN: true }),
        fc.double({ min: -9.999, max: 9.999, noNaN: true }),
        (yaw, pitch) => {
          expect(eyeContactScore(yaw, pitch)).toBe(100);
        },
      ),
    );
  });

  it('is non-increasing as the dominant angle grows', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 30, noNaN: true }),
        fc.double({ min: 0, max: 30, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, delta, gaze) => {
          const lo = eyeContactScore(a, 0, gaze);
          const hi = eyeContactScore(a + delta, 0, gaze);
          expect(hi).toBeLessThanOrEqual(lo + 1e-9);
        },
      ),
    );
  });
});
