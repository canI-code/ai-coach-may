import { ObjectId } from 'mongodb';
import clientPromise from '../mongodb';
import { GenerationJob } from '../assessment';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export class GenerationQueue {
  /**
   * Safe transaction-level enqueueing of gap jobs
   */
  public static async enqueue(
    interest: string,
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert',
    count: number,
    priority: number,
    triggeredBy: 'cron' | 'event' | 'manual' | 'pool_depleted',
    triggerDetail?: string
  ): Promise<ObjectId> {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // 1. De-duplicate identical pending/processing requests in the queue
    const existing = await db.collection('generation_jobs').findOne({
      interest,
      difficulty,
      status: { $in: ['queued', 'processing'] },
    });

    if (existing) {
      // If new priority is higher, escalate priority
      if (priority < existing.priority) {
        await db.collection('generation_jobs').updateOne(
          { _id: existing._id },
          { $set: { priority, triggerDetail: `${existing.triggerDetail} | Escalated: ${triggerDetail}` } }
        );
      }
      return existing._id;
    }

    // 2. Insert new task
    const job: GenerationJob = {
      interest,
      difficulty,
      count,
      status: 'queued',
      priority,
      triggeredBy,
      triggerDetail,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };

    const res = await db.collection('generation_jobs').insertOne(job);
    return res.insertedId;
  }

  /**
   * Fetches the next high-priority job and locks it with a processing lease
   */
  public static async dequeueAndLock(workerId: string = 'worker-1'): Promise<GenerationJob | null> {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const leaseTimeSeconds = 300; // 5 minutes lock
    const leaseExpiration = new Date(Date.now() - leaseTimeSeconds * 1000);

    // Select jobs that are 'queued' or 'processing' but lease expired (stalled workers)
    const filter = {
      $or: [
        { status: 'queued' },
        { status: 'processing', startedAt: { $lt: leaseExpiration } },
      ],
      retryCount: { $lt: 3 }, // Under retry threshold
    };

    const update = {
      $set: {
        status: 'processing' as const,
        startedAt: new Date(),
        workerId,
      },
    };

    const options = {
      sort: { priority: 1, createdAt: 1 } as any, // Priority first, then oldest first
      returnDocument: 'after' as const,
    };

    const result = await db.collection('generation_jobs').findOneAndUpdate(filter, update, options);
    
    // Check if result has value
    return result ? (result as unknown as GenerationJob) : null;
  }

  /**
   * Completes a task and marks it finished
   */
  public static async markComplete(
    jobId: ObjectId,
    metrics: { generated: number; inserted: number; duplicates: number; rejected: number; questionIds: ObjectId[] }
  ): Promise<void> {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    await db.collection('generation_jobs').updateOne(
      { _id: jobId },
      {
        $set: {
          status: 'completed',
          generatedCount: metrics.generated,
          insertedCount: metrics.inserted,
          duplicatesFound: metrics.duplicates,
          qualityRejected: metrics.rejected,
          resultQuestionIds: metrics.questionIds,
          completedAt: new Date(),
        },
      }
    );
  }

  /**
   * Logs a failed run, increments retry count, and handles crash backoffs
   */
  public static async markFailed(jobId: ObjectId, error: string): Promise<void> {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const job = await db.collection('generation_jobs').findOne({ _id: jobId }) as unknown as GenerationJob | null;
    if (!job) return;

    const newRetryCount = job.retryCount + 1;
    const status = newRetryCount >= job.maxRetries ? ('failed' as const) : ('queued' as const);

    await db.collection('generation_jobs').updateOne(
      { _id: jobId },
      {
        $set: {
          status,
          retryCount: newRetryCount,
          lastError: error,
          completedAt: status === 'failed' ? new Date() : undefined,
        },
      }
    );
  }
}
