import { ObjectId } from 'mongodb';
import clientPromise from '../mongodb';
import { UserProficiency, InterestProficiency, ProficiencyLevel } from '../assessment';
import { calculateNewElo } from './elo-calculator';
import { calculateDecayedRating } from './decay-model';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

/**
 * Converts Elo ratings to discrete levels
 */
export function ratingToLevel(rating: number): ProficiencyLevel {
  if (rating <= 800) return 'Beginner';
  if (rating <= 1200) return 'Intermediate';
  if (rating <= 1800) return 'Advanced';
  return 'Expert';
}

export class ProficiencyEngine {
  /**
   * Fetches or bootstraps the multi-dimensional proficiency profile for a user
   */
  public static async getUserProficiency(userId: ObjectId): Promise<UserProficiency> {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    let profile = await db.collection('user_proficiency').findOne({ userId }) as unknown as UserProficiency | null;

    if (!profile) {
      // 1. Check legacy user assessment stats to bootstrap profile
      const legacyStats = await db.collection('user_assessment_stats').findOne({ userId });
      const interestsDoc = await db.collection('user_profile').findOne({ userId });
      const interests: string[] = interestsDoc?.interests || ['Algorithms', 'Data Structures', 'Database Management'];

      const initialLevel: ProficiencyLevel = legacyStats?.currentLevel || 'Intermediate';
      const initialRating = initialLevel === 'Expert' ? 1900 :
                            initialLevel === 'Advanced' ? 1400 :
                            initialLevel === 'Intermediate' ? 1000 : 600;

      const interestProfiles: Record<string, InterestProficiency> = {};
      interests.forEach((interest) => {
        interestProfiles[interest] = {
          interest,
          abilityRating: initialRating,
          ratingConfidence: 0.2, // Low confidence on bootstrap
          currentLevel: initialLevel,
          recentAccuracy: 0.0,
          recentAvgTime: 0.0,
          topicStrengths: {},
          lastPracticedAt: new Date(),
          decayFactor: 1.0,
          effectiveRating: initialRating,
          questionsAttempted: 0,
          questionsCorrect: 0,
        };
      });

      profile = {
        userId,
        overallLevel: initialLevel,
        overallConfidence: 0.2,
        interestProfiles,
        learningVelocity: 0,
        consistencyScore: 0,
        totalQuestionsAttempted: 0,
        totalSessionsCompleted: 0,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('user_proficiency').insertOne(profile);
    } else {
      // 2. Profile exists, apply decay logic dynamically on read
      let updated = false;
      Object.keys(profile.interestProfiles).forEach((interest) => {
        const ip = profile!.interestProfiles[interest];
        const decayed = calculateDecayedRating(ip.abilityRating, ip.lastPracticedAt, ip.currentLevel);
        
        if (ip.decayFactor !== decayed.decayFactor || ip.effectiveRating !== decayed.effectiveRating) {
          ip.decayFactor = decayed.decayFactor;
          ip.effectiveRating = decayed.effectiveRating;
          updated = true;
        }
      });

      if (updated) {
        profile.updatedAt = new Date();
        await db.collection('user_proficiency').updateOne(
          { userId },
          { $set: { interestProfiles: profile.interestProfiles, updatedAt: new Date() } }
        );
      }
    }

    return profile;
  }

  /**
   * Updates user rating following an answer submission
   */
  public static async updateRating(
    userId: ObjectId,
    interest: string,
    questionDifficultyNumeric: number,
    isCorrect: boolean,
    timeSpentSeconds: number,
    subTopics: string[] = []
  ): Promise<UserProficiency> {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Get active profile
    const profile = await this.getUserProficiency(userId);
    let ip = profile.interestProfiles[interest];

    // Boot interest profile dynamically if missing
    if (!ip) {
      ip = {
        interest,
        abilityRating: 1000, // Medium baseline
        ratingConfidence: 0.2,
        currentLevel: 'Intermediate',
        recentAccuracy: 0.0,
        recentAvgTime: 0.0,
        topicStrengths: {},
        lastPracticedAt: new Date(),
        decayFactor: 1.0,
        effectiveRating: 1000,
        questionsAttempted: 0,
        questionsCorrect: 0,
      };
      profile.interestProfiles[interest] = ip;
    }

    // 1. Run Elo update calculation
    const totalAnswers = ip.questionsAttempted + 1;
    const { newRating } = calculateNewElo({
      currentRating: ip.abilityRating,
      questionDifficulty: questionDifficultyNumeric,
      isCorrect,
      timeSpentSeconds,
      totalAnswersCount: totalAnswers,
    });

    // 2. Accumulate stats
    ip.questionsAttempted = totalAnswers;
    if (isCorrect) ip.questionsCorrect += 1;

    // Rolling statistics updates (window of last 20 questions)
    const rollingFactor = 0.1; // Weight new input at 10%
    ip.recentAccuracy = ip.recentAccuracy === 0 ? (isCorrect ? 1 : 0) : (ip.recentAccuracy * (1 - rollingFactor)) + ((isCorrect ? 1 : 0) * rollingFactor);
    ip.recentAvgTime = ip.recentAvgTime === 0 ? timeSpentSeconds : (ip.recentAvgTime * (1 - rollingFactor)) + (timeSpentSeconds * rollingFactor);

    // Confidence calibration
    ip.ratingConfidence = Math.min(0.95, ip.ratingConfidence + 0.02);

    // 3. Sub-topic tracking
    subTopics.forEach((tag) => {
      const currentVal = ip.topicStrengths[tag] || 0.5;
      const change = isCorrect ? 0.1 : -0.1;
      ip.topicStrengths[tag] = Math.max(0.0, Math.min(1.0, currentVal + change));
    });

    // 4. Set Elo parameters
    ip.abilityRating = newRating;
    ip.lastPracticedAt = new Date();
    ip.decayFactor = 1.0; // Reset decay due to practice
    ip.effectiveRating = newRating;
    ip.currentLevel = ratingToLevel(newRating);

    // 5. Update global summaries
    profile.totalQuestionsAttempted += 1;
    profile.lastActiveAt = new Date();
    profile.updatedAt = new Date();

    // Recalculate overall global profile level (weighted average)
    let totalElo = 0;
    let totalInterests = 0;
    Object.keys(profile.interestProfiles).forEach((key) => {
      totalElo += profile.interestProfiles[key].abilityRating;
      totalInterests += 1;
    });

    const averageRating = totalInterests > 0 ? totalElo / totalInterests : 1000;
    profile.overallLevel = ratingToLevel(averageRating);

    // Persist changes
    await db.collection('user_proficiency').updateOne(
      { userId },
      {
        $set: {
          interestProfiles: profile.interestProfiles,
          overallLevel: profile.overallLevel,
          totalQuestionsAttempted: profile.totalQuestionsAttempted,
          lastActiveAt: profile.lastActiveAt,
          updatedAt: profile.updatedAt,
        },
      }
    );

    return profile;
  }
}
