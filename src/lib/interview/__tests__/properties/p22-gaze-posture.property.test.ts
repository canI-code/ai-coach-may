import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  classifyGazeDown,
  classifyPostureDistortion,
  classifySidewaysDistraction,
} from '@/lib/interview/browser/vision-analyzer';

// Feature: interview-module, Property 22: Gaze and posture threshold classifications
describe('Property 22: gaze and posture threshold classifications', () => {
  it('classifies looking-down exactly when pitch < -15', () => {
    fc.assert(
      fc.property(fc.double({ min: -90, max: 90, noNaN: true }), (pitch) => {
        expect(classifyGazeDown(pitch)).toBe(pitch < -15);
      }),
    );
  });

  it('flags posture distortion exactly when |deviation| > 7', () => {
    fc.assert(
      fc.property(fc.double({ min: -45, max: 45, noNaN: true }), (dev) => {
        expect(classifyPostureDistortion(dev)).toBe(Math.abs(dev) > 7);
      }),
    );
  });

  it('flags sideways distraction exactly when a >15 run spans > 3.5s', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.double({ min: 0.05, max: 2, noNaN: true }),
        (count, dt) => {
          const samples = Array.from({ length: count }, (_, i) => ({
            tSeconds: i * dt,
            yawDeg: 20,
          }));
          expect(classifySidewaysDistraction(samples)).toBe((count - 1) * dt > 3.5);
        },
      ),
    );
  });

  it('never flags when all yaw within ±15', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            tSeconds: fc.double({ min: 0, max: 100, noNaN: true }),
            yawDeg: fc.double({ min: -15, max: 15, noNaN: true }),
          }),
        ),
        (samples) => {
          expect(classifySidewaysDistraction(samples)).toBe(false);
        },
      ),
    );
  });
});
