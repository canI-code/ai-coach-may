import clientPromise from '../mongodb';
import { INTERESTS_TAXONOMY } from '../taxonomy';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export interface PoolGap {
  interest: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  currentSize: number;
  targetSize: number;
  gapSize: number;
  priority: number; // Priority rating (1 is highest priority)
}

// Configured targets for warm pools
export const POOL_TARGET_CONFIG = {
  Easy: 30,
  Medium: 50,
  Hard: 40,
  Expert: 25,
};

// Threshold for replenishment: 60% of minimum
export const REPLENISH_THRESHOLD = 0.6;

export class GapAnalyzer {
  /**
   * Scans questions_pool and returns a prioritized list of pool shortages
   */
  public static async analyzeGaps(): Promise<PoolGap[]> {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const gaps: PoolGap[] = [];
    const interests = Object.values(INTERESTS_TAXONOMY).flat();
    const difficulties: ('Easy' | 'Medium' | 'Hard' | 'Expert')[] = ['Easy', 'Medium', 'Hard', 'Expert'];

    // Retrieve active counts group-by interest and difficulty
    const pipeline = [
      { $match: { status: 'active' } },
      {
        $group: {
          _id: { interest: '$interest', difficulty: '$difficulty' },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await db.collection('questions_pool').aggregate(pipeline).toArray();
    const countsMap = new Map<string, number>();
    
    results.forEach((row) => {
      const key = `${row._id.interest}#${row._id.difficulty}`;
      countsMap.set(key, row.count);
    });

    for (const interest of interests) {
      for (const difficulty of difficulties) {
        const key = `${interest}#${difficulty}`;
        const currentSize = countsMap.get(key) || 0;
        const targetSize = POOL_TARGET_CONFIG[difficulty];
        const replenishLimit = Math.floor(targetSize * REPLENISH_THRESHOLD);

        if (currentSize < replenishLimit) {
          const gapSize = targetSize - currentSize;
          
          // Calculate priority score:
          // Priority 1: Critical (pool is empty or extremely low)
          // Priority 2: Under 25% capacity
          // Priority 3: Below replenish threshold (60%)
          let priority = 3;
          if (currentSize === 0 || currentSize <= Math.floor(targetSize * 0.1)) {
            priority = 1;
          } else if (currentSize <= Math.floor(targetSize * 0.25)) {
            priority = 2;
          }

          gaps.push({
            interest,
            difficulty,
            currentSize,
            targetSize,
            gapSize,
            priority,
          });
        }
      }
    }

    // Sort by priority (1 first) then gap size descending
    return gaps.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.gapSize - a.gapSize;
    });
  }
}
