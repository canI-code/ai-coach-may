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

    // 6. Format initial assessments as grouped sessions
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

      return {
        sessionId: null,
        sessionType: 'initial',
        interests: Array.from(uniqueInterests),
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

    // 7. Group practice attempts by sessionId
    const attemptsBySession = new Map<string, any[]>();
    practiceAttempts.forEach(att => {
      const sId = att.sessionId.toString();
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

    // 8. Format practice sessions
    const formattedPractice = sessions.map(session => {
      const sId = session._id.toString();
      const sessionAttempts = attemptsBySession.get(sId) || [];
      
      // Sort attempts by attemptNumber ascending
      sessionAttempts.sort((a, b) => a.attemptNumber - b.attemptNumber);

      const retakesToday = retakeCountsMap.get(sId) || 0;
      const canRetake = retakesToday < 2;

      return {
        sessionId: sId,
        sessionType: 'practice',
        interests: session.interests || [],
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

    return NextResponse.json({ attempts: allSessions });

  } catch (error: any) {
    console.error('Exam History GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
