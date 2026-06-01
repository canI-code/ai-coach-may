import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/mongodb', () => ({ default: Promise.resolve({ db: () => ({}) }) }));

import { canTransition } from '@/lib/interview/orchestrator';
import type { SessionStatus } from '@/lib/interview/schemas';

const STATUSES: SessionStatus[] = ['seeding', 'active', 'completed', 'abandoned'];
const ALLOWED = new Set(['seeding>active', 'seeding>abandoned', 'active>completed', 'active>abandoned']);

// Feature: interview-module, Property 3: Lifecycle transitions are forward-only
describe('Property 3: lifecycle transitions forward-only', () => {
  it('permits only seeding→active→completed and abandoned from seeding/active', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATUSES), fc.constantFrom(...STATUSES), (from, to) => {
        expect(canTransition(from, to)).toBe(ALLOWED.has(`${from}>${to}`));
      }),
    );
  });

  it('never permits a same-state or backward transition', () => {
    for (const s of STATUSES) expect(canTransition(s, s)).toBe(false);
    expect(canTransition('active', 'seeding')).toBe(false);
    expect(canTransition('completed', 'active')).toBe(false);
    expect(canTransition('completed', 'seeding')).toBe(false);
    expect(canTransition('abandoned', 'active')).toBe(false);
  });
});
