import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateCues } from '@/lib/interview/browser/realtime-coach';

const EMOTION = fc.constantFrom('angry', 'sad', 'confused', 'happy', 'calm', 'neutral', 'surprised');

// Feature: interview-module, Property 24: Coaching cues correspond exactly to threshold breaches
describe('Property 24: coaching cues match threshold breaches', () => {
  it('contains exactly the cues for breached thresholds', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 400, noNaN: true }),
        fc.nat({ max: 20 }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.boolean(),
        EMOTION,
        (wpm, fillerCount, eyeContact, postureDistortion, emotion) => {
          const cues = evaluateCues({ wpm, fillerCount, eyeContact, postureDistortion, emotion });
          expect(cues.includes('too-fast')).toBe(wpm > 160);
          expect(cues.includes('too-slow')).toBe(wpm > 0 && wpm < 55);
          expect(cues.includes('too-many-fillers')).toBe(fillerCount > 3);
          expect(cues.includes('poor-eye-contact')).toBe(eyeContact < 60);
          expect(cues.includes('poor-posture')).toBe(postureDistortion);
          expect(cues.includes('negative-emotion')).toBe(
            ['angry', 'sad', 'confused'].includes(emotion),
          );
        },
      ),
    );
  });
 
  it('is empty when all metrics are within thresholds', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 55, max: 160, noNaN: true }),
        fc.nat({ max: 3 }),
        fc.double({ min: 60, max: 100, noNaN: true }),
        fc.constantFrom('happy', 'calm', 'neutral', 'surprised'),
        (wpm, fillerCount, eyeContact, emotion) => {
          const cues = evaluateCues({
            wpm,
            fillerCount,
            eyeContact,
            postureDistortion: false,
            emotion,
          });
          expect(cues).toEqual([]);
        },
      ),
    );
  });
});
