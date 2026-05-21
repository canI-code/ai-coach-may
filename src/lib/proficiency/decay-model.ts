/**
 * Decay lambda value per difficulty level
 */
export function getDecayLambda(level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'): number {
  switch (level) {
    case 'Beginner': return 0.005; // Fades very slowly (basics stick around)
    case 'Intermediate': return 0.010; // Medium fading speed
    case 'Advanced': return 0.020; // Complex details fade faster
    case 'Expert': return 0.035; // Cutting edge nuances fade the fastest
    default: return 0.010;
  }
}

/**
 * Calculates decayed ability rating based on days of inactivity
 * Formula: Rating_effective = Rating_actual * e^(-lambda * days)
 */
export function calculateDecayedRating(
  actualRating: number,
  lastPracticedAt: Date,
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
): { effectiveRating: number; decayFactor: number } {
  const millisecondsInDay = 1000 * 60 * 60 * 24;
  const elapsedDays = Math.max(0, (Date.now() - new Date(lastPracticedAt).getTime()) / millisecondsInDay);

  const lambda = getDecayLambda(level);
  // Negative exponential curve
  const decayFactor = Math.max(0.5, Math.exp(-lambda * elapsedDays)); // Safe floor of 50%
  const effectiveRating = Math.round(actualRating * decayFactor);

  return {
    effectiveRating,
    decayFactor,
  };
}
