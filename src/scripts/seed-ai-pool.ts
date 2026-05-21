import { MongoClient } from 'mongodb';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { INTERESTS_TAXONOMY } from '../lib/taxonomy';
import { generateRawQuestions } from '../lib/ai-generator';
import { PoolQuestion } from '../lib/assessment';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function seed() {
  console.log('🚀 Starting high-performance parallel seeding script for questions_ai...');
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const aiCol = db.collection('questions_ai');

    // Clean up legacy documents with missing or null contentHash to avoid unique index build error
    console.log('🧹 Cleaning up legacy documents with null/missing contentHash...');
    await aiCol.deleteMany({ contentHash: { $exists: false } });
    await aiCol.deleteMany({ contentHash: null });

    // Create Indexes
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

    // Build the list of all interest + difficulty combinations (88 combinations)
    const jobs: { interest: string; difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' }[] = [];
    const difficulties: ('Easy' | 'Medium' | 'Hard' | 'Expert')[] = ['Easy', 'Medium', 'Hard', 'Expert'];

    for (const [mainField, interests] of Object.entries(INTERESTS_TAXONOMY)) {
      for (const interest of interests) {
        for (const diff of difficulties) {
          jobs.push({ interest, difficulty: diff });
        }
      }
    }

    console.log(`\n📊 Found ${jobs.length} combinations to generate. Total target questions: ${jobs.length * 4} = 352 questions.`);

    const CONCURRENCY_LIMIT = 5;
    const RETRY_LIMIT = 3;
    const BACKOFF_BASE_MS = 2000;

    let successfulJobs = 0;
    let failedJobs = 0;
    let totalQuestionsInserted = 0;
    let totalDuplicatesSkipped = 0;

    // Helper function to run a single job with retries and exponential backoff
    async function runJob(interest: string, difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert', attemptNum = 1): Promise<void> {
      try {
        console.log(`⏳ Generating: "${interest}" | Tier: ${difficulty} | Attempt: ${attemptNum}/${RETRY_LIMIT}`);
        const rawQs = await generateRawQuestions(interest, 4, difficulty);

        if (!rawQs || rawQs.length === 0) {
          throw new Error('Received empty question list from AI generator.');
        }

        // Determine Domain
        let domain = 'Computer Science';
        if (['Digital Electronics', 'Microprocessors', 'Embedded Systems', 'VLSI Design', 'Signal Processing', 'Communication Systems'].includes(interest)) {
          domain = 'Electronics';
        } else if (['Marketing', 'Finance', 'Human Resources', 'Operations', 'Project Management', 'Entrepreneurship'].includes(interest)) {
          domain = 'Management';
        }

        const formattedQuestions: PoolQuestion[] = rawQs.map(q => {
          const text = q.text || '';
          const choices = q.choices || [];
          const formattedChoices = choices.map((c: any) => ({
            id: c.id,
            text: c.text,
            correct: !!c.correct
          }));

          const contentHash = generateContentHash(text, formattedChoices);

          return {
            text,
            choices: formattedChoices,
            explanation: q.explanation || `Correct answer is choice: ${formattedChoices.find(c => c.correct)?.id || 'a'}`,
            interest,
            domain,
            difficulty,
            difficultyNumeric: difficultyToNumeric(difficulty),
            topics: q.topics || [interest.toLowerCase().replace(/[^a-z]/g, '')],
            bloomLevel: (q.bloomLevel as any) || getBloomLevel(difficulty),
            source: 'ai_generated',
            generationModel: 'gemini-2.5-flash',
            contentHash,
            qualityScore: 0.90,
            timesServed: 0,
            timesCorrect: 0,
            timesSkipped: 0,
            avgTimeToAnswer: 30.0,
            status: 'active',
            createdAt: new Date(),
            lastServedAt: new Date()
          };
        });

        // Bulk upsert by contentHash to prevent duplicates
        const ops = formattedQuestions.map(q => ({
          updateOne: {
            filter: { contentHash: q.contentHash },
            update: { $setOnInsert: q },
            upsert: true
          }
        }));

        const writeResult = await aiCol.bulkWrite(ops, { ordered: false });
        totalQuestionsInserted += writeResult.upsertedCount;
        totalDuplicatesSkipped += (formattedQuestions.length - writeResult.upsertedCount);

        console.log(`✅ Success: "${interest}" | Tier: ${difficulty} (Upserted: ${writeResult.upsertedCount}, Skipped Dupes: ${formattedQuestions.length - writeResult.upsertedCount})`);
        successfulJobs++;
      } catch (err: any) {
        console.error(`❌ Error in job "${interest}" (${difficulty}):`, err.message);
        if (attemptNum < RETRY_LIMIT) {
          const backoff = BACKOFF_BASE_MS * Math.pow(2, attemptNum - 1) + Math.random() * 1000;
          console.warn(`🔄 Retrying "${interest}" (${difficulty}) in ${Math.round(backoff)}ms...`);
          await sleep(backoff);
          return runJob(interest, difficulty, attemptNum + 1);
        } else {
          console.error(`💀 Permanent Failure: "${interest}" (${difficulty}) after ${RETRY_LIMIT} attempts.`);
          failedJobs++;
        }
      }
    }

    // Batch processor
    for (let i = 0; i < jobs.length; i += CONCURRENCY_LIMIT) {
      const chunk = jobs.slice(i, i + CONCURRENCY_LIMIT);
      console.log(`\n📦 Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(jobs.length / CONCURRENCY_LIMIT)} (Jobs ${i + 1} to ${Math.min(i + CONCURRENCY_LIMIT, jobs.length)})...`);
      
      const promises = chunk.map(job => runJob(job.interest, job.difficulty));
      await Promise.all(promises);

      // Cooldown delay between batches to respect AI model rate limits
      if (i + CONCURRENCY_LIMIT < jobs.length) {
        const cooldown = 1500;
        console.log(`⏳ Batch cooldown for ${cooldown}ms...`);
        await sleep(cooldown);
      }
    }

    console.log(`\n🎉 Seeding completed!`);
    console.log(`📊 Successful Jobs: ${successfulJobs}/${jobs.length}`);
    console.log(`📊 Failed Jobs: ${failedJobs}/${jobs.length}`);
    console.log(`📊 Total Questions Created (Unique): ${totalQuestionsInserted}`);
    console.log(`📊 Total Duplicates Skipped: ${totalDuplicatesSkipped}`);

  } catch (err: any) {
    console.error('❌ Seeding process aborted due to error:', err.message);
  } finally {
    await client.close();
  }
}

seed();
