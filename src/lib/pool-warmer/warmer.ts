import { GapAnalyzer } from './gap-analyzer';
import { GenerationQueue } from './generation-queue';
import { generateRawQuestions } from '../ai-generator';
import { QualityGate } from '../question-pool/quality-gate';
import { redis } from '../redis';

export class PoolWarmer {
  /**
   * Main cron orchestrator. Scans gaps, enqueues replenishment jobs, and runs a worker pass.
   */
  public static async runOrchestrator(): Promise<{ jobsEnqueued: number; jobsProcessed: number }> {
    console.log('⏰ Starting Pool Warmer Orchestrator run...');

    // 1. Analyze database gaps
    const gaps = await GapAnalyzer.analyzeGaps();
    console.log(`📊 Gap Analysis complete. Identified ${gaps.length} categories below target thresholds.`);

    let jobsEnqueued = 0;

    // 2. Queue up replenishment jobs
    for (const gap of gaps) {
      // Limit count per single job to a manageable chunk size to avoid LLM tokens limit (max 5 at once)
      const countToGenerate = Math.min(5, gap.gapSize);
      
      const jobId = await GenerationQueue.enqueue(
        gap.interest,
        gap.difficulty,
        countToGenerate,
        gap.priority,
        'cron',
        `Scheduled run: current pool size ${gap.currentSize}/${gap.targetSize}`
      );
      
      if (jobId) {
        jobsEnqueued++;
      }
    }

    console.log(`📥 Enqueued ${jobsEnqueued} background generation tasks.`);

    // 3. Process next locked job from queue (worker loop)
    let jobsProcessed = 0;
    const workerId = `worker-${Math.floor(Math.random() * 10000)}`;
    
    // Process up to 3 jobs in this single worker execution cycle to avoid timeout limits
    while (jobsProcessed < 3) {
      const job = await GenerationQueue.dequeueAndLock(workerId);
      if (!job) {
        break; // No pending/processing jobs in queue
      }

      console.log(`👷 Locked Job ${job._id} for "${job.interest}" (${job.difficulty}, count: ${job.count})`);

      try {
        // Generate raw MCQs via LLM Client
        const raw = await generateRawQuestions(job.interest, job.count, job.difficulty);
        
        // Pass through Ingestion Quality Gate (deduping and normalising)
        const res = await QualityGate.processAndInsert(job.interest, job.difficulty, raw);
        
        console.log(`✅ Job ${job._id} Complete: Generated ${raw.length}, Inserted ${res.insertedCount}, Duplicates caught ${res.duplicateCount}`);

        // Mark completed in transactional queue
        await GenerationQueue.markComplete(job._id!, {
          generated: raw.length,
          inserted: res.insertedCount,
          duplicates: res.duplicateCount,
          rejected: raw.length - res.insertedCount - res.duplicateCount,
          questionIds: res.questionIds,
        });

        // Invalidate Redis hot cache for this category so selector picks up new items immediately
        const cacheKey = `pool:${job.interest.toLowerCase().replace(/[^a-z]/g, '')}:${job.difficulty.toLowerCase()}`;
        await redis.del(cacheKey);

        jobsProcessed++;

      } catch (err: any) {
        console.error(`❌ Worker failed on job ${job._id}:`, err.message);
        await GenerationQueue.markFailed(job._id!, err.message);
        break; // Stop running further jobs in this loop if LLM or network crashed
      }
    }

    return {
      jobsEnqueued,
      jobsProcessed,
    };
  }
}
