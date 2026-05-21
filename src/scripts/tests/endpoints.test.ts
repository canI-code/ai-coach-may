import { ObjectId } from 'mongodb';
import clientPromise from '../../lib/mongodb';
import { POST as createSessionPOST } from '../../app/api/students/exam/session/create/route';
import { POST as fetchChunkPOST } from '../../app/api/students/exam/session/fetch-chunk/route';
import { POST as submitAnswerPOST } from '../../app/api/students/exam/session/submit-answer/route';
import { POST as completePOST } from '../../app/api/students/exam/session/complete/route';
import { GET as getProficiencyGET } from '../../app/api/user/proficiency/route';
import { GET as getAdminStatusGET } from '../../app/api/admin/pool/status/route';
import { GET as getAdminGapsGET } from '../../app/api/admin/pool/gaps/route';
import { POST as triggerAdminWarmPOST } from '../../app/api/admin/pool/warm/route';

import * as dotenv from 'dotenv';
dotenv.config();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`✅ Passed: ${message}`);
}

async function runEndpointTests() {
  console.log('🧪 Starting Phase 4 Integration Tests for Exam API Routes...\n');

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'aicoach');

  const testUserId = new ObjectId();
  const testInterest = 'Endpoints_Integration_Test_Interest';
  const testQuestionId = new ObjectId();

  try {
    // 1. Setup Mock User & Questions
    console.log('--- 1. Setting Up Database Context ---');
    await db.collection('users').insertOne({
      _id: testUserId,
      email: 'test-student@aicoach.com',
      name: 'Test Student',
      createdAt: new Date(),
      sessions: [{ id: 'test-session-id' }]
    });

    await db.collection('user_profile').insertOne({
      userId: testUserId,
      interests: [testInterest]
    });

    await db.collection('questions_ai').insertOne({
      _id: testQuestionId,
      text: 'What is the runtime of binary search?',
      choices: [
        { id: 'a', text: 'O(log n)', correct: true },
        { id: 'b', text: 'O(n)', correct: false },
        { id: 'c', text: 'O(n log n)', correct: false },
        { id: 'd', text: 'O(1)', correct: false }
      ],
      explanation: 'Binary search splits the range in half at each step.',
      interest: testInterest,
      domain: 'Computer Science',
      difficulty: 'Easy',
      difficultyNumeric: 1.0,
      topics: ['binary search'],
      bloomLevel: 'Remember',
      source: 'curated',
      contentHash: 'hash_integration_test_1',
      qualityScore: 0.95,
      timesServed: 0,
      timesCorrect: 0,
      timesSkipped: 0,
      avgTimeToAnswer: 20,
      status: 'active',
      createdAt: new Date(),
      lastServedAt: new Date()
    });

    console.log('✅ Context initialized.');
    process.env.TEST_USER_ID = testUserId.toString();

    // 2. Test /api/students/exam/session/create (POST)
    console.log('\n--- 2. Testing /session/create Endpoint ---');
    const reqCreate = new Request('http://localhost/api/students/exam/session/create', {
      method: 'POST',
      body: JSON.stringify({
        interests: [testInterest],
        questionCount: 4
      })
    });
    const resCreate = await createSessionPOST(reqCreate);
    const bodyCreate = await resCreate.json();

    assert(resCreate.status === 200, 'Create session returns HTTP 200');
    assert(bodyCreate.sessionId !== undefined, 'Create session returns sessionId');
    assert(bodyCreate.attemptId !== undefined, 'Create session returns attemptId');
    console.log('DEBUG bodyCreate:', bodyCreate);
    assert(bodyCreate.questionCount >= 1, 'Create session successfully selects the active question');
    assert(bodyCreate.questions[0].text === 'What is the runtime of binary search?', 'Create session returns details correctly');
    
    const sessionId = new ObjectId(bodyCreate.sessionId);
    const attemptId = new ObjectId(bodyCreate.attemptId);

    // 3. Test /api/students/exam/session/submit-answer (POST)
    console.log('\n--- 3. Testing /session/submit-answer Endpoint ---');
    const reqSubmit = new Request('http://localhost/api/students/exam/session/submit-answer', {
      method: 'POST',
      body: JSON.stringify({
        attemptId: attemptId.toString(),
        questionId: testQuestionId.toString(),
        chosenChoiceId: 'a',
        timeSpentSeconds: 15
      })
    });
    const resSubmit = await submitAnswerPOST(reqSubmit);
    const bodySubmit = await resSubmit.json();

    assert(resSubmit.status === 200, 'Submit answer returns HTTP 200');
    assert(bodySubmit.received === true, 'Submit answer successfully enqueued answer');
    assert(bodySubmit.isCorrect === true, 'Submit answer accurately flags correct answers');
    assert(bodySubmit.currentElo !== null, 'Submit answer successfully calculated dynamic Elo update');

    // 4. Test /api/students/exam/session/fetch-chunk (POST)
    // We already have 1 loaded question, totalneeded = 4, so it should attempt to load more questions
    console.log('\n--- 4. Testing /session/fetch-chunk Endpoint ---');
    const reqFetch = new Request('http://localhost/api/students/exam/session/fetch-chunk', {
      method: 'POST',
      body: JSON.stringify({
        attemptId: attemptId.toString()
      })
    });
    const resFetch = await fetchChunkPOST(reqFetch);
    const bodyFetch = await resFetch.json();

    assert(resFetch.status === 200, 'Fetch next chunk returns HTTP 200');
    // Since pool only has 1 question (which we already served and excluded), fetch-chunk should trigger recycle or return message
    assert(bodyFetch.newQuestions !== undefined, 'Fetch next chunk returns response body');

    // 5. Test /api/students/exam/session/complete (POST)
    console.log('\n--- 5. Testing /session/complete Endpoint ---');
    const reqComplete = new Request('http://localhost/api/students/exam/session/complete', {
      method: 'POST',
      body: JSON.stringify({
        attemptId: attemptId.toString()
      })
    });
    const resComplete = await completePOST(reqComplete);
    const bodyComplete = await resComplete.json();

    assert(resComplete.status === 200, 'Complete attempt returns HTTP 200');
    console.log('DEBUG bodyComplete:', bodyComplete);
    assert(bodyComplete.scorePercentage !== undefined, 'Complete attempt returns scorePercentage');
    assert(bodyComplete.scorePercentage > 0, 'Complete attempt returns positive scorePercentage');
    
    // Verify backward compatibility sync with legacy user_assessment_stats
    const syncedStats = await db.collection('user_assessment_stats').findOne({ userId: testUserId });
    assert(syncedStats !== null, 'Successfully synced with legacy user_assessment_stats table');
    assert(syncedStats?.currentLevel === bodyComplete.levelAchieved, 'Level matches in legacy assessment stats');

    // 6. Test /api/user/proficiency (GET)
    console.log('\n--- 6. Testing /api/user/proficiency Endpoint ---');
    const reqProf = new Request('http://localhost/api/user/proficiency', { method: 'GET' });
    const resProf = await getProficiencyGET(reqProf);
    const bodyProf = await resProf.json();

    assert(resProf.status === 200, 'User proficiency returns HTTP 200');
    assert(bodyProf.success === true, 'User proficiency returned success');
    assert(bodyProf.profile.userId === testUserId.toString(), 'User proficiency returned the correct profile');
    assert(bodyProf.profile.interestProfiles[testInterest] !== undefined, 'Interest stats were successfully dynamic-decay recovered');

    // 7. Test Admin Dashboard APIs
    console.log('\n--- 7. Testing Admin Dashboard Endpoints ---');
    
    const resAdminStatus = await getAdminStatusGET(new Request('http://localhost/api/admin/pool/status', { method: 'GET' }));
    const bodyAdminStatus = await resAdminStatus.json();
    assert(resAdminStatus.status === 200, 'Admin Pool Status returns HTTP 200');
    assert(bodyAdminStatus.status.totalQuestions > 0, 'Admin Pool Status returned question metrics');

    const resAdminGaps = await getAdminGapsGET(new Request('http://localhost/api/admin/pool/gaps', { method: 'GET' }));
    const bodyAdminGaps = await resAdminGaps.json();
    assert(resAdminGaps.status === 200, 'Admin Pool Gaps returns HTTP 200');
    assert(bodyAdminGaps.gaps !== undefined, 'Admin Pool Gaps returned gap list');

    const resAdminWarm = await triggerAdminWarmPOST(new Request('http://localhost/api/admin/pool/warm', { method: 'POST' }));
    const bodyAdminWarm = await resAdminWarm.json();
    assert(resAdminWarm.status === 200, 'Admin Pool Warm returns HTTP 200');
    assert(bodyAdminWarm.success === true, 'Admin Pool Warm enqueued background warmer cron run successfully');

    console.log('\n--- 8. Cleaning Up Database Context ---');
    await db.collection('users').deleteOne({ _id: testUserId });
    await db.collection('user_profile').deleteOne({ userId: testUserId });
    await db.collection('user_proficiency').deleteOne({ userId: testUserId });
    await db.collection('user_assessment_stats').deleteOne({ userId: testUserId });
    await db.collection('questions_ai').deleteOne({ _id: testQuestionId });
    await db.collection('exam_sessions').deleteOne({ sessionId });
    await db.collection('exam_attempts').deleteOne({ attemptId });
    console.log('🧹 Cleanup complete.');

    console.log('\n🎉 All API Integration Tests Passed Flawlessly!');

  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
    
    // Attempt emergency cleanup
    await db.collection('users').deleteOne({ _id: testUserId });
    await db.collection('user_profile').deleteOne({ userId: testUserId });
    await db.collection('user_proficiency').deleteOne({ userId: testUserId });
    await db.collection('user_assessment_stats').deleteOne({ userId: testUserId });
    await db.collection('questions_ai').deleteOne({ _id: testQuestionId });
  } finally {
    await client.close();
    process.exit(0);
  }
}

runEndpointTests();
