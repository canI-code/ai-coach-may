import { calculateNewElo } from '../../lib/proficiency/elo-calculator';
import { calculateDecayedRating } from '../../lib/proficiency/decay-model';
import { ratingToLevel } from '../../lib/proficiency/proficiency-engine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`✅ Passed: ${message}`);
}

function runMathTests() {
  console.log('🧪 Starting Phase 3 Proficiency Engine Mathematics Tests...\n');

  // 1. Test rating discrete maps
  console.log('--- 1. Testing Rating to Level Conversions ---');
  assert(ratingToLevel(600) === 'Beginner', '600 Elo must map to Beginner');
  assert(ratingToLevel(1000) === 'Intermediate', '1000 Elo must map to Intermediate');
  assert(ratingToLevel(1500) === 'Advanced', '1500 Elo must map to Advanced');
  assert(ratingToLevel(2100) === 'Expert', '2100 Elo must map to Expert');

  // 2. Test Elo Probability and Scoring Updates
  console.log('\n--- 2. Testing Elo Updates ---');
  
  // Test case: Beginner (rating 600) answers an Easy question (difficulty 1.0) correctly under 10 seconds.
  const res1 = calculateNewElo({
    currentRating: 600,
    questionDifficulty: 1.0,
    isCorrect: true,
    timeSpentSeconds: 10,
    totalAnswersCount: 5 // First 10 questions uses K=64
  });
  assert(res1.newRating > 600, `Beginner rating should increase on correct answer. New Elo: ${res1.newRating}`);
  assert(res1.actualScore >= 0.95, `Correct fast response score should be near 1.0. Score: ${res1.actualScore}`);

  // Test case: Advanced (rating 1400) answers a Medium question (difficulty 2.0) incorrectly.
  const res2 = calculateNewElo({
    currentRating: 1400,
    questionDifficulty: 2.0,
    isCorrect: false,
    timeSpentSeconds: 35,
    totalAnswersCount: 15 // K=32
  });
  assert(res2.newRating < 1400, `Rating should drop on wrong answer. New Elo: ${res2.newRating}`);
  assert(res2.actualScore === 0.0, 'Incorrect response must yield zero score');

  // 3. Test Inactivity Knowledge Decay Maths
  console.log('\n--- 3. Testing Decay Calculations ---');
  
  // Test case: Expert (rating 2000) has been inactive for 30 days.
  // Expert level uses lambda = 0.035.
  // decayFactor = e^(-0.035 * 30) = e^(-1.05) ≈ 0.35 -> Floored at safe threshold 0.5 (50% retention).
  const dec1 = calculateDecayedRating(2000, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'Expert');
  assert(dec1.decayFactor === 0.5, `Decay factor should floor at 0.5 for expert after 30 days. Factor: ${dec1.decayFactor}`);
  assert(dec1.effectiveRating === 1000, `Expert effective Elo should decay to 1000. Rating: ${dec1.effectiveRating}`);

  // Test case: Beginner (rating 600) has been inactive for 10 days.
  // Beginner level uses lambda = 0.005.
  // decayFactor = e^(-0.005 * 10) = e^(-0.05) ≈ 0.951.
  const dec2 = calculateDecayedRating(600, new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), 'Beginner');
  assert(dec2.decayFactor > 0.94, `Beginner decay factor should be close to 0.95. Factor: ${dec2.decayFactor}`);
  assert(dec2.effectiveRating > 560, `Beginner Elo decays minimally. Rating: ${dec2.effectiveRating}`);

  console.log('\n🎉 All Mathematics Tests Passed Successfully!');
}

runMathTests();
