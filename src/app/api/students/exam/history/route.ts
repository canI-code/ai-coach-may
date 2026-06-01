import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DB_NAME = process.env.MONGODB_DB_NAME || 'aicoach';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // 1. Fetch completed initial assessments
    const assessments = await db.collection('user_assessment_attempts')
      .find({ userId: user._id, status: 'completed' })
      .toArray();

    // 2. Fetch completed practice attempts
    const practiceAttempts = await db.collection('exam_attempts')
      .find({ userId: user._id, completedAt: { $exists: true } })
      .toArray();

    const sessionIds = practiceAttempts.map(att => att.sessionId).filter(Boolean);

    // 3. Fetch practice sessions to get interests, questionCount, etc.
    const sessions = await db.collection('exam_sessions')
      .find({ _id: { $in: sessionIds } })
      .toArray();
    const sessionsMap = new Map(sessions.map(s => [s._id.toString(), s]));

    // 4. Fetch questions to resolve interests for initial assessments
    const assessmentQuestionIds = [...new Set(assessments.flatMap(a => a.questionIds || []))];
    let allQsMap = new Map<string, any>();
    if (assessmentQuestionIds.length > 0) {
      const questionsNonAi = await db.collection('questions_non_ai')
        .find({ _id: { $in: assessmentQuestionIds } })
        .toArray();
      const questionsAi = await db.collection('questions_ai')
        .find({ _id: { $in: assessmentQuestionIds } })
        .toArray();
      allQsMap = new Map([...questionsNonAi, ...questionsAi].map(q => [q._id.toString(), q]));
    }

    // === PER-INTEREST STATS COMPUTATION ===
    const interestStatsMap: Record<string, { correct: number; total: number }> = {};

    // Helper to compute per-interest stats from an array of raw attempt docs
    const computeInterestStats = (
      rawAttempts: any[],
      qsMap: Map<string, any>
    ) => {
      const m: Record<string, { correct: number; total: number }> = {};
      rawAttempts.forEach(att => {
        (att.answers || []).forEach((ans: any) => {
          const q = qsMap.get(ans.questionId.toString());
          const interest = q?.interest;
          if (!interest) return;
          if (!m[interest]) m[interest] = { correct: 0, total: 0 };
          m[interest].total++;
          if (ans.isCorrect) m[interest].correct++;
        });
      });
      return Object.entries(m)
        .map(([interest, data]) => ({
          interest,
          correct: data.correct,
          total: data.total,
          percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
        }))
        .sort((a, b) => b.percentage - a.percentage);
    };

    // Helper to accumulate per-interest data across ALL attempts for global stats
    const accumulateInterestStats = (
      answers: { questionId: any; isCorrect?: boolean }[],
      qsMap: Map<string, any>
    ) => {
      (answers || []).forEach(ans => {
        const q = qsMap.get(ans.questionId.toString());
        const interest = q?.interest;
        if (!interest) return;
        if (!interestStatsMap[interest]) interestStatsMap[interest] = { correct: 0, total: 0 };
        interestStatsMap[interest].total++;
        if (ans.isCorrect) interestStatsMap[interest].correct++;
      });
    };

    // Process initial assessment attempts (questions already in allQsMap)
    assessments.forEach(att => {
      accumulateInterestStats(att.answers || [], allQsMap);
    });

    // Fetch questions for practice attempts to resolve interests
    const practiceQuestionIds = [...new Set(
      practiceAttempts.flatMap(att => (att.questionIds || []).map((id: any) => id.toString()))
    )];
    let practiceQsMap = new Map<string, any>();
    if (practiceQuestionIds.length > 0) {
      const practiceQs = await db.collection('questions_ai')
        .find({ _id: { $in: practiceQuestionIds.map((id: string) => new ObjectId(id)) } })
        .toArray();
      practiceQsMap = new Map(practiceQs.map(q => [q._id.toString(), q]));
    }

    // Process practice attempts
    practiceAttempts.forEach(att => {
      accumulateInterestStats(att.answers || [], practiceQsMap);
    });

    // Format interest stats sorted by percentage descending
    const interestStats = Object.entries(interestStatsMap)
      .map(([interest, data]) => ({
        interest,
        correct: data.correct,
        total: data.total,
        percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // 5. Query 24h retake counts in one aggregation (max 2 retakes per 24 hours per session)
    // Retakes are attempts where attemptNumber > 1
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let retakeCountsMap = new Map<string, number>();
    if (sessionIds.length > 0) {
      const retakeCounts = await db.collection('exam_attempts').aggregate([
        {
          $match: {
            userId: user._id,
            sessionId: { $in: sessionIds },
            attemptNumber: { $gt: 1 },
            startedAt: { $gte: twentyFourHoursAgo }
          }
        },
        {
          $group: {
            _id: '$sessionId',
            count: { $sum: 1 }
          }
        }
      ]).toArray();
      retakeCountsMap = new Map(retakeCounts.map(r => [r._id.toString(), r.count]));
    }

    // 6. Format initial assessments as grouped sessions (with per-session interest stats)
    const formattedAssessments = assessments.map(att => {
      const durationSeconds = att.completedAt && att.startedAt
        ? Math.round((new Date(att.completedAt).getTime() - new Date(att.startedAt).getTime()) / 1000)
        : 0;

      // Extract unique interests from questionIds
      const uniqueInterests = new Set<string>();
      att.questionIds?.forEach((qId: any) => {
        const q = allQsMap.get(qId.toString());
        if (q?.interest) uniqueInterests.add(q.interest);
      });

      // Per-session interest stats from this single attempt (aggregated across all answers)
      const sessionInterestStats = computeInterestStats([att], allQsMap);

      return {
        sessionId: null,
        sessionType: 'initial',
        interests: Array.from(uniqueInterests),
        interestStats: sessionInterestStats,
        totalQuestionCount: att.questionIds?.length || 0,
        canRetake: false,
        attempts: [
          {
            attemptId: att._id.toString(),
            attemptNumber: 1,
            date: att.completedAt,
            scorePercentage: att.scorePercentage || 0,
            level: att.levelDetermined || 'Beginner',
            duration: durationSeconds,
            questionCount: att.questionIds?.length || 0
          }
        ]
      };
    });

    // 7. Group practice attempts by sessionId (both raw and formatted)
    const rawAttemptsBySession = new Map<string, any[]>();
    const attemptsBySession = new Map<string, any[]>();
    practiceAttempts.forEach(att => {
      const sId = att.sessionId.toString();

      if (!rawAttemptsBySession.has(sId)) {
        rawAttemptsBySession.set(sId, []);
      }
      rawAttemptsBySession.get(sId)!.push(att);

      if (!attemptsBySession.has(sId)) {
        attemptsBySession.set(sId, []);
      }
      
      const durationSeconds = att.completedAt && att.startedAt
        ? Math.round((new Date(att.completedAt).getTime() - new Date(att.startedAt).getTime()) / 1000)
        : 0;

      attemptsBySession.get(sId)!.push({
        attemptId: att._id.toString(),
        attemptNumber: att.attemptNumber || 1,
        date: att.completedAt,
        scorePercentage: att.scorePercentage || 0,
        level: att.levelAchieved || 'Beginner',
        duration: durationSeconds,
        questionCount: att.questionIds?.length || 0
      });
    });

    // 8. Format practice sessions (with per-session interest stats aggregated across all retakes)
    const formattedPractice = sessions.map(session => {
      const sId = session._id.toString();
      const sessionAttempts = attemptsBySession.get(sId) || [];
      const rawAttempts = rawAttemptsBySession.get(sId) || [];

      // Sort attempts by attemptNumber ascending
      sessionAttempts.sort((a, b) => a.attemptNumber - b.attemptNumber);

      // Per-session interest stats aggregated across all retakes
      const sessionInterestStats = computeInterestStats(rawAttempts, practiceQsMap);

      const retakesToday = retakeCountsMap.get(sId) || 0;
      const canRetake = retakesToday < 2;

      return {
        sessionId: sId,
        sessionType: 'practice',
        interests: session.interests || [],
        interestStats: sessionInterestStats,
        totalQuestionCount: session.totalQuestionCount || session.questionCount || 20,
        canRetake,
        attempts: sessionAttempts
      };
    }).filter(s => s.attempts.length > 0);

    // 9. Combine initial and practice, and sort by latest attempt date descending
    const allSessions = [...formattedAssessments, ...formattedPractice].sort((a, b) => {
      const dateA = a.attempts[a.attempts.length - 1]?.date || new Date(0);
      const dateB = b.attempts[b.attempts.length - 1]?.date || new Date(0);
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return NextResponse.json({ attempts: allSessions, interestStats });

  } catch (error: any) {
    console.error('Exam History GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
