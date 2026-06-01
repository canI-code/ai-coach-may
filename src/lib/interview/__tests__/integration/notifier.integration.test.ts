import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import { dispatchReportReady } from '@/lib/interview/notifier';

type Doc = Record<string, unknown> & { candidateId: ObjectId; reportId: ObjectId; type: string };

function idEq(a: unknown, b: unknown): boolean {
  return a instanceof ObjectId && b instanceof ObjectId ? a.equals(b) : a === b;
}

function makeDb() {
  const docs: Doc[] = [];
  const collection = () => ({
    async updateOne(
      filter: { candidateId: ObjectId; reportId: ObjectId; type: string },
      update: { $set?: Record<string, unknown>; $setOnInsert?: Record<string, unknown> },
      opts?: { upsert?: boolean },
    ) {
      const found = docs.find(
        (d) =>
          idEq(d.candidateId, filter.candidateId) &&
          idEq(d.reportId, filter.reportId) &&
          d.type === filter.type,
      );
      if (found) {
        if (update.$set) Object.assign(found, update.$set);
        return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
      }
      if (opts?.upsert) {
        docs.push({ ...filter, ...(update.$setOnInsert ?? {}), ...(update.$set ?? {}) } as Doc);
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    },
  });
  return { db: { collection }, docs };
}

describe('notifier integration: email failure handling', () => {
  it('retains a single in-app notification when email dispatch fails', async () => {
    const { db, docs } = makeDb();
    const failingMailer = {
      async sendReportReady() {
        throw new Error('smtp unavailable');
      },
    };
    const candidateId = new ObjectId();
    const reportId = new ObjectId();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await dispatchReportReady(db as any, failingMailer, candidateId, reportId);

    expect(res.inApp).toBe(true);
    expect(res.email).toBe(false);
    const matching = docs.filter((d) => d.type === 'report_ready');
    expect(matching).toHaveLength(1);
    expect(matching[0].emailFailed).toBe(true);
  });
});
