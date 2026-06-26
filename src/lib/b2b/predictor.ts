/**
 * Placement-readiness AI Predictor for B2B Accreditation Reports.
 */

export interface PlacementReadinessResult {
  score: number;
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Insufficient Data';
  breakdown: {
    communication: number;
    technical: number;
    interview: number;
  };
  details: string;
}

/**
 * Calculates the placement readiness score, tier, and breakdown metrics for a mentee.
 */
export function calculatePlacementReadiness(
  coachingReports: any[] = [],
  assessmentStats: any = null,
  examSessions: any[] = []
): PlacementReadinessResult {
  // 1. Communication Score: average of categoryScores.communication in coachingReports (fallback 50).
  let commSum = 0;
  let commCount = 0;
  if (Array.isArray(coachingReports)) {
    coachingReports.forEach((report) => {
      const val = report?.categoryScores?.communication;
      if (typeof val === 'number') {
        commSum += val;
        commCount++;
      }
    });
  }
  const communicationScore = commCount > 0 ? commSum / commCount : 50;

  // 2. Technical Score:
  // - If assessmentStats?.scorePercentage exists, use it.
  // - If examSessions.length > 0, average their scores.
  // - Combine them (average if both exist, fallback to 50 if none).
  let assessmentScore: number | null = null;
  if (assessmentStats && typeof assessmentStats.scorePercentage === 'number') {
    assessmentScore = assessmentStats.scorePercentage;
  }

  let examSum = 0;
  let examCount = 0;
  if (Array.isArray(examSessions)) {
    examSessions.forEach((session) => {
      let score: number | null = null;
      if (typeof session.scorePercentage === 'number') {
        score = session.scorePercentage;
      } else if (typeof session.score === 'number') {
        score = session.score;
      } else if (Array.isArray(session.attempts) && session.attempts.length > 0) {
        const attemptScores = session.attempts
          .map((a: any) => a.scorePercentage ?? a.score)
          .filter((s: any) => typeof s === 'number');
        if (attemptScores.length > 0) {
          score = attemptScores.reduce((a: number, b: number) => a + b, 0) / attemptScores.length;
        }
      }
      if (score !== null) {
        examSum += score;
        examCount++;
      }
    });
  }
  const avgExamScore = examCount > 0 ? examSum / examCount : null;

  let technicalScore = 50;
  if (assessmentScore !== null && avgExamScore !== null) {
    technicalScore = (assessmentScore + avgExamScore) / 2;
  } else if (assessmentScore !== null) {
    technicalScore = assessmentScore;
  } else if (avgExamScore !== null) {
    technicalScore = avgExamScore;
  }

  // 3. Mock Interview Score: average of ciScore in coachingReports (fallback 50).
  let interviewSum = 0;
  let interviewCount = 0;
  if (Array.isArray(coachingReports)) {
    coachingReports.forEach((report) => {
      const val = report?.ciScore ?? report?.confidenceIndex ?? report?.overallScore;
      if (typeof val === 'number') {
        interviewSum += val;
        interviewCount++;
      }
    });
  }
  const mockInterviewScore = interviewCount > 0 ? interviewSum / interviewCount : 50;

  // 4. Overall weighted score (0-100)
  const score = Math.round(communicationScore * 0.35 + technicalScore * 0.40 + mockInterviewScore * 0.25);

  // 5. Total practice sessions
  const totalSessions = (coachingReports?.length || 0) + (examSessions?.length || 0);

  // 6. Tier Determination
  let tier: 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Insufficient Data';
  if (totalSessions < 1) {
    tier = 'Insufficient Data';
  } else if (score >= 75 && mockInterviewScore >= 70 && technicalScore >= 75) {
    tier = 'Tier 1';
  } else if (score >= 60 && mockInterviewScore >= 55 && technicalScore >= 60) {
    tier = 'Tier 2';
  } else {
    tier = 'Tier 3';
  }

  // 7. Details explanation text
  let details = '';
  if (tier === 'Insufficient Data') {
    details = 'Please complete at least one mock interview or practice exam to generate your placement readiness report.';
  } else if (tier === 'Tier 1') {
    details = 'Excellent readiness! You are fully prepared for Tier 1 companies (Product-based, high-compensation roles like FAANG, top tech startups). Focus on maintaining your technical and communication skills.';
  } else if (tier === 'Tier 2') {
    details = 'Good progress. You are ready for Tier 2 companies (System integrators, mid-tier product firms, consulting). To reach Tier 1, improve your technical score (target 75+) and communication score (target 70+).';
  } else {
    details = 'You are ready for Tier 3 companies (IT services, support, service-oriented roles). Focus on practicing more mock interviews to boost your confidence and revise core technical concepts.';
  }

  return {
    score,
    tier,
    breakdown: {
      communication: Math.round(communicationScore),
      technical: Math.round(technicalScore),
      interview: Math.round(mockInterviewScore),
    },
    details,
  };
}
