// Feature: candidate-dashboard-suite
// Report poll state machine (pure)

import type { PollState, PollEvent } from './types';
import { PENDING_TIMEOUT_MS, MAX_CONSECUTIVE_FAILURES } from './constants';

export function pollReducer(state: PollState, event: PollEvent): PollState {
  switch (event.type) {
    case 'pending':
    case 'not-found': {
      const newElapsed = event.elapsedMs;
      if (newElapsed >= PENDING_TIMEOUT_MS) {
        return {
          ...state,
          status: 'still-preparing',
          shouldPoll: false,
          elapsedPendingMs: newElapsed,
        };
      }
      return {
        ...state,
        status: 'preparing',
        shouldPoll: true,
        consecutiveFailures: 0,
        elapsedPendingMs: newElapsed,
      };
    }

    case 'ready':
      return {
        ...state,
        status: 'ready',
        shouldPoll: false,
      };

    case 'failed':
      return {
        ...state,
        status: 'failed',
        shouldPoll: false,
      };

    case 'transient-failure': {
      const newFailures = state.consecutiveFailures + 1;
      if (newFailures >= MAX_CONSECUTIVE_FAILURES) {
        return {
          ...state,
          status: 'status-unavailable',
          shouldPoll: false,
          consecutiveFailures: newFailures,
        };
      }
      return {
        ...state,
        shouldPoll: true,
        consecutiveFailures: newFailures,
      };
    }

    default:
      return state;
  }
}
