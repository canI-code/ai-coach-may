import * as dotenv from 'dotenv';
dotenv.config();

import { GapAnalyzer } from '../../lib/pool-warmer/gap-analyzer';
import { GenerationQueue } from '../../lib/pool-warmer/generation-queue';
import { PoolWarmer } from '../../lib/pool-warmer/warmer';

async function runTests() {
  console.log('🧪 Starting Phase 2 Background Pool Warmer tests...\n');
  const { default: clientPromise } = await import('../../lib/mongodb');
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB_NAME || 'aicoach');

  try {
    // 1. Clear test queue
    await db.collection('generation_jobs').deleteMany({});
    console.log('🧹 Cleaned generation_jobs queue.');

    // 2. Test Gap Analyzer
    console.log('\n🔍 Testing Gap Analyzer...');
    const gaps = await GapAnalyzer.analyzeGaps();
    console.log(`➡️ Found ${gaps.length} categories under-capacity.`);
    if (gaps.length > 0) {
      console.log(`⭐ Top gap priority: "${gaps[0].interest}" at difficulty: "${gaps[0].difficulty}" (Priority ${gaps[0].priority})`);
    }

    // 3. Test Queue Lock mechanics
    console.log('\n📥 Testing Priority Queue locking mechanism...');
    const job1 = await GenerationQueue.enqueue('Algorithms', 'Hard', 3, 3, 'manual', 'Test Job 1');
    const job2 = await GenerationQueue.enqueue('Algorithms', 'Expert', 3, 1, 'manual', 'Test Job 2 (High Priority)');

    console.log(`➡️ Enqueued job 1: ${job1.toString()} (Priority 3)`);
    console.log(`➡️ Enqueued job 2: ${job2.toString()} (Priority 1)`);

    // Lock next job - must be job 2 (high priority first)
    const lockedJob = await GenerationQueue.dequeueAndLock('test-worker');
    if (lockedJob && lockedJob._id?.toString() === job2.toString()) {
      console.log(`✅ Priority matching passed: Worker successfully locked job 2 first (Priority 1).`);
    } else {
      console.error(`❌ Priority matching failed! Locked:`, lockedJob);
    }

    // 4. Run full orchestrator pass
    console.log('\n⏰ Running full Pool Warmer pass...');
    const res = await PoolWarmer.runOrchestrator();
    console.log(`✅ Orchestrator Pass Success: Enqueued ${res.jobsEnqueued} jobs. Worker processed ${res.jobsProcessed} jobs.`);

  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
  } finally {
    await client.close();
    process.exit(0);
  }
}

runTests();
