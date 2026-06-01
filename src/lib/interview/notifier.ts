import type { Db, ObjectId } from 'mongodb';

export interface Mailer {
  sendReportReady(candidateId: ObjectId, reportId: ObjectId): Promise<void>;
}

const NOTIFICATION_TYPE = 'report_ready';

/**
 * Create the in-app notification keyed on (candidateId, reportId) so repeated
 * dispatch never duplicates it, then attempt email. Email failure is recorded
 * but the single in-app notification is retained (Req 19).
 */
export async function dispatchReportReady(
  db: Db,
  mailer: Mailer,
  candidateId: ObjectId,
  reportId: ObjectId,
): Promise<{ inApp: boolean; email: boolean }> {
  const notifications = db.collection('notifications');
  await notifications.updateOne(
    { candidateId, reportId, type: NOTIFICATION_TYPE },
    {
      $setOnInsert: {
        candidateId,
        reportId,
        type: NOTIFICATION_TYPE,
        reportRef: reportId,
        message: 'Your interview coaching report is ready.',
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  let email = false;
  try {
    await mailer.sendReportReady(candidateId, reportId);
    email = true;
  } catch {
    await notifications.updateOne(
      { candidateId, reportId, type: NOTIFICATION_TYPE },
      { $set: { emailFailed: true } },
    );
  }

  return { inApp: true, email };
}
