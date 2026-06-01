import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { tierGate } from '@/lib/interview/tier-gate';

// Feature: interview-module, Property 38: v1 Tier_Gate always grants full feedback access
describe('Property 38: v1 tier gate grants full access', () => {
  it('returns full access for any candidate id', () => {
    fc.assert(
      fc.property(fc.string(), (userId) => {
        const decision = tierGate(userId);
        expect(decision.fullAccess).toBe(true);
        expect(decision.stripFeedback).toBe(false);
        expect(decision.monthlyLimit).toBeNull();
      }),
    );
  });
});
