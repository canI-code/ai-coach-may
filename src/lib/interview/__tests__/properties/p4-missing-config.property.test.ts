import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { ObjectId } from 'mongodb';
import { createSession } from '@/lib/interview/orchestrator';
import type { InterviewSessionDoc } from '@/lib/interview/schemas';

const REQUIRED = ['role', 'difficulty', 'durationMinutes', 'difficultyMin', 'difficultyMax'] as const;

const fullConfig = {
  role: 'engineer',
  difficulty: 3,
  durationMinutes: 15,
  difficultyMin: 1,
  difficultyMax: 5,
  aiPersona: 'tech_lead',
};

// Feature: interview-module, Property 4: Missing-field configs are rejected without side effects
describe('Property 4: missing config rejected without side effects', () => {
  it('returns a validation error and never seeds or persists', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...REQUIRED), async (dropKey) => {
        const broken: Record<string, unknown> = { ...fullConfig };
        delete broken[dropKey];

        const inserted: InterviewSessionDoc[] = [];
        let seedCalled = false;
        const res = await createSession(new ObjectId().toHexString(), broken, {
          seed: async () => {
            seedCalled = true;
            return { pool: [], exclusion: [], tiersUsed: [] };
          },
          store: {
            async insertSession(doc) {
              inserted.push(doc);
            },
            async updateSession() {},
            async setPoolCache() {},
          },
        });

        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.kind).toBe('validation_error');
        expect(seedCalled).toBe(false);
        expect(inserted).toHaveLength(0);
      }),
    );
  });
});
