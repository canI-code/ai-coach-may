// Feature: candidate-dashboard-suite
// Access-outcome decision (pure)

export type AccessOutcome =
  | { type: 'unauthorized' }
  | { type: 'authorization-error' }
  | { type: 'not-found' }
  | { type: 'success' };

export interface AccessContext {
  authenticated: boolean;
  sessionExists: boolean;
  isOwner: boolean;
  hasReport: boolean;
  status: string;
}

export function decideReportOutcome(ctx: AccessContext): AccessOutcome {
  if (!ctx.authenticated) {
    return { type: 'unauthorized' };
  }

  if (!ctx.sessionExists) {
    return { type: 'not-found' };
  }

  if (!ctx.isOwner) {
    return { type: 'authorization-error' };
  }

  return { type: 'success' };
}
