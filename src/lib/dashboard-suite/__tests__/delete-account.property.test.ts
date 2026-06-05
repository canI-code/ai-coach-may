import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import type { NextRequest } from 'next/server';

// Mock auth
const authState = vi.hoisted(() => ({ user: null as any }));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => authState.user
}));

// Mock next/headers cookies
const cookieState = vi.hoisted(() => ({ deleted: [] as string[] }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    delete: (name: string) => {
      cookieState.deleted.push(name);
    },
    set: vi.fn(),
  })
}));

// Mock MongoDB client
const dbState = vi.hoisted(() => ({
  users: [] as any[],
  otps: [] as any[],
  user_profiles: [] as any[],
}));

const mockDb = {
  collection: (name: string) => {
    return {
      findOne: async (query: any) => {
        if (name === 'users') {
          return dbState.users.find(u => {
            if (query.phone) return u.phone === query.phone;
            if (query._id) return u._id.toString() === query._id.toString();
            return false;
          });
        }
        if (name === 'otps') {
          return dbState.otps.find(o => o.identifier === query.identifier);
        }
        if (name === 'user_profile') {
          return dbState.user_profiles.find(p => p.userId.toString() === query.userId.toString());
        }
        return null;
      },
      insertOne: async (doc: any) => {
        if (name === 'users') dbState.users.push(doc);
        if (name === 'otps') dbState.otps.push(doc);
      },
      updateOne: async (query: any, update: any) => {
        const list = name === 'users' ? dbState.users : name === 'otps' ? dbState.otps : dbState.user_profiles;
        const index = list.findIndex(item => {
          if (query._id) return item._id.toString() === query._id.toString();
          if (query.identifier) return item.identifier === query.identifier;
          return false;
        });
        if (index !== -1) {
          if (update.$set) {
            Object.assign(list[index], update.$set);
          }
          if (update.$unset) {
            for (const key of Object.keys(update.$unset)) {
              delete list[index][key];
            }
          }
        }
      },
      deleteOne: async (query: any) => {
        if (name === 'otps') {
          dbState.otps = dbState.otps.filter(o => o.identifier !== query.identifier);
        }
      },
      deleteMany: async (query: any) => {
        if (name === 'otps') {
          if (query.identifier && query.identifier.$in) {
            dbState.otps = dbState.otps.filter(o => !query.identifier.$in.includes(o.identifier));
          }
        }
      },
    };
  }
};

vi.mock('@/lib/mongodb', () => ({
  default: Promise.resolve({
    db: () => mockDb,
  })
}));

import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as deletePOST } from '@/app/api/students/profile/delete/route';

const jsonReq = (body: unknown) => ({
  json: async () => body,
  headers: {
    get: () => 'Test Agent'
  }
}) as unknown as NextRequest;

describe('account deletion and recovery flow', () => {
  beforeEach(() => {
    authState.user = null;
    cookieState.deleted = [];
    dbState.users = [];
    dbState.otps = [];
    dbState.user_profiles = [];
  });

  it('verifies that B2C login automatically recovers a deleted account if within 30 days', async () => {
    const userId = new ObjectId();
    const phone = '+919999999999';
    const email = 'student@example.com';

    // Insert user scheduled for deletion (deleted 5 days ago)
    const deletionDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    dbState.users.push({
      _id: userId,
      phone,
      email,
      role: 'student',
      accountType: 'B2C Standard',
      deletionScheduled: true,
      deletionScheduledAt: deletionDate,
      sessions: [{ id: 'session_old', createdAt: new Date() }]
    });

    // Create a verified login OTP in database mock
    dbState.otps.push({
      identifier: phone,
      otp: '1234',
      expiresAt: new Date(Date.now() + 5 * 60000),
      verified: true,
      verifiedAt: new Date()
    });

    // Request login
    const req = jsonReq({
      phone,
      role: 'student'
    });

    const res = await loginPOST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.recovered).toBe(true);

    // Verify user doc has deletionScheduled unset
    expect(dbState.users[0].deletionScheduled).toBeUndefined();
    expect(dbState.users[0].deletionScheduledAt).toBeUndefined();
  });

  it('verifies that login rejects a deleted account if deletion request is older than 30 days', async () => {
    const userId = new ObjectId();
    const phone = '+918888888888';
    const email = 'deleted@example.com';

    // Insert user scheduled for deletion (deleted 35 days ago)
    const deletionDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    dbState.users.push({
      _id: userId,
      phone,
      email,
      role: 'student',
      accountType: 'B2C Standard',
      deletionScheduled: true,
      deletionScheduledAt: deletionDate,
      sessions: []
    });

    // Request login
    const req = jsonReq({
      phone,
      role: 'student'
    });

    const res = await loginPOST(req);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('User not found');
  });

  it('verifies that profile delete schedules the account for deletion and invalidates sessions', async () => {
    const userId = new ObjectId();
    const phone = '+917777777777';
    const email = 'delete-me@example.com';

    authState.user = {
      _id: userId,
      phone,
      email,
      role: 'student',
      accountType: 'B2C Standard',
      sessions: [{ id: 'active_session', createdAt: new Date() }]
    };

    dbState.users.push(authState.user);
    dbState.user_profiles.push({
      userId,
      email,
    });

    // Seed phone and email OTPs
    dbState.otps.push({
      identifier: phone,
      otp: '1111',
      expiresAt: new Date(Date.now() + 5 * 60000)
    });
    dbState.otps.push({
      identifier: email,
      otp: '2222',
      expiresAt: new Date(Date.now() + 5 * 60000)
    });

    const req = jsonReq({
      phoneOtp: '1111',
      emailOtp: '2222'
    });

    const res = await deletePOST(req);
    expect(res.status).toBe(200);

    // Verify deletion scheduled fields in user doc
    expect(dbState.users[0].deletionScheduled).toBe(true);
    expect(dbState.users[0].deletionScheduledAt).toBeInstanceOf(Date);
    // Verify sessions are invalidated
    expect(dbState.users[0].sessions).toHaveLength(0);
    // Verify auth cookie deleted
    expect(cookieState.deleted).toContain('auth_token');
    // Verify OTP tokens deleted
    expect(dbState.otps).toHaveLength(0);
  });
});
