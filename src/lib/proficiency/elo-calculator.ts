export interface EloUpdateArgs {
  currentRating: number;
  questionDifficulty: number; // 1.0 to 4.0 scale
  isCorrect: boolean;
  timeSpentSeconds: number;
  totalAnswersCount: number;
}

/**
 * Converts difficulty numeric scale (1-4) to Elo scale (400-2400)
 */
export function difficultyToElo(difficultyNumeric: number): number {
  // Easy (1) -> 600, Medium (2) -> 1000, Hard (3) -> 1500, Expert (4) -> 2000
  if (difficultyNumeric <= 1) return 600;
  if (difficultyNumeric <= 2) return 1000;
  if (difficultyNumeric <= 3) return 1500;
  return 2000;
}

/**
 * Pure Elo calculator
 */
export function calculateNewElo({
  currentRating,
  questionDifficulty,
  isCorrect,
  timeSpentSeconds,
  totalAnswersCount,
}: EloUpdateArgs): { newRating: number; expectedScore: number; actualScore: number } {
  const targetDifficultyElo = difficultyToElo(questionDifficulty);

  // 1. Expected outcome probability
  // P(Correct) = 1 / (1 + 10^((DiffElo - PlayerRating) / 400))
  const expectedScore = 1.0 / (1.0 + Math.pow(10, (targetDifficultyElo - currentRating) / 400));

  // 2. Score calculations with strict time penalties
  // Max time bonus for quick correct answers, zero score for incorrect or slow responses
  const MAX_TIME_LIMIT = 120; // 2 minutes
  let actualScore = 0;
  
  if (isCorrect) {
    // Quick answer bonus: linear scale from 1.0 (0s taken) down to 0.75 (120s taken)
    const timeBonus = Math.max(0.75, 1.0 - (timeSpentSeconds / MAX_TIME_LIMIT) * 0.25);
    actualScore = Number(timeBonus.toFixed(3));
  } else {
    actualScore = 0.0;
  }

  // 3. Dynamic K-factor adjustment based on user history (rapid sizing -> settling -> stabilizing)
  let kFactor = 16;
  if (totalAnswersCount <= 10) {
    kFactor = 64; // Rapid initial scaling
  } else if (totalAnswersCount <= 30) {
    kFactor = 32; // Calibrating
  }

  // 4. Update rating
  let ratingDiff = kFactor * (actualScore - expectedScore);
  
  // Enforce lower bounds of 400 and upper bounds of 2400
  let newRating = Math.round(currentRating + ratingDiff);
  newRating = Math.max(400, Math.min(2400, newRating));

  return {
    newRating,
    expectedScore,
    actualScore,
  };
}
