import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  EMOTIONS,
  dominantEmotion,
  analyzeVisionFrame,
  type Emotion,
} from '@/lib/interview/browser/vision-analyzer';
import { composureScore } from '@/lib/interview/browser/metrics';

const emotionValue = fc.double({ min: 0, max: 1, noNaN: true });

// Feature: interview-module, Property 23: Emotion classification and composure are well-formed
describe('Property 23: emotion classification and composure', () => {
  it('dominant emotion is always a member of the emotion set', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.constantFrom(...EMOTIONS), emotionValue) as fc.Arbitrary<
          Partial<Record<Emotion, number>>
        >,
        (dist) => {
          expect(EMOTIONS).toContain(dominantEmotion(dist));
        },
      ),
    );
  });

  it('composure stays within [0, 100]', () => {
    fc.assert(
      fc.property(emotionValue, emotionValue, (angry, confused) => {
        const c = composureScore(angry, confused);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(100);
      }),
    );
  });

  it('analyzeVisionFrame yields a valid emotion and bounded composure', () => {
    fc.assert(
      fc.property(
        fc.record({
          yawDeg: fc.double({ min: -45, max: 45, noNaN: true }),
          pitchDeg: fc.double({ min: -45, max: 45, noNaN: true }),
          shoulderSlopeDeviationDeg: fc.double({ min: -30, max: 30, noNaN: true }),
          emotionDistribution: fc.dictionary(fc.constantFrom(...EMOTIONS), emotionValue),
        }),
        (frame) => {
          const m = analyzeVisionFrame(frame as Parameters<typeof analyzeVisionFrame>[0]);
          expect(EMOTIONS).toContain(m.dominantEmotion);
          expect(m.composure).toBeGreaterThanOrEqual(0);
          expect(m.composure).toBeLessThanOrEqual(100);
        },
      ),
    );
  });
});
