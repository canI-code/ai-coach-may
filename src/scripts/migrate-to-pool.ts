import { MongoClient, ObjectId } from 'mongodb';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

function generateContentHash(text: string, choices: { id: string; text: string }[]): string {
  // Normalize string by converting to lowercase and stripping all non-alphanumeric chars
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Normalize choices: sort by choice ID to keep it uniform
  const sortedChoices = [...choices]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(c => `${c.id}:${c.text.toLowerCase().replace(/[^a-z0-9]/g, '')}`)
    .join('|');

  return crypto
    .createHash('sha256')
    .update(`${normalizedText}#${sortedChoices}`)
    .digest('hex');
}

function difficultyToNumeric(diff: string): number {
  switch (diff.toLowerCase()) {
    case 'easy': return 1.0;
    case 'medium': return 2.0;
    case 'hard': return 3.0;
    case 'expert': return 4.0;
    default: return 2.0;
  }
}

async function migrate() {
  console.log('🏁 Starting migration to questions_pool...');
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // 1. Create Index specifications first
    console.log('📌 Creating collections and indexes...');
    const poolCol = db.collection('questions_pool');

    await poolCol.createIndex(
      { interest: 1, difficulty: 1, status: 1, qualityScore: -1 },
      { name: "serving_idx" }
    );
    await poolCol.createIndex(
      { contentHash: 1 },
      { unique: true, name: "dedup_idx" }
    );
    await poolCol.createIndex(
      { interest: 1, difficulty: 1, status: 1 },
      { name: "gap_analysis_idx" }
    );

    console.log('✅ Indexes verified successfully.');

    // 2. Fetch existing questions
    console.log('🔍 Fetching legacy questions...');
    const curatedQs = await db.collection('questions_non_ai').find({}).toArray();
    const aiQs = await db.collection('questions_ai').find({}).toArray();

    console.log(`📊 Found ${curatedQs.length} curated questions and ${aiQs.length} AI-cached questions.`);

    let inserted = 0;
    let duplicates = 0;

    const allLegacy = [
      ...curatedQs.map(q => ({ ...q, source: 'curated' as const })),
      ...aiQs.map(q => ({ ...q, source: 'ai_generated' as const }))
    ];

    for (const q of allLegacy as any[]) {
      const text = q.text || '';
      const choices = q.choices || [];
      const interest = q.interest || 'Unknown';
      const difficulty = q.difficulty || 'Medium';

      // Safe clean up choices for boolean fields
      const formattedChoices = choices.map((c: any) => ({
        id: c.id,
        text: c.text,
        correct: !!c.correct
      }));

      const contentHash = generateContentHash(text, formattedChoices);

      // Map taxonomy groups
      let domain = 'Computer Science';
      if (['Digital Electronics', 'Microprocessors', 'Embedded Systems', 'VLSI Design', 'Signal Processing', 'Communication Systems'].includes(interest)) {
        domain = 'Electronics';
      } else if (['Marketing', 'Finance', 'Human Resources', 'Operations', 'Project Management', 'Entrepreneurship'].includes(interest)) {
        domain = 'Management';
      }

      const poolQuestion = {
        text,
        choices: formattedChoices,
        explanation: q.explanation || `Correct answer is choice: ${formattedChoices.find((c: any) => c.correct)?.id || 'a'}`,
        interest,
        domain,
        difficulty: (['Easy', 'Medium', 'Hard', 'Expert'].includes(difficulty) ? difficulty : 'Medium') as any,
        difficultyNumeric: difficultyToNumeric(difficulty),
        topics: q.topics || [interest.toLowerCase().replace(/[^a-z]/g, '')],
        bloomLevel: q.bloomLevel || (difficulty === 'Easy' ? 'Remember' : difficulty === 'Medium' ? 'Understand' : difficulty === 'Hard' ? 'Apply' : 'Analyze') as any,
        source: q.source,
        generationModel: q.generationModel || (q.source === 'ai_generated' ? 'gemini-1.5-flash' : undefined),
        contentHash,
        qualityScore: q.qualityScore || 0.85,
        timesServed: q.timesServed || 0,
        timesCorrect: q.timesCorrect || 0,
        timesSkipped: q.timesSkipped || 0,
        avgTimeToAnswer: q.avgTimeToAnswer || 30.0,
        status: 'active' as const,
        createdAt: q.createdAt || new Date(),
        lastServedAt: q.lastServedAt || new Date()
      };

      try {
        await poolCol.insertOne(poolQuestion);
        inserted++;
      } catch (err: any) {
        if (err.code === 11000) {
          // Duplicate key on contentHash index, skip silently
          duplicates++;
        } else {
          console.error(`⚠️ Failed to insert question:`, err.message);
        }
      }
    }

    console.log(`\n🎉 Migration Complete!`);
    console.log(`➡️ Questions Merged & Normalised: ${inserted}`);
    console.log(`➡️ Duplicates Deduplicated: ${duplicates}`);

  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await client.close();
  }
}

migrate();
