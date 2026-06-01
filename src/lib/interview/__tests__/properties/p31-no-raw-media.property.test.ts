import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { AnswerSubmitPayloadSchema, type AggregatedMetrics } from '@/lib/interview/schemas';
import { buildEvaluationPrompt, buildGenerationPrompt } from '@/lib/interview/prompt-builder';

const metricsArb: fc.Arbitrary<AggregatedMetrics> = fc.record({
  wpmArr: fc.array(fc.double({ min: 0, max: 300, noNaN: true })),
  fillerCount: fc.nat({ max: 50 }),
  eyeContactArr: fc.array(fc.double({ min: 0, max: 100, noNaN: true })),
  postureArr: fc.array(fc.double({ min: 0, max: 100, noNaN: true })),
  pitchVariance: fc.double({ min: 0, max: 1000, noNaN: true }),
  loudnessVariance: fc.double({ min: 0, max: 1000, noNaN: true }),
  sentiment: fc.double({ min: -1, max: 1, noNaN: true }),
  dominantEmotion: fc.constantFrom('happy', 'calm', 'sad', 'angry', 'confused', 'surprised', 'neutral'),
  composure: fc.double({ min: 0, max: 100, noNaN: true }),
  pace: fc.constantFrom('slow', 'normal', 'fast'),
});

const MEDIA_KEYS = ['audio', 'video', 'audioBlob', 'videoFrame', 'rawAudio', 'rawVideo', 'blob', 'buffer'];
const safeText = fc.string().map((s) => s.replace(/data:|base64/gi, ''));

// Feature: interview-module, Property 31: Answer payloads and LLM prompts carry no raw media
describe('Property 31: no raw media in payloads or prompts', () => {
  it('accepts clean payloads with exactly the allowed keys', () => {
    fc.assert(
      fc.property(fc.nat({ max: 50 }), fc.string(), metricsArb, (questionIndex, transcript, metrics) => {
        const parsed = AnswerSubmitPayloadSchema.safeParse({ questionIndex, transcript, metrics });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(Object.keys(parsed.data).sort()).toEqual(['metrics', 'questionIndex', 'transcript']);
        }
      }),
    );
  });

  it('rejects any payload carrying a media field', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50 }),
        fc.string(),
        metricsArb,
        fc.constantFrom(...MEDIA_KEYS),
        (questionIndex, transcript, metrics, mediaKey) => {
          const payload = { questionIndex, transcript, metrics, [mediaKey]: 'AAAA' };
          expect(AnswerSubmitPayloadSchema.safeParse(payload).success).toBe(false);
        },
      ),
    );
  });

  it('assembled prompts contain no media markers', () => {
    fc.assert(
      fc.property(safeText, metricsArb, (transcript, metrics) => {
        const evalPrompt = buildEvaluationPrompt({
          questionText: 'q',
          idealAnswer: 'a',
          metrics,
          priorHistory: [],
          transcript,
          persona: 'tech_lead',
        }).prompt;
        const genPrompt = buildGenerationPrompt({
          role: 'engineer',
          difficulty: 3,
          windowTranscripts: [transcript],
          excludedQuestions: [],
          persona: 'tech_lead',
        }).prompt;
        for (const p of [evalPrompt, genPrompt]) {
          expect(/data:audio|data:video|;base64/i.test(p)).toBe(false);
        }
      }),
    );
  });
});
