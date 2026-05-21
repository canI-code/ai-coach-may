import { ObjectId } from 'mongodb';
import { QuestionSelector } from '../../lib/question-pool/question-selector';
import clientPromise from '../../lib/mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`✅ Passed: ${message}`);
}

async function runSelectorTests() {
  console.log('🧪 Starting Phase 3 Adaptive Question Selector Tests...\n');

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'aicoach');
  const poolCol = db.collection('questions_ai');

  try {
    // 1. Test Elo to difficulty mapping logic
    console.log('--- 1. Testing Elo to Numeric Difficulty Conversion ---');
    assert(QuestionSelector.eloToDifficultyNumeric(400) === 1.0, '400 Elo -> 1.0');
    assert(QuestionSelector.eloToDifficultyNumeric(800) === 2.0, '800 Elo -> 2.0');
    assert(QuestionSelector.eloToDifficultyNumeric(1200) === 3.0, '1200 Elo -> 3.0');
    assert(QuestionSelector.eloToDifficultyNumeric(1800) === 4.0, '1800 Elo -> 4.0');

    // 2. Setup mock questions for a specific test interest to test IRT and fallbacks
    console.log('\n--- 2. Setting Up Test Questions in DB ---');
    const testInterest = 'Selector_Test_Interest';
    
    // Clean existing test questions if any
    await poolCol.deleteMany({ interest: testInterest });
    await poolCol.deleteMany({ interest: 'Selector_Test_Adjacent' });

    const q1Id = new ObjectId();
    const q2Id = new ObjectId();
    const q3Id = new ObjectId();

    const mockQuestions = [
      {
        _id: q1Id,
        text: 'Easy question about selector test interest',
        choices: [
          { id: 'a', text: 'Opt A', correct: true },
          { id: 'b', text: 'Opt B', correct: false },
          { id: 'c', text: 'Opt C', correct: false },
          { id: 'd', text: 'Opt D', correct: false }
        ],
        explanation: 'Some explanation',
        interest: testInterest,
        domain: 'Computer Science',
        difficulty: 'Easy',
        difficultyNumeric: 1.2,
        topics: ['basics'],
        bloomLevel: 'Remember',
        source: 'curated',
        contentHash: 'hash_q1',
        qualityScore: 0.9,
        timesServed: 0,
        timesCorrect: 0,
        timesSkipped: 0,
        avgTimeToAnswer: 25,
        status: 'active',
        createdAt: new Date(),
        lastServedAt: new Date()
      },
      {
        _id: q2Id,
        text: 'Medium question about selector test interest',
        choices: [
          { id: 'a', text: 'Opt A', correct: false },
          { id: 'b', text: 'Opt B', correct: true },
          { id: 'c', text: 'Opt C', correct: false },
          { id: 'd', text: 'Opt D', correct: false }
        ],
        explanation: 'Some explanation 2',
        interest: testInterest,
        domain: 'Computer Science',
        difficulty: 'Medium',
        difficultyNumeric: 2.1,
        topics: ['basics'],
        bloomLevel: 'Understand',
        source: 'curated',
        contentHash: 'hash_q2',
        qualityScore: 0.95,
        timesServed: 0,
        timesCorrect: 0,
        timesSkipped: 0,
        avgTimeToAnswer: 30,
        status: 'active',
        createdAt: new Date(),
        lastServedAt: new Date()
      },
      {
        _id: q3Id,
        text: 'Another Medium question for topic diversity',
        choices: [
          { id: 'a', text: 'Opt A', correct: false },
          { id: 'b', text: 'Opt B', correct: false },
          { id: 'c', text: 'Opt C', correct: true },
          { id: 'd', text: 'Opt D', correct: false }
        ],
        explanation: 'Some explanation 3',
        interest: testInterest,
        domain: 'Computer Science',
        difficulty: 'Medium',
        difficultyNumeric: 2.3,
        topics: ['basics'],
        bloomLevel: 'Understand',
        source: 'curated',
        contentHash: 'hash_q3',
        qualityScore: 0.88,
        timesServed: 0,
        timesCorrect: 0,
        timesSkipped: 0,
        avgTimeToAnswer: 20,
        status: 'active',
        createdAt: new Date(),
        lastServedAt: new Date()
      }
    ];

    await poolCol.insertMany(mockQuestions);
    console.log('✅ Temporary test questions populated.');

    // 3. Test selection logic & IRT weighing
    console.log('\n--- 3. Testing IRT Selection and Performance ---');
    const startMs = Date.now();
    const selected = await QuestionSelector.selectQuestions({
      interest: testInterest,
      userAbilityRating: 900, // Medium range (mapped to 2.0 difficulty)
      count: 2,
      excludeQuestionIds: [],
      difficultyTier: 'Medium'
    });
    const elapsedMs = Date.now() - startMs;

    console.log(`➡️ Selection latency: ${elapsedMs}ms`);
    assert(elapsedMs < 300, `Selection latency must be < 300ms (took ${elapsedMs}ms)`);
    assert(selected.length === 2, `Should select exactly 2 questions. Found ${selected.length}`);
    assert(selected[0].difficulty === 'Medium', 'First selected question must be Medium');
    assert(selected[1].difficulty === 'Medium', 'Second selected question must be Medium');

    // 4. Test Exclude Question IDs filter
    console.log('\n--- 4. Testing Exclusion Filtering ---');
    const selectedWithExclusion = await QuestionSelector.selectQuestions({
      interest: testInterest,
      userAbilityRating: 900,
      count: 1,
      excludeQuestionIds: [q2Id], // Exclude the first medium question
      difficultyTier: 'Medium'
    });

    assert(selectedWithExclusion.length === 1, 'Should select exactly 1 question');
    assert(selectedWithExclusion[0]._id?.toString() === q3Id.toString(), 'Should select q3 since q2 is excluded');

    // 5. Test Fallbacks
    console.log('\n--- 5. Testing Selection Fallbacks ---');
    
    // Request Hard question (which doesn't exist for this interest)
    // Selector should trigger Strategy A: Adjacent difficulty check (Medium tier)
    console.log('🔄 Triggering Fallback check for Hard tier (empty)...');
    const fallbackSelected = await QuestionSelector.selectQuestions({
      interest: testInterest,
      userAbilityRating: 1400,
      count: 1,
      excludeQuestionIds: [],
      difficultyTier: 'Hard'
    });

    assert(fallbackSelected.length === 1, 'Should successfully fall back and return 1 question');
    assert(fallbackSelected[0].difficulty === 'Medium', 'Should fall back to Medium adjacent tier questions');

    // Clean up temporary test questions
    await poolCol.deleteMany({ interest: testInterest });
    console.log('\n🧹 Cleaned up temporary test questions from DB.');

    console.log('\n🎉 All Adaptive Question Selector Tests Passed Successfully!');

  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
  } finally {
    await client.close();
    process.exit(0);
  }
}

runSelectorTests();
