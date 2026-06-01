// Feature: candidate-dashboard-suite, Property 7: Pending polling schedules and stops on the pending timeout
// Feature: candidate-dashboard-suite, Property 8: Consecutive poll failures stop polling at the threshold

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pollReducer } from '../poll-machine';
import type { PollState } from '../types';
import { PENDING_TIMEOUT_MS, MAX_CONSECUTIVE_FAILURES } from '../constants';

const initialBaseState: PollState = {
  status: 'preparing',
  shouldPoll: true,
  consecutiveFailures: 0,
  elapsedPendingMs: 0,
};

describe('Dashboard Suite: Poll State Machine', () => {
  it('Property 7: Pending polling schedules and stops on the pending timeout', () => {
    fc.assert(
      fc.property(
        fc.record({
          elapsedMs: fc.integer({ min: 0, max: PENDING_TIMEOUT_MS * 2 }),
          type: fc.constantFrom<'pending' | 'not-found'>('pending', 'not-found'),
          currentState: fc.record({
            status: fc.constantFrom<'preparing' | 'ready' | 'failed' | 'still-preparing' | 'status-unavailable'>('preparing', 'status-unavailable'),
            shouldPoll: fc.boolean(),
            consecutiveFailures: fc.integer({ min: 0, max: 10 }),
            elapsedPendingMs: fc.integer({ min: 0 })
          })
        }),
        ({ elapsedMs, type, currentState }) => {
          const nextState = pollReducer(currentState, { type, elapsedMs });

          expect(nextState.elapsedPendingMs).toBe(elapsedMs);

          if (elapsedMs >= PENDING_TIMEOUT_MS) {
            expect(nextState.status).toBe('still-preparing');
            expect(nextState.shouldPoll).toBe(false);
            expect(nextState.consecutiveFailures).toBe(currentState.consecutiveFailures);
          } else {
            expect(nextState.status).toBe('preparing');
            expect(nextState.shouldPoll).toBe(true);
            expect(nextState.consecutiveFailures).toBe(0);
          }
        }
      )
    );
  });

  it('Property 8: Consecutive poll failures stop polling at the threshold', () => {
    fc.assert(
      fc.property(
        fc.record({
          currentState: fc.record({
            status: fc.constantFrom<'preparing' | 'ready' | 'failed' | 'still-preparing' | 'status-unavailable'>('preparing'),
            shouldPoll: fc.boolean(),
            consecutiveFailures: fc.integer({ min: 0, max: MAX_CONSECUTIVE_FAILURES + 5 }),
            elapsedPendingMs: fc.integer({ min: 0 })
          })
        }),
        ({ currentState }) => {
          const nextState = pollReducer(currentState, { type: 'transient-failure' });

          expect(nextState.consecutiveFailures).toBe(currentState.consecutiveFailures + 1);

          if (nextState.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            expect(nextState.status).toBe('status-unavailable');
            expect(nextState.shouldPoll).toBe(false);
          } else {
            expect(nextState.shouldPoll).toBe(true);
            expect(nextState.status).toBe(currentState.status); // Should not change status if below threshold
          }
        }
      )
    );
  });

  it('Property: Ready and failed events stop polling', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constantFrom<'ready' | 'failed'>('ready', 'failed'),
          currentState: fc.record({
            status: fc.constantFrom<'preparing' | 'ready' | 'failed' | 'still-preparing' | 'status-unavailable'>('preparing', 'still-preparing'),
            shouldPoll: fc.boolean(),
            consecutiveFailures: fc.integer({ min: 0, max: 10 }),
            elapsedPendingMs: fc.integer({ min: 0 })
          })
        }),
        ({ type, currentState }) => {
          const nextState = pollReducer(currentState, { type });

          expect(nextState.status).toBe(type);
          expect(nextState.shouldPoll).toBe(false);
          expect(nextState.consecutiveFailures).toBe(currentState.consecutiveFailures);
        }
      )
    );
  });
});