export interface TierDecision {
  fullAccess: true;
  stripFeedback: false;
  monthlyLimit: null;
}

/**
 * Single seam for all tier-dependent decisions. v1 always grants full access;
 * later versions swap the implementation without changing call sites.
 */
export function tierGate(_userId: string): TierDecision {
  return { fullAccess: true, stripFeedback: false, monthlyLimit: null };
}
