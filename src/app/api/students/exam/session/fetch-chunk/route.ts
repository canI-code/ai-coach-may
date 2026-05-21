import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { QuestionSelector } from '@/lib/question-pool/question-selector';
import { ProficiencyEngine } from '@/lib/proficiency/proficiency-engine';
import { ObjectId } from 'mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attemptId } = await req.json();

    if (!attemptId) {
      return NextResponse.json({ error: 'Missing attemptId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // 1. Get Attempt and Session
    const attempt = await db.collection('exam_attempts').findOne({ _id: new ObjectId(attemptId), userId: user._id });
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

    const session = await db.collection('exam_sessions').findOne({ _id: attempt.sessionId });
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Check if we need more questions
    const totalNeeded = session.totalQuestionCount || session.questionCount;
    const currentlyLoaded = attempt.questionIds.length;
    if (currentlyLoaded >= totalNeeded) {
      return NextResponse.json({ message: 'All questions already loaded', newQuestions: [] });
    }

    // 2. Determine how many to fetch in next chunk
    const CHUNK_PERCENTAGE = 0.25;
    let nextChunkSize = Math.max(3, Math.floor(totalNeeded * CHUNK_PERCENTAGE));
    if (currentlyLoaded + nextChunkSize > totalNeeded) {
      nextChunkSize = totalNeeded - currentlyLoaded;
    }

    const questionsPerInterest = Math.ceil(nextChunkSize / session.interests.length);

    // 3. Retrieve user's multi-dimensional profile to get precise adaptive ratings (with decay)
    const profile = await ProficiencyEngine.getUserProficiency(user._id);

    // 4. Select questions dynamically from pool in parallel
    const allCandidates: ObjectId[] = [];
    const selectionPromises = session.interests.map(async (interest: string) => {
      const ip = profile.interestProfiles[interest] || {
        abilityRating: 1000,
        currentLevel: 'Intermediate',
        effectiveRating: 1000
      };

      const difficultyTier = ip.currentLevel === 'Expert' ? 'Expert' :
                             ip.currentLevel === 'Advanced' ? 'Hard' :
                             ip.currentLevel === 'Intermediate' ? 'Medium' : 'Easy';

      const selected = await QuestionSelector.selectQuestions({
        interest,
        userAbilityRating: ip.effectiveRating || ip.abilityRating,
        count: questionsPerInterest,
        excludeQuestionIds: attempt.questionIds, // Exclude all questions that are already in this attempt!
        difficultyTier
      });
      return selected.map(q => q._id as ObjectId);
    });

    const selectionResults = await Promise.all(selectionPromises);
    selectionResults.forEach((ids) => {
      ids.forEach((id: any) => {
        if (!allCandidates.some(candId => candId.equals(id))) {
          allCandidates.push(id);
        }
      });
    });

    // Trim candidates to the exact chunk size
    const newQuestionIds = allCandidates.slice(0, nextChunkSize);

    if (newQuestionIds.length === 0) {
       console.warn('Could not fetch more questions from pool.');
       return NextResponse.json({ message: 'No more questions available in pool', newQuestions: [] });
    }

    // 5. Append to Attempt
    await db.collection('exam_attempts').updateOne(
      { _id: attempt._id },
      { $push: { questionIds: { $each: newQuestionIds } } } as any
    );

    // 6. Fetch details from unified pool and format for UI
    const poolQuestions = await db.collection('questions_ai')
      .find({ _id: { $in: newQuestionIds } })
      .toArray();
    
    const qsMap = new Map(poolQuestions.map(q => [q._id.toString(), q]));
    const orderedQs = newQuestionIds.map(id => {
      const q = qsMap.get(id.toString());
      if (!q) return null;
      return {
        _id: q._id,
        text: q.text,
        choices: q.choices.map((c: any) => ({ id: c.id, text: c.text })), // Strip correct choice
        interest: q.interest,
        difficulty: q.difficulty
      };
    }).filter((q): q is any => q !== null);

    return NextResponse.json({
      newQuestions: orderedQs,
      totalLoaded: currentlyLoaded + orderedQs.length
    });

  } catch (error: any) {
    console.error('Fetch Next Chunk Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
