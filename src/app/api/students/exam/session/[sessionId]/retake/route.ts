import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { QuestionSelector } from '@/lib/question-pool/question-selector';
import { ObjectId } from 'mongodb';
import { getUserOpenFlaggedQuestionIds } from '@/lib/question-flags';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const blockedQuestionIds = await getUserOpenFlaggedQuestionIds(db, user._id);

    // 1. Fetch the original session config
    const originalSession = await db.collection('exam_sessions').findOne({
      _id: new ObjectId(sessionId),
      userId: user._id
    });

    if (!originalSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 2. Reject if target session is initial assessment
    if (originalSession.sessionType === 'initial') {
      return NextResponse.json({ error: 'Initial assessments cannot be retaken.' }, { status: 403 });
    }

    // 3. Enforce rate limiting: Max 2 retakes per 24 hours per session
    // Retakes are attempts where attemptNumber > 1
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const retakesCount = await db.collection('exam_attempts').countDocuments({
      userId: user._id,
      sessionId: new ObjectId(sessionId),
      attemptNumber: { $gt: 1 },
      startedAt: { $gte: twentyFourHoursAgo }
    });

    if (retakesCount >= 2) {
      return NextResponse.json({
        error: 'LIMIT_EXCEEDED',
        message: 'Maximum 2 retakes per 24-hour period reached for this practice session.'
      }, { status: 429 });
    }

    // 4. Retrieve user's initial baseline level from MCQ profile (user_assessment_stats)
    const assessmentStats = await db.collection('user_assessment_stats').findOne({ userId: user._id });
    const baselineLevel = assessmentStats?.currentLevel || 'Intermediate';

    // Map baseline level to difficulty and rating
    let targetRating = 1000;
    let difficultyTier: 'Easy' | 'Medium' | 'Hard' | 'Expert' = 'Medium';

    switch (baselineLevel) {
      case 'Expert':
        targetRating = 1900;
        difficultyTier = 'Expert';
        break;
      case 'Advanced':
        targetRating = 1400;
        difficultyTier = 'Hard';
        break;
      case 'Intermediate':
        targetRating = 1000;
        difficultyTier = 'Medium';
        break;
      case 'Beginner':
      default:
        targetRating = 600;
        difficultyTier = 'Easy';
        break;
    }

    const interests = originalSession.interests || [];
    const questionCount = originalSession.totalQuestionCount || originalSession.questionCount || 20;

    if (interests.length === 0) {
      return NextResponse.json({ error: 'Original session has no interests defined.' }, { status: 400 });
    }

    // 5. Query existing attempts for this sessionId
    const existingAttempts = await db.collection('exam_attempts')
      .find({ sessionId: new ObjectId(sessionId), userId: user._id })
      .sort({ attemptNumber: 1 })
      .toArray();

    const currentAttemptsCount = existingAttempts.length;
    let maxAttemptNumber = 1;
    existingAttempts.forEach(att => {
      if (att.attemptNumber && att.attemptNumber > maxAttemptNumber) {
        maxAttemptNumber = att.attemptNumber;
      }
    });

    const nextAttemptNumber = maxAttemptNumber + 1;

    // 6. DB Pruning Safeguard: Store at most 6 attempts in DB. 
    // Delete the oldest attempt (usually attemptNumber = 1 or lowest available) and return it to client for localStorage backup
    let prunedAttempt: any = null;
    if (currentAttemptsCount >= 6) {
      const oldestAttempt = existingAttempts[0]; // Already sorted by attemptNumber ascending
      
      const durationSeconds = oldestAttempt.completedAt && oldestAttempt.startedAt
        ? Math.round((new Date(oldestAttempt.completedAt).getTime() - new Date(oldestAttempt.startedAt).getTime()) / 1000)
        : 0;

      prunedAttempt = {
        attemptId: oldestAttempt._id.toString(),
        attemptNumber: oldestAttempt.attemptNumber || 1,
        date: oldestAttempt.completedAt || oldestAttempt.startedAt,
        scorePercentage: oldestAttempt.scorePercentage || 0,
        level: oldestAttempt.levelAchieved || oldestAttempt.levelDetermined || 'Beginner',
        duration: durationSeconds,
        questionCount: oldestAttempt.questionIds?.length || 0
      };

      // Delete the oldest attempt from DB
      await db.collection('exam_attempts').deleteOne({ _id: oldestAttempt._id });
      console.log(`🧹 DB Pruning: Deleted attempt ${oldestAttempt._id} (Attempt #${oldestAttempt.attemptNumber}) for session ${sessionId}`);
    }

    // 7. Select the initial chunk of questions at baseline difficulty.
    // Subsequent chunks are fetched adaptively via /fetch-chunk as the user answers,
    // using live ELO updates so difficulty can escalate or ease mid-session.
    // Initial chunk is 50% of total (min 3) so the user sees a good portion upfront.
    const INITIAL_CHUNK_PERCENTAGE = 0.5;
    let initialChunkSize = Math.max(3, Math.floor(questionCount * INITIAL_CHUNK_PERCENTAGE));
    if (initialChunkSize > questionCount) initialChunkSize = questionCount;

    const questionsPerInterest = Math.ceil(initialChunkSize / interests.length);

    console.log(`🚀 Seeding retake attempt #${nextAttemptNumber} for session ${sessionId} (Difficulty: ${difficultyTier}, Rating: ${targetRating}, InitialChunk: ${initialChunkSize}/${questionCount})`);

    const allQuestionIds: ObjectId[] = [];
    const selectionPromises = interests.map(async (interest: string) => {
      const selectedQs = await QuestionSelector.selectQuestions({
        interest,
        userAbilityRating: targetRating,
        count: questionsPerInterest,
        excludeQuestionIds: blockedQuestionIds,
        difficultyTier
      });
      return selectedQs.map(q => q._id as ObjectId);
    });

    const results = await Promise.all(selectionPromises);
    results.forEach((ids) => {
      allQuestionIds.push(...ids);
    });

    // Trim to exact initialChunkSize
    if (allQuestionIds.length > initialChunkSize) {
      allQuestionIds.length = initialChunkSize;
    }

    if (allQuestionIds.length === 0) {
      return NextResponse.json({ 
        error: 'INCOMPLETE_GENERATION', 
        message: 'Could not retrieve enough questions from the pool. Background warmer will replenish shortly.' 
      }, { status: 503 });
    }

    // 8. Create new attempt document inside exam_attempts linked to same sessionId
    const newAttempt = {
      userId: user._id,
      sessionId: new ObjectId(sessionId),
      attemptNumber: nextAttemptNumber,
      questionIds: allQuestionIds,
      answers: [],
      startedAt: new Date()
    };

    const attemptResult = await db.collection('exam_attempts').insertOne(newAttempt);

    // 9. Reset session status to active in exam_sessions
    await db.collection('exam_sessions').updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { status: 'active', startedAt: new Date() }, $unset: { completedAt: "" } }
    );

    // 10. Fetch question details from the unified questions_ai collection
    const poolQuestions = await db.collection('questions_ai')
      .find({ _id: { $in: allQuestionIds } })
      .toArray();
    
    const qsMap = new Map(poolQuestions.map(q => [q._id.toString(), q]));
    const orderedQs = allQuestionIds.map(id => {
      const q = qsMap.get(id.toString());
      if (!q) return null;
      return {
        _id: q._id,
        text: q.text,
        choices: q.choices.map((c: any) => ({ id: c.id, text: c.text })), // Strip correct choice for security
        interest: q.interest,
        difficulty: q.difficulty
      };
    }).filter((q): q is any => q !== null);

    return NextResponse.json({
      sessionId: originalSession._id,
      attemptId: attemptResult.insertedId,
      totalQuestionCount: questionCount,
      questionCount: orderedQs.length,
      questions: orderedQs,
      prunedAttempt
    });

  } catch (error: any) {
    console.error('Practice Exam Retake Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
