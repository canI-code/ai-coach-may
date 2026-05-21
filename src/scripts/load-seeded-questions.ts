import { MongoClient } from 'mongodb';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { INTERESTS_TAXONOMY } from '../lib/taxonomy';
import { PoolQuestion } from '../lib/assessment';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';
const DATA_DIR = path.join(__dirname, 'data');

function generateContentHash(text: string, choices: { id: string; text: string }[]): string {
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

function difficultyToNumeric(diff: string): number {
  switch (diff.toLowerCase()) {
    case 'easy': return 1.0;
    case 'medium': return 2.0;
    case 'hard': return 3.0;
    case 'expert': return 4.0;
    default: return 2.0;
  }
}

function getBloomLevel(diff: string): 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' {
  switch (diff.toLowerCase()) {
    case 'easy': return 'Remember';
    case 'medium': return 'Understand';
    case 'hard': return 'Apply';
    case 'expert': return 'Analyze';
    default: return 'Understand';
  }
}

async function load() {
  console.log('🚀 Starting high-speed seed loader for questions_ai...');
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const aiCol = db.collection('questions_ai');

    // Clean up legacy documents with missing or null contentHash
    console.log('🧹 Cleaning up legacy documents with null/missing contentHash...');
    await aiCol.deleteMany({ contentHash: { $exists: false } });
    await aiCol.deleteMany({ contentHash: null });

    // Verify/Create Indexes
    console.log('📌 Verifying indexes for questions_ai...');
    await aiCol.createIndex(
      { interest: 1, difficulty: 1, status: 1, qualityScore: -1 },
      { name: "serving_idx" }
    );
    await aiCol.createIndex(
      { contentHash: 1 },
      { unique: true, name: "dedup_idx" }
    );
    await aiCol.createIndex(
      { interest: 1, difficulty: 1, status: 1 },
      { name: "gap_analysis_idx" }
    );
    console.log('✅ Indexes verified.');

    // Find all JSON files in the data directory
    if (!fs.existsSync(DATA_DIR)) {
      throw new Error(`Data directory not found at: ${DATA_DIR}`);
    }

    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    console.log(`📁 Found ${files.length} JSON data files to process...`);

    let totalQuestionsParsed = 0;
    const allQuestions: PoolQuestion[] = [];

    // Valid interests set for easy lookup
    const validInterests = new Set<string>();
    for (const interests of Object.values(INTERESTS_TAXONOMY)) {
      interests.forEach(i => validInterests.add(i));
    }

    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);
      console.log(`📖 Reading and parsing ${file}...`);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      let parsedList: any[] = [];
      try {
        parsedList = JSON.parse(fileContent);
      } catch (err: any) {
        console.error(`❌ Failed to parse JSON in ${file}: ${err.message}`);
        continue;
      }

      if (!Array.isArray(parsedList)) {
        console.warn(`⚠️ Warning: content of ${file} is not an array. Skipping.`);
        continue;
      }

      console.log(`🧩 Loaded ${parsedList.length} questions from ${file}.`);

      for (const q of parsedList) {
        const interest = q.interest;
        if (!validInterests.has(interest)) {
          console.warn(`⚠️ Warning: Invalid interest "${interest}" in question: "${q.text.slice(0, 30)}..."`);
          continue;
        }

        // Determine Domain
        let domain = 'Computer Science';
        if (['Digital Electronics', 'Microprocessors', 'Embedded Systems', 'VLSI Design', 'Signal Processing', 'Communication Systems'].includes(interest)) {
          domain = 'Electronics';
        } else if (['Marketing', 'Finance', 'Human Resources', 'Operations', 'Project Management', 'Entrepreneurship'].includes(interest)) {
          domain = 'Management';
        }

        const choices = q.choices || [];
        const formattedChoices = choices.map((c: any) => ({
          id: c.id,
          text: c.text,
          correct: !!c.correct
        }));

        const contentHash = generateContentHash(q.text, formattedChoices);
        const difficulty = q.difficulty as 'Easy' | 'Medium' | 'Hard' | 'Expert';

        const poolQuestion: PoolQuestion = {
          text: q.text || 'Untitled Question',
          choices: formattedChoices,
          explanation: q.explanation || `Correct answer is choice: ${formattedChoices.find((c: any) => c.correct)?.id || 'a'}`,
          interest,
          domain,
          difficulty,
          difficultyNumeric: difficultyToNumeric(difficulty),
          topics: q.topics || [interest.toLowerCase().replace(/[^a-z]/g, '')],
          bloomLevel: q.bloomLevel || getBloomLevel(difficulty),
          source: 'ai_generated',
          generationModel: 'agent-generator',
          contentHash,
          qualityScore: 0.95,
          timesServed: 0,
          timesCorrect: 0,
          timesSkipped: 0,
          avgTimeToAnswer: 30.0,
          status: 'active',
          createdAt: new Date(),
          lastServedAt: new Date()
        };

        allQuestions.push(poolQuestion);
        totalQuestionsParsed++;
      }
    }

    console.log(`\n📊 Total parsed questions: ${totalQuestionsParsed}`);
    if (allQuestions.length === 0) {
      console.warn('⚠️ No valid questions to insert.');
      return;
    }

    // Perform bulk upserts
    console.log(`💾 Upserting ${allQuestions.length} questions into questions_ai...`);
    const ops = allQuestions.map(q => ({
      updateOne: {
        filter: { contentHash: q.contentHash },
        update: { $setOnInsert: q },
        upsert: true
      }
    }));

    const result = await aiCol.bulkWrite(ops, { ordered: false });
    
    console.log('\n🎉 Seeding loader completed successfully!');
    console.log(`📊 Total Upserted (New): ${result.upsertedCount}`);
    console.log(`📊 Total Matched/Existing: ${result.matchedCount}`);
    console.log(`📊 Total Modified: ${result.modifiedCount}`);
    console.log(`📊 Total Checked (Operations): ${ops.length}`);

    // Print breakdown
    const dbQuestions = await aiCol.find({ status: 'active' }).toArray();
    console.log(`\n📈 Live active questions in questions_ai count: ${dbQuestions.length}`);

    // Validate interest distributions
    const distribution: Record<string, Record<string, number>> = {};
    for (const q of dbQuestions) {
      if (!distribution[q.interest]) {
        distribution[q.interest] = { Easy: 0, Medium: 0, Hard: 0, Expert: 0 };
      }
      if (q.difficulty in distribution[q.interest]) {
        distribution[q.interest][q.difficulty]++;
      }
    }

    console.log('\n📊 Interest and Difficulty Distribution in DB:');
    let validationPassed = true;
    for (const [mainField, interests] of Object.entries(INTERESTS_TAXONOMY)) {
      console.log(`\n--- ${mainField} ---`);
      for (const interest of interests) {
        const counts = distribution[interest] || { Easy: 0, Medium: 0, Hard: 0, Expert: 0 };
        console.log(`  🔹 ${interest.padEnd(25)}: Easy: ${counts.Easy}, Medium: ${counts.Medium}, Hard: ${counts.Hard}, Expert: ${counts.Expert}`);
        if (counts.Easy < 4 || counts.Medium < 4 || counts.Hard < 4 || counts.Expert < 4) {
          validationPassed = false;
        }
      }
    }

    if (validationPassed) {
      console.log('\n✅ Verification PASSED: Every single taxonomy interest has at least 4 questions per difficulty level!');
    } else {
      console.warn('\n⚠️ Verification FAILED: Some taxonomy interests are missing the target question density (4 questions per level).');
    }

  } catch (err: any) {
    console.error('❌ Loader execution aborted due to error:', err.message);
  } finally {
    await client.close();
  }
}

load();
