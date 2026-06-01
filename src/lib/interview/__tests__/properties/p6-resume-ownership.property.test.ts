import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { ObjectId } from 'mongodb';
import { resume } from '@/lib/interview/orchestrator';
import type { InterviewSessionDoc } from '@/lib/interview/schemas';

function ownedSession(ownerId: ObjectId): InterviewSessionDoc {
  return {
    _id: new ObjectId(),
    userId: ownerId,
    status: 'active',
    config: {
      role: 'engineer',
      difficulty: 3,
      questionCount: 5,
      durationMinutes: 15,
      aiPersona: 'tech_lead',
      difficultyMin: 1,
      difficultyMax: 5,
    },
    currentQuestionIndex: 0,
    currentDifficulty: 3,
    pool: [],
    exclusion: [],
    turns: [],
    behavioralTimeline: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Feature: interview-module, Property 6: Resume enforces ownership
describe('Property 6: resume enforces ownership', () => {
  it('returns an authorization error when the requester is not the owner', async () => {
    await fc.assert(
      fc.asyncProperty(fc.hexaString({ minLength: 24, maxLength: 24 }), async (requesterHex) => {
        const owner = new ObjectId();
        // Skip the (vanishingly rare) collision where requester == owner.
        fc.pre(requesterHex !== owner.toHexString());

        const session = ownedSession(owner);
        const res = await resume(requesterHex, session._id.toHexString(), {
          store: {
            async findSession() {
              return session;
            },
            async findReport() {
              return null;
            },
          },
        });

        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.kind).toBe('authorization_error');
      }),
    );
  });
});
