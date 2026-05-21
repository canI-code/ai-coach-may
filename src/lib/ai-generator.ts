import clientPromise from './mongodb';
import { ObjectId } from 'mongodb';

export interface GeneratedQuestionRaw {
  text: string;
  choices: { id: string; text: string; correct: boolean }[];
  explanation: string;
  topics: string[];
  bloomLevel: string;
}

/**
 * Core, stateless LLM generator. 
 * Disabled per architectural requirement to avoid live API latency and rate-limiting.
 * All questions are pre-generated offline by the developer/agent and seeded into the DB.
 */
export async function generateRawQuestions(
  interest: string,
  count: number = 4,
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' = 'Medium'
): Promise<GeneratedQuestionRaw[]> {
  console.warn(`⚠️ AI Generation attempted for "${interest}" (${difficulty}), but live AI calls are disabled.`);
  throw new Error(
    `AI generation is disabled. Questions for "${interest}" (${difficulty}) must be seeded directly by the developer using the offline loader.`
  );
}

/**
 * Serves questions for student assessment mock sessions directly from questions_ai,
 * bypassing live AI calls to guarantee low latency.
 */
export async function getQuestionsForAssessment(
  interests: string[],
  count: number = 4
): Promise<ObjectId[]> {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'aicoach');

  console.log(`🎯 Serving assessment questions from questions_ai for interests: ${interests.join(', ')} (count: ${count})`);
  
  // Aggregate a random selection of questions from the seeded pool for these interests.
  const questions = await db.collection('questions_ai')
    .aggregate([
      { $match: { interest: { $in: interests }, status: 'active' } },
      { $sample: { size: count } },
      { $project: { _id: 1 } }
    ])
    .toArray();

  if (questions.length < count) {
    // If not enough questions in questions_ai, try questions_non_ai as a backup
    const backupQuestions = await db.collection('questions_non_ai')
      .aggregate([
        { $match: { interest: { $in: interests } } },
        { $sample: { size: count - questions.length } },
        { $project: { _id: 1 } }
      ])
      .toArray();
    questions.push(...backupQuestions);
  }

  return questions.map(q => q._id);
}
