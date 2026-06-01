import { ObjectId } from 'mongodb';
import clientPromise from '../mongodb';
import { PoolQuestion } from '../assessment';
import { redis } from '../redis';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export interface SelectionArgs {
  interest: string;
  userAbilityRating: number; // Elo scale: 400 - 2400
  count: number;
  excludeQuestionIds: ObjectId[];
  difficultyTier: 'Easy' | 'Medium' | 'Hard' | 'Expert';
}

export class QuestionSelector {
  /**
   * Helper to convert Elo rating to numeric difficulty (1.0 to 4.0)
   */
  public static eloToDifficultyNumeric(elo: number): number {
    // 400 -> 1.0, 1000 -> 2.0, 1500 -> 3.0, 2000+ -> 4.0
    if (elo <= 600) return 1.0;
    if (elo <= 1000) return 2.0;
    if (elo <= 1500) return 3.0;
    return 4.0;
  }

  /**
   * Adaptive serving selector utilizing Rasch (1-PL) Item Response Theory
   */
  public static async selectQuestions(args: SelectionArgs): Promise<PoolQuestion[]> {
    const { interest, userAbilityRating, count, excludeQuestionIds, difficultyTier } = args;
    console.log(`🎯 Selector: Finding ${count} questions for "${interest}" (User Elo: ${userAbilityRating}, Tier: ${difficultyTier})`);

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // 1. Fetch active candidate questions for this interest
    const cacheKey = `pool:${interest.toLowerCase().replace(/[^a-z]/g, '')}:${difficultyTier.toLowerCase()}`;
    let candidates = await redis.get<PoolQuestion[]>(cacheKey);

    if (!candidates) {
      console.log(`   - Cache miss for "${cacheKey}". Loading from MongoDB...`);
      candidates = await db.collection('questions_ai')
        .find({ interest, difficulty: difficultyTier, status: 'active' })
        .toArray() as unknown as PoolQuestion[];

      if (candidates.length > 0) {
        await redis.set(cacheKey, candidates, 300); // 5 min TTL
      }
    } else {
      console.log(`   - Cache hit for "${cacheKey}". Found ${candidates.length} candidates.`);
    }

    // Filter out already answered questions
    const excludeSet = new Set(excludeQuestionIds.map(id => id.toString()));
    let eligible = candidates.filter(q => q._id && !excludeSet.has(q._id.toString()));

    console.log(`   - Eligible candidates after filtering answered: ${eligible.length}`);

    // 2. IRT Selection Logic (Rasch 1-PL Model)
    // If we have candidates, select using ability matching information curves
    if (eligible.length >= count) {
      const userAbilityNumeric = this.eloToDifficultyNumeric(userAbilityRating);
      
      const ranked = eligible.map((q) => {
        // P(Correct) = 1 / (1 + e^(-1.7 * (Ability - QuestionDifficulty)))
        const diffDiff = userAbilityNumeric - q.difficultyNumeric;
        const pCorrect = 1.0 / (1.0 + Math.exp(-1.7 * diffDiff));
        
        // IRT Information Curve: I = P * (1 - P)
        // Information is maximized at P = 0.5 (where ability matches difficulty perfectly)
        const information = pCorrect * (1.0 - pCorrect);

        // Include slightly higher priority for questions with solid quality score
        const finalWeight = (information * 0.7) + (q.qualityScore * 0.3);

        return { question: q, weight: finalWeight };
      });

      // Sort descending by final weight (highest cognitive utility first)
      ranked.sort((a, b) => b.weight - a.weight);

      // Select top questions while maintaining topic diversity
      const selected: PoolQuestion[] = [];
      const topicCounts = new Map<string, number>();

      for (const item of ranked) {
        if (selected.length >= count) break;

        // Check topic diversity (limit to max 2 questions on same sub-topic per chunk)
        const primaryTopic = item.question.topics[0] || 'general';
        const currentCount = topicCounts.get(primaryTopic) || 0;

        if (currentCount < 2) {
          selected.push(item.question);
          topicCounts.set(primaryTopic, currentCount + 1);
        }
      }

      // If diversity filter made us short, top off with remaining high weight questions
      if (selected.length < count) {
        for (const item of ranked) {
          if (selected.length >= count) break;
          if (!selected.some(q => q._id?.toString() === item.question._id?.toString())) {
            selected.push(item.question);
          }
        }
      }

      return selected;
    }

    // 3. Fallback Strategies (Pool is empty or under-capacity)
    console.warn(`   ⚠️ Under-capacity pool for "${interest}" (${difficultyTier}). Triggering fallback chain...`);

    // Strategy A: Adjacent difficulty check (e.g. Medium if Hard is empty, etc.)
    const difficultyTiers: ('Easy' | 'Medium' | 'Hard' | 'Expert')[] = ['Easy', 'Medium', 'Hard', 'Expert'];
    const currentIdx = difficultyTiers.indexOf(difficultyTier);
    const adjacentTiers: ('Easy' | 'Medium' | 'Hard' | 'Expert')[] = [];
    
    if (currentIdx > 0) adjacentTiers.push(difficultyTiers[currentIdx - 1]); // One tier lower
    if (currentIdx < difficultyTiers.length - 1) adjacentTiers.push(difficultyTiers[currentIdx + 1]); // One tier higher

    for (const adjacent of adjacentTiers) {
      console.log(`   🔄 Fallback Strategy A: Checking adjacent difficulty "${adjacent}"...`);
      const adjCandidates = await db.collection('questions_ai')
        .find({ interest, difficulty: adjacent, status: 'active' })
        .toArray() as unknown as PoolQuestion[];

      const adjEligible = adjCandidates.filter(q => q._id && !excludeSet.has(q._id.toString()));
      if (adjEligible.length > 0) {
        const spaceLeft = count - eligible.length;
        eligible = [...eligible, ...adjEligible.slice(0, spaceLeft)];
        if (eligible.length >= count) return eligible.slice(0, count);
      }
    }

    // Strategy B: Same interest, any difficulty (broader net than adjacent-only)
    const otherDifficulties = difficultyTiers.filter(d => d !== difficultyTier && !adjacentTiers.includes(d));
    for (const otherDiff of otherDifficulties) {
      console.log(`   🔄 Fallback Strategy B: Checking other difficulty "${otherDiff}" for same interest...`);
      const otherCandidates = await db.collection('questions_ai')
        .find({ interest, difficulty: otherDiff, status: 'active' })
        .toArray() as unknown as PoolQuestion[];

      const otherEligible = otherCandidates.filter(q => q._id && !excludeSet.has(q._id.toString()));
      if (otherEligible.length > 0) {
        const spaceLeft = count - eligible.length;
        eligible = [...eligible, ...otherEligible.slice(0, spaceLeft)];
        if (eligible.length >= count) return eligible.slice(0, count);
      }
    }

    // Strategy C: Pull from questions under review or curation draft
    console.log(`   🔄 Fallback Strategy C: Querying lax quality pools...`);
    const laxCandidates = await db.collection('questions_ai')
      .find({ interest, status: 'review' })
      .toArray() as unknown as PoolQuestion[];
      
    const laxEligible = laxCandidates.filter(q => q._id && !excludeSet.has(q._id.toString()));
    if (laxEligible.length > 0) {
      eligible = [...eligible, ...laxEligible.slice(0, count - eligible.length)];
      if (eligible.length >= count) return eligible.slice(0, count);
    }

    // Strategy D: Last resort - serve whatever is left in this interest, but still respect exclusions
    console.log(`   ⚠️ Fallback Strategy D: Recycling previously answered questions while respecting exclusions...`);
    const recycled = candidates.filter(q => q._id && !excludeSet.has(q._id.toString())).slice(0, count - eligible.length);
    eligible = [...eligible, ...recycled];

    return eligible.slice(0, count);
  }
}
