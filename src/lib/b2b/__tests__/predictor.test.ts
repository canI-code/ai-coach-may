import { describe, it, expect } from 'vitest';
import { calculatePlacementReadiness } from '../predictor';

describe('calculatePlacementReadiness', () => {
  it('should return Insufficient Data when there are no reports or sessions', () => {
    const result = calculatePlacementReadiness([], null, []);
    expect(result.tier).toBe('Insufficient Data');
    expect(result.score).toBe(50); // Fallback: 50 * 0.35 + 50 * 0.40 + 50 * 0.25 = 50
    expect(result.details).toContain('Please complete');
  });

  it('should calculate Tier 1 readiness correctly', () => {
    const coachingReports = [
      { categoryScores: { communication: 80 }, ciScore: 85 }
    ];
    const assessmentStats = { scorePercentage: 90 };
    const examSessions = [
      { scorePercentage: 80 }
    ];

    // Comm: 80
    // Tech: (90 + 80) / 2 = 85
    // Interview: 85
    // Overall: 80 * 0.35 + 85 * 0.40 + 85 * 0.25 = 28 + 34 + 21.25 = 83.25 -> 83
    const result = calculatePlacementReadiness(coachingReports, assessmentStats, examSessions);
    expect(result.score).toBe(83);
    expect(result.tier).toBe('Tier 1');
    expect(result.breakdown.communication).toBe(80);
    expect(result.breakdown.technical).toBe(85);
    expect(result.breakdown.interview).toBe(85);
    expect(result.details).toContain('fully prepared for Tier 1 companies');
  });

  it('should fall back to Tier 3 when scores are low', () => {
    const coachingReports = [
      { categoryScores: { communication: 55 }, ciScore: 50 }
    ];
    const assessmentStats = { scorePercentage: 58 };

    // Comm: 55
    // Tech: 58
    // Interview: 50
    // Overall: 55 * 0.35 + 58 * 0.40 + 50 * 0.25 = 19.25 + 23.2 + 12.5 = 54.95 -> 55
    const result = calculatePlacementReadiness(coachingReports, assessmentStats, []);
    expect(result.score).toBe(55);
    expect(result.tier).toBe('Tier 3');
    expect(result.details).toContain('IT services');
  });

  it('should calculate Tier 2 readiness correctly', () => {
    const coachingReports = [
      { categoryScores: { communication: 65 }, ciScore: 60 }
    ];
    const assessmentStats = { scorePercentage: 62 };

    // Comm: 65
    // Tech: 62
    // Interview: 60
    // Overall: 65 * 0.35 + 62 * 0.40 + 60 * 0.25 = 22.75 + 24.8 + 15 = 62.55 -> 63
    const result = calculatePlacementReadiness(coachingReports, assessmentStats, []);
    expect(result.score).toBe(63);
    expect(result.tier).toBe('Tier 2');
    expect(result.details).toContain('Tier 2 companies');
  });
});
