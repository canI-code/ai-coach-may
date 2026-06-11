import { cookies } from 'next/headers';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) return null;

    // Use pipe '|' as a safer separator since IDs might contain underscores
    const [prefix, userId, sessionId] = token.split('|');

    if (prefix !== 'token' || !userId || !sessionId) {
      console.error('Invalid token format');
      return null;
    }

    const client = await clientPromise;
    let db = client.db('aicoach');

    let user = await db.collection('users').findOne({ 
      _id: new ObjectId(userId),
      'sessions.id': sessionId 
    });

    if (!user) {
      db = client.db('aicoach_institutional');
      user = await db.collection('users').findOne({ 
        _id: new ObjectId(userId),
        'sessions.id': sessionId 
      });
    }

    if (!user) {
      console.error(`No user found for ID ${userId} and session ${sessionId}`);
      return null;
    }

    return user;
  } catch (err: any) {
    console.error('Auth check error:', err.message);
    return null;
  }
}

export function isUserAccessBlocked(user: any, type: 'interview' | 'exam'): { blocked: boolean; reason?: string } {
  if (user.role !== 'mentee') return { blocked: false };
  
  if (user.status === 'disabled') {
    return { blocked: true, reason: 'Your institutional account has been disabled by your mentor.' };
  }
  
  const limits = user.accessLimit;
  const usage = user.usage || { interviewsCompleted: 0, examsCompleted: 0 };

  if (limits) {
    if (limits.expiresAt && new Date(limits.expiresAt) < new Date()) {
      return { blocked: true, reason: 'Your institutional access has expired.' };
    }

    if (type === 'interview') {
      if (limits.interviewsCount !== null && usage.interviewsCompleted >= limits.interviewsCount) {
        return { blocked: true, reason: `You have reached your limit of ${limits.interviewsCount} interviews.` };
      }
    } else if (type === 'exam') {
      if (limits.examsCount !== null && usage.examsCompleted >= limits.examsCount) {
        return { blocked: true, reason: `You have reached your limit of ${limits.examsCount} exams.` };
      }
    }
  }

  return { blocked: false };
}

