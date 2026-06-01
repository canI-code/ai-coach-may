import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
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

const okMailer = { async sendReportReady() {} };

// Feature: interview-module, Property 35: Report-ready notification is created exactly once and is idempotent
describe('Property 35: report-ready notification idempotent', () => {
  it('creates exactly one in-app notification across repeated dispatch', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (n) => {
        const { db, docs } = makeDb();
        const candidateId = new ObjectId();
        const reportId = new ObjectId();
        let last: { inApp: boolean; email: boolean } | undefined;
        for (let i = 0; i < n; i++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          last = await dispatchReportReady(db as any, okMailer, candidateId, reportId);
        }
        const matching = docs.filter(
          (d) =>
            d.type === 'report_ready' &&
            idEq(d.candidateId, candidateId) &&
            idEq(d.reportId, reportId),
        );
        expect(matching).toHaveLength(1);
        expect(idEq(matching[0].reportRef, reportId)).toBe(true);
        expect(last?.inApp).toBe(true);
      }),
    );
  });
});
