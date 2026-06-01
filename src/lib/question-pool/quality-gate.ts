import { ObjectId } from 'mongodb';
import * as crypto from 'crypto';
import clientPromise from '../mongodb';
import { PoolQuestion } from '../assessment';
import { GeneratedQuestionRaw } from '../ai-generator';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export class QualityGate {
  /**
   * Generates a normalized SHA-256 hash of question text + sorted choices
   */
  public static generateContentHash(text: string, choices: { id: string; text: string }[]): string {
    const normalizedText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sortedChoices = [...choices]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(c => `${c.id}:${c.text.toLowerCase().replace(/[^a-z0-9]/g, '')}`)
      .join('|');

    return crypto
      .createHash('sha256')
      .update(`${normalizedText}#${sortedChoices}`)
      .digest('hex');
  }

  /**
   * Maps interest to overarching domain group
   */
  public static getOverarchingDomain(interest: string): string {
    const electronics = ['Digital Electronics', 'Microprocessors', 'Embedded Systems', 'VLSI Design', 'Signal Processing', 'Communication Systems'];
    const management = ['Marketing', 'Finance', 'Human Resources', 'Operations', 'Project Management', 'Entrepreneurship'];
    
    if (electronics.includes(interest)) return 'Electronics';
    if (management.includes(interest)) return 'Management';
    return 'Computer Science';
  }

  /**
   * Safe quality checks and bulk insertions
   */
  public static async processAndInsert(
    interest: string,
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert',
    rawQuestions: GeneratedQuestionRaw[],
    modelUsed: string = 'gemini-2.5-flash'
  ): Promise<{ insertedCount: number; duplicateCount: number; questionIds: ObjectId[] }> {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const poolCol = db.collection('questions_ai');

    let insertedCount = 0;
    let duplicateCount = 0;
    const questionIds: ObjectId[] = [];

    const difficultyNumericMap = { Easy: 1.0, Medium: 2.0, Hard: 3.0, Expert: 4.0 };

    for (const q of rawQuestions) {
      // 1. Validation checks (Quality rules)
      if (!q.text || q.choices.length !== 4) {
        console.warn('⚠️ Question rejected by Quality Gate: must have exactly 4 choices.');
        continue;
      }
      
      const correctChoice = q.choices.find(c => c.correct);
      if (!correctChoice) {
        console.warn('⚠️ Question rejected by Quality Gate: must contain exactly one correct choice.');
        continue;
      }

      // 2. Generate content hash
      const contentHash = this.generateContentHash(q.text, q.choices);

      const poolQuestion: PoolQuestion = {
        text: q.text,
        choices: q.choices,
        explanation: q.explanation || `Correct choice is ${correctChoice.id}`,
        interest,
        domain: this.getOverarchingDomain(interest),
        difficulty,
        difficultyNumeric: difficultyNumericMap[difficulty],
        topics: q.topics || [interest.toLowerCase()],
        bloomLevel: q.bloomLevel as any || (difficulty === 'Easy' ? 'Remember' : 'Understand'),
        source: 'ai_generated',
        generationModel: modelUsed,
        contentHash,
        qualityScore: 0.85, // Default start quality
        timesServed: 0,
        timesCorrect: 0,
        timesSkipped: 0,
        avgTimeToAnswer: 30,
        status: 'active',
        createdAt: new Date(),
        lastServedAt: new Date(),
      };

      try {
        const res = await poolCol.insertOne(poolQuestion);
        insertedCount++;
        questionIds.push(res.insertedId);
      } catch (err: any) {
        if (err.code === 11000) {
          // Duplicate key caught by dedup index
          duplicateCount++;
        } else {
          console.error('❌ Failed to insert generated question:', err.message);
        }
      }
    }

    return {
      insertedCount,
      duplicateCount,
      questionIds,
    };
  }
}
