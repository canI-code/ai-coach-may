// Feature: candidate-dashboard-suite, Property 9: Access checks run before reads and in fixed order
// Feature: candidate-dashboard-suite, Property 10: Unauthenticated requests leak nothing
// Feature: candidate-dashboard-suite, Property 11: Reads are owner/scope confined
// Feature: candidate-dashboard-suite, Property 12: Failure outcomes are mutually distinguishable

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { decideReportOutcome, type AccessContext } from '../access';

describe('Dashboard Suite: Access-Outcome Decision', () => {
  it('Property 9 & 10: Unauthenticated requests always return unauthorized and leak nothing', () => {
    fc.assert(
      fc.property(
        fc.record({
          sessionExists: fc.boolean(),
          isOwner: fc.boolean(),
          hasReport: fc.boolean(),
          status: fc.string()
        }),
        (params) => {
          const ctx: AccessContext = { authenticated: false, ...params };
          const outcome = decideReportOutcome(ctx);
          expect(outcome.type).toBe('unauthorized');
          // Outcome has zero payload
          expect(Object.keys(outcome)).toHaveLength(1);
        }
      )
    );
  });

  it('Property 9: Existence is checked after authentication and before ownership', () => {
    fc.assert(
      fc.property(
        fc.record({
          isOwner: fc.boolean(),
          hasReport: fc.boolean(),
          status: fc.string()
        }),
        (params) => {
          const ctx: AccessContext = { authenticated: true, sessionExists: false, ...params };
          const outcome = decideReportOutcome(ctx);
          expect(outcome.type).toBe('not-found');
          expect(Object.keys(outcome)).toHaveLength(1);
        }
      )
    );
  });

  it('Property 11: Reads are owner/scope confined', () => {
    fc.assert(
      fc.property(
        fc.record({
          hasReport: fc.boolean(),
          status: fc.string()
        }),
        (params) => {
          const ctx: AccessContext = { authenticated: true, sessionExists: true, isOwner: false, ...params };
          const outcome = decideReportOutcome(ctx);
          expect(outcome.type).toBe('authorization-error');
          expect(Object.keys(outcome)).toHaveLength(1);
        }
      )
    );
  });

  it('Property 12: Success outcome is distinguishable and has no extra payload here', () => {
    fc.assert(
      fc.property(
        fc.record({
          hasReport: fc.boolean(),
          status: fc.string()
        }),
        (params) => {
          const ctx: AccessContext = { authenticated: true, sessionExists: true, isOwner: true, ...params };
          const outcome = decideReportOutcome(ctx);
          expect(outcome.type).toBe('success');
          expect(Object.keys(outcome)).toHaveLength(1);
        }
      )
    );
  });
});