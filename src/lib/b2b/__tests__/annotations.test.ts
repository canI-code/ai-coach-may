import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { GET as getSessionRoute } from '@/app/api/b2b/mentor/sessions/[sessionId]/route';
import { POST as saveAnnotationsRoute } from '@/app/api/b2b/mentor/sessions/[sessionId]/annotations/route';
import { GET as getStudentReportRoute } from '@/app/api/interview/[sessionId]/report/route';

// Test variables
const studentId = new ObjectId();
const mentorId = new ObjectId();
const batchId = new ObjectId();
const sessionId = new ObjectId();
const reportId = new ObjectId();

let activeUser: any = null;
let mockSession: any = null;
let mockStudent: any = null;
let mockMentor: any = null;
let mockReport: any = null;
let mockAnnotations: any = null;
let mockBatches: any[] = [];

// Mock DB structure
const mockDb = {
  collection: (name: string) => {
    return {
      findOne: async (query: any) => {
        if (name === 'interview_sessions') {
          return mockSession;
        }
        if (name === 'users') {
          if (query._id && query._id.toString() === studentId.toString()) {
            return mockStudent;
          }
          return mockMentor;
        }
        if (name === 'coaching_reports') {
          return mockReport;
        }
        if (name === 'mentor_annotations') {
          return mockAnnotations;
        }
        return null;
      },
      find: (query: any) => ({
        toArray: async () => {
          if (name === 'batches') {
            return mockBatches;
          }
          return [];
        }
      }),
      updateOne: async (query: any, update: any, options: any) => {
        if (name === 'mentor_annotations') {
          mockAnnotations = {
            ...mockAnnotations,
            ...update.$set,
          };
          return { modifiedCount: 1, upsertedCount: 1 };
        }
        return { modifiedCount: 0 };
      }
    };
  }
};

// Mock modules
vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => activeUser,
}));

vi.mock('@/lib/b2b/registry', () => ({
  findInstituteByUserId: async (userId: string) => {
    if (userId === mentorId.toString() || userId === studentId.toString()) {
      return {
        institute: { _id: new ObjectId(), collegeName: 'Mock College' },
        role: userId === mentorId.toString() ? 'mentor' : 'mentee',
      };
    }
    return null;
  },
  getInstituteDb: async () => mockDb,
}));

vi.mock('@/lib/interview/session-store', () => ({
  getInterviewDb: async () => mockDb,
  findSession: async () => mockSession,
  findReport: async () => mockReport,
  getReportStatusCache: async () => ({ status: 'ready' }),
}));

// Helper to construct a request
const jsonReq = (body: unknown) => {
  return {
    headers: {
      get: (name: string) => {
        if (name === 'content-type') return 'application/json';
        return null;
      },
    },
    json: async () => body,
  } as unknown as Request;
};

describe('Mentor Mock Interview Playback & Annotations', () => {
  beforeEach(() => {
    activeUser = null;
    mockSession = {
      _id: sessionId,
      userId: studentId,
      reportId: reportId,
      startedAt: new Date(),
      updatedAt: new Date(),
      turns: [],
      config: { questionCount: 5, role: 'Software Engineer', aiPersona: 'Professional' }
    };
    mockStudent = {
      _id: studentId,
      role: 'mentee',
      batchId: batchId,
    };
    mockMentor = {
      _id: mentorId,
      role: 'mentor',
    };
    mockReport = {
      _id: reportId,
      sessionId: sessionId,
      userId: studentId,
      status: 'ready',
      ciScore: 82,
      categoryScores: { technicalAccuracy: 80, communication: 85, voiceCi: 75, bodyCi: 70 },
      weaknessTags: [],
      resources: [],
      behavioralTimeline: [],
    };
    mockAnnotations = null;
    mockBatches = [
      { _id: batchId, mentorId: mentorId }
    ];
  });

  it('rejects unauthorized or non-mentor users on session GET', async () => {
    activeUser = { _id: studentId, role: 'mentee' }; // Student tries to access mentor API
    const res = await getSessionRoute(
      new Request('http://localhost'),
      { params: Promise.resolve({ sessionId: sessionId.toString() }) }
    );
    expect(res.status).toBe(401);
  });

  it('allows authenticated mentors to GET student session and annotations', async () => {
    activeUser = mockMentor;
    mockAnnotations = {
      sessionId: sessionId,
      mentorId: mentorId,
      annotations: [{ questionIndex: 1, tSeconds: 45, feedback: 'Strong STAR structure.' }],
      generalFeedback: 'Excellent performance.',
    };

    const res = await getSessionRoute(
      new Request('http://localhost'),
      { params: Promise.resolve({ sessionId: sessionId.toString() }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session).toBeDefined();
    expect(body.report).toBeDefined();
    expect(body.annotations).not.toBeNull();
    expect(body.annotations.generalFeedback).toBe('Excellent performance.');
  });

  it('enforces batch boundary: denies mentor if student is not in their batch', async () => {
    activeUser = mockMentor;
    // Set student to belong to a different batch that the mentor does not own
    const anotherBatchId = new ObjectId();
    mockStudent.batchId = anotherBatchId;

    const res = await getSessionRoute(
      new Request('http://localhost'),
      { params: Promise.resolve({ sessionId: sessionId.toString() }) }
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Forbidden');
  });

  it('allows mentor to save/upsert annotations via POST', async () => {
    activeUser = mockMentor;
    const payload = {
      annotations: [{ questionIndex: 0, tSeconds: 15, feedback: 'Good start!' }],
      generalFeedback: 'Keep practicing the coding part.',
    };

    const res = await saveAnnotationsRoute(
      jsonReq(payload),
      { params: Promise.resolve({ sessionId: sessionId.toString() }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify update occurred on the mock DB state
    expect(mockAnnotations).not.toBeNull();
    expect(mockAnnotations.generalFeedback).toBe('Keep practicing the coding part.');
    expect(mockAnnotations.annotations[0].feedback).toBe('Good start!');
  });

  it('integrates mentor annotations into the student report API payload', async () => {
    // Stage mentor annotations
    mockAnnotations = {
      sessionId: sessionId,
      mentorId: mentorId,
      annotations: [{ questionIndex: 2, tSeconds: 110, feedback: 'Excellent technical depth.' }],
      generalFeedback: 'A perfect mock run.',
    };

    // Authenticated as the student viewing their own report
    activeUser = mockStudent;

    const res = await getStudentReportRoute(
      {} as any,
      { params: Promise.resolve({ sessionId: sessionId.toString() }) } as any
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report).toBeDefined();
    expect(body.report.mentorAnnotations).toBeDefined();
    expect(body.report.mentorAnnotations.generalFeedback).toBe('A perfect mock run.');
    expect(body.report.mentorAnnotations.annotations[0].feedback).toBe('Excellent technical depth.');
  });
});
