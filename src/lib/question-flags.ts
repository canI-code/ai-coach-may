import { Db, ObjectId } from 'mongodb';

export type QuestionFlagReason = 'incorrect_question' | 'incorrect_answer' | 'spelling_mistake' | 'other';

export interface QuestionFlagDoc {
  _id?: ObjectId;
  questionId: ObjectId;
  userId: ObjectId;
  sessionId: ObjectId;
  attemptId: ObjectId;
  reasonType: QuestionFlagReason;
  reasonText?: string | null;
  status: 'open' | 'safe' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
  resolvedBy?: ObjectId | null;
  adminNote?: string;
}

export async function getUserOpenFlaggedQuestionIds(db: Db, userId: ObjectId): Promise<ObjectId[]> {
  const flags = await db.collection<QuestionFlagDoc>('question_flags')
    .find({ userId, status: 'open' }, { projection: { questionId: 1 } })
    .toArray();

  return flags.map(flag => flag.questionId);
}
