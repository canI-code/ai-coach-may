import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDbForUser } from '@/lib/db-selector';
import clientPromise from '@/lib/mongodb';
import { QuestionSelector } from '@/lib/question-pool/question-selector';
import { ProficiencyEngine } from '@/lib/proficiency/proficiency-engine';
import { ObjectId } from 'mongodb';
import { getUserOpenFlaggedQuestionIds } from '@/lib/question-flags';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Enforce B2B credit limits
    if (user.role === 'mentee') {
      const { checkCreditAvailable, deductCredit } = await import('@/lib/b2b/access');
      const { db: userDb } = await getDbForUser(user._id);
      const creditCheck = await checkCreditAvailable(userDb, user._id, 'exam');
      if (!creditCheck.allowed) {
        return NextResponse.json({ error: 'limit_exceeded', message: creditCheck.reason }, { status: 403 });
      }
      await deductCredit(userDb, user._id, 'exam');
    }

    const { interests, questionCount = 20, campaignId } = await req.json();

    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return NextResponse.json({ error: 'Interests must be provided' }, { status: 400 });
    }

    const { db } = await getDbForUser(user._id);
    const blockedQuestionIds = await getUserOpenFlaggedQuestionIds(db, user._id);

    // Get user's multi-dimensional proficiency profile
    const profile = await ProficiencyEngine.getUserProficiency(user._id);

    // Calculate chunks
    const CHUNK_PERCENTAGE = 0.25;
    let initialChunkSize = Math.max(3, Math.floor(questionCount * CHUNK_PERCENTAGE));
    if (initialChunkSize > questionCount) initialChunkSize = questionCount;
    
    // Distribute the initial chunk across interests
    const questionsPerInterest = Math.ceil(initialChunkSize / interests.length);
    
    console.log(`🚀 Creating adaptive practice exam for user ${user._id}. Total: ${questionCount}. Initial Chunk: ${initialChunkSize}`);

    // Fetch questions in parallel using IRT question selector
    const allQuestionIds: ObjectId[] = [];
    const selectionPromises = interests.map(async (interest) => {
      const ip = profile.interestProfiles[interest] || {
        abilityRating: 1000,
        currentLevel: 'Intermediate',
        effectiveRating: 1000
      };
      
      const difficultyTier = ip.currentLevel === 'Expert' ? 'Expert' :
                             ip.currentLevel === 'Advanced' ? 'Hard' :
                             ip.currentLevel === 'Intermediate' ? 'Medium' : 'Easy';

      const selectedQs = await QuestionSelector.selectQuestions({
        interest,
        userAbilityRating: ip.effectiveRating || ip.abilityRating,
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

    let campaignOid: ObjectId | null = null;
    let campaignBatchOid: ObjectId | null = null;
    if (campaignId) {
      try {
        campaignOid = new ObjectId(campaignId);
        const campaign = await db.collection('practice_campaigns').findOne({ _id: campaignOid });
        if (campaign) {
          campaignBatchOid = campaign.batchId;
        }
      } catch (err) {
        console.error('Failed to parse campaignId:', err);
      }
    }

    const finalBatchId = campaignBatchOid || (user.batchId ? new ObjectId(user.batchId) : null);
    const session = {
      userId: user._id,
      sessionType: 'practice',
      interests,
      totalQuestionCount: questionCount,
      status: 'active',
      startedAt: new Date(),
      ...(finalBatchId ? { batchId: finalBatchId } : {}),
      ...(campaignOid ? { campaignId: campaignOid } : {})
    };

    const sessionResult = await db.collection('exam_sessions').insertOne(session);

    const attempt = {
      userId: user._id,
      sessionId: sessionResult.insertedId,
      attemptNumber: 1,
      questionIds: allQuestionIds,
      answers: [],
      startedAt: new Date(),
      ...(finalBatchId ? { batchId: finalBatchId } : {}),
      ...(campaignOid ? { campaignId: campaignOid } : {})
    };

    const attemptResult = await db.collection('exam_attempts').insertOne(attempt);

    // Fetch question details from the unified questions_ai collection
    const poolQuestions = await db.collection('questions_ai')
      .find({ _id: { $in: allQuestionIds } })
      .toArray();
    
    const qsMap = new Map<string, any>(poolQuestions.map((q: any) => [q._id.toString(), q]));
    const orderedQs = allQuestionIds.map(id => {
      const q = qsMap.get(id.toString());
      if (!q) return null;
      const correctChoice = q.choices.find((c: any) => c.correct);
      return {
        _id: q._id,
        text: q.text,
        choices: q.choices.map((c: any) => ({ id: c.id, text: c.text })),
        interest: q.interest,
        difficulty: q.difficulty,
        explanation: q.explanation || null,
        correctChoiceId: correctChoice?.id || null
      };
    }).filter((q): q is any => q !== null);

    return NextResponse.json({
      sessionId: sessionResult.insertedId,
      attemptId: attemptResult.insertedId,
      totalQuestionCount: questionCount,
      questionCount: orderedQs.length,
      questions: orderedQs
    });

  } catch (error: any) {
    console.error('Practice Exam Create Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
