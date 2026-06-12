/**
 * B2B Access Control — Credit-based access enforcement and portal visibility.
 */

import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserCredits {
  allocated: number;
  used: number;
  remaining: number;
}

export interface CreditCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface PortalCheckResult {
  allowed: boolean;
  reason?: string;
}

// ── Credit Checks ────────────────────────────────────────────────────────────

/**
 * Check if a B2B user has enough credits to start a session.
 * 1 credit = 1 session (interview or exam).
 */
export async function checkCreditAvailable(
  db: Db,
  userId: string | ObjectId,
  type: 'interview' | 'exam'
): Promise<CreditCheckResult> {
  const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
  const user = await db.collection('users').findOne({ _id: objectId });

  if (!user) {
    return { allowed: false, reason: 'User not found.' };
  }

  if (user.status === 'disabled') {
    return { allowed: false, reason: 'Your account has been disabled by your mentor.' };
  }

  const credits: UserCredits = user.credits || { allocated: 0, used: 0, remaining: 0 };

  if (credits.remaining <= 0) {
    return {
      allowed: false,
      reason: `You have no remaining credits. Please request more from your mentor.`,
    };
  }

  return { allowed: true };
}

/**
 * Atomically deduct one credit from a user's balance.
 * Records the transaction in `credit_transactions` for audit.
 */
export async function deductCredit(
  db: Db,
  userId: string | ObjectId,
  type: 'interview' | 'exam'
): Promise<boolean> {
  const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

  // Atomic: only deduct if remaining > 0
  const result = await db.collection('users').updateOne(
    { _id: objectId, 'credits.remaining': { $gt: 0 } },
    {
      $inc: {
        'credits.used': 1,
        'credits.remaining': -1,
      },
    }
  );

  if (result.modifiedCount === 0) return false;

  // Audit log
  await db.collection('credit_transactions').insertOne({
    userId: objectId,
    type: 'deduction',
    amount: 1,
    reason: `${type}_session_started`,
    createdAt: new Date(),
  });

  return true;
}

// ── Portal Access ────────────────────────────────────────────────────────────

/**
 * Check if a user has access to a specific portal.
 * B2B users only see portals enabled by their mentor/institution.
 */
export function checkPortalAccess(
  user: any,
  portal: 'interview' | 'exam' | 'recommendation'
): PortalCheckResult {
  const enabledPortals: string[] = user.enabledPortals || [];

  if (enabledPortals.length === 0) {
    // No restrictions — all portals enabled (fallback for institution/mentor users)
    return { allowed: true };
  }

  if (!enabledPortals.includes(portal)) {
    return {
      allowed: false,
      reason: `The ${portal} portal is not enabled for your account. Contact your mentor for access.`,
    };
  }

  return { allowed: true };
}

// ── Credit Allocation ────────────────────────────────────────────────────────

/**
 * Transfer credits from one user to another (e.g., mentor → mentee).
 * - Decrements from `fromUser.credits.remaining`
 * - Increments to `toUser.credits.allocated` and `toUser.credits.remaining`
 * - Records a transaction for both parties
 */
export async function allocateCredits(
  db: Db,
  fromUserId: string | ObjectId,
  toUserId: string | ObjectId,
  amount: number
): Promise<{ success: boolean; reason?: string }> {
  const fromId = typeof fromUserId === 'string' ? new ObjectId(fromUserId) : fromUserId;
  const toId = typeof toUserId === 'string' ? new ObjectId(toUserId) : toUserId;

  if (amount <= 0) {
    return { success: false, reason: 'Amount must be greater than 0.' };
  }

  // Check sender has enough
  const sender = await db.collection('users').findOne({ _id: fromId });
  if (!sender) return { success: false, reason: 'Sender not found.' };

  const senderCredits: UserCredits = sender.credits || { allocated: 0, used: 0, remaining: 0 };
  if (senderCredits.remaining < amount) {
    return {
      success: false,
      reason: `Insufficient credits. You have ${senderCredits.remaining} remaining but tried to allocate ${amount}.`,
    };
  }

  // Deduct from sender
  await db.collection('users').updateOne(
    { _id: fromId },
    { $inc: { 'credits.remaining': -amount } }
  );

  // Add to receiver
  await db.collection('users').updateOne(
    { _id: toId },
    {
      $inc: {
        'credits.allocated': amount,
        'credits.remaining': amount,
      },
    }
  );

  // Audit logs
  const now = new Date();
  await db.collection('credit_transactions').insertMany([
    {
      userId: fromId,
      type: 'transfer_out',
      amount,
      targetUserId: toId,
      reason: 'credit_allocation',
      createdAt: now,
    },
    {
      userId: toId,
      type: 'transfer_in',
      amount,
      sourceUserId: fromId,
      reason: 'credit_allocation',
      createdAt: now,
    },
  ]);

  return { success: true };
}

/**
 * Bulk distribute equal credits to multiple mentees.
 */
export async function distributeCreditsEqually(
  db: Db,
  fromUserId: string | ObjectId,
  toUserIds: (string | ObjectId)[],
  totalAmount: number
): Promise<{ success: boolean; reason?: string; perUser?: number }> {
  if (toUserIds.length === 0) {
    return { success: false, reason: 'No target users specified.' };
  }

  const perUser = Math.floor(totalAmount / toUserIds.length);
  if (perUser <= 0) {
    return { success: false, reason: 'Amount too small to distribute equally.' };
  }

  const actualTotal = perUser * toUserIds.length;

  // Check sender
  const fromId = typeof fromUserId === 'string' ? new ObjectId(fromUserId) : fromUserId;
  const sender = await db.collection('users').findOne({ _id: fromId });
  if (!sender) return { success: false, reason: 'Sender not found.' };

  const senderCredits: UserCredits = sender.credits || { allocated: 0, used: 0, remaining: 0 };
  if (senderCredits.remaining < actualTotal) {
    return {
      success: false,
      reason: `Insufficient credits. Need ${actualTotal} but have ${senderCredits.remaining}.`,
    };
  }

  // Execute transfers
  for (const toUserId of toUserIds) {
    await allocateCredits(db, fromUserId, toUserId, perUser);
  }

  return { success: true, perUser };
}
