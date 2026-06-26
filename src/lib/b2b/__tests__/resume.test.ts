import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { POST, GET } from '@/app/api/students/resume/analyze/route';
import { ResumeAnalysisSchema } from '@/lib/b2b/resume-schema';

// Setup hoisting mock states
const authState = vi.hoisted(() => ({ user: null as any }));
const dbState = vi.hoisted(() => ({
  inserted: [] as any[],
  findResult: [] as any[],
}));

// Mock modules
vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => authState.user,
}));

vi.mock('@/lib/db-selector', () => ({
  getDbForUser: async (userId: any) => ({
    db: {
      collection: (name: string) => {
        if (name === 'user_resumes') {
          return {
            insertOne: async (doc: any) => {
              dbState.inserted.push(doc);
              return { insertedId: new ObjectId() };
            },
            find: (query: any) => ({
              sort: () => ({
                toArray: async () => dbState.findResult,
              }),
            }),
          };
        }
        return null;
      },
    },
  }),
}));

vi.mock('@/lib/interview/llm-gateway', () => ({
  getLLMGateway: () => ({
    complete: async (req: any) => {
      return {
        ok: true,
        text: JSON.stringify({
          atsScore: 88,
          formattingScore: 92,
          skillsScore: 85,
          experienceScore: 78,
          hardSkills: ['Next.js', 'TypeScript'],
          softSkills: ['Communication'],
          formattingFeedback: ['Clean font size'],
          googleXyzSuggestions: [
            {
              original: 'Helped build a landing page.',
              improved: 'Designed and deployed 3 high-traffic landing pages reducing bounce rate by 15%.',
              reason: 'Clear metrics',
            },
          ],
          jobDescriptionMatch: {
            roleName: 'Frontend Developer',
            matchPercentage: 90,
            missingSkills: ['Tailwind'],
            recommendations: ['Learn Tailwind'],
          },
        }),
      };
    },
  }),
}));

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

describe('AI Resume Analyzer API & DB Schema', () => {
  beforeEach(() => {
    authState.user = null;
    dbState.inserted = [];
    dbState.findResult = [];
  });

  it('rejects unauthenticated requests with 401 status', async () => {
    const res = await POST(jsonReq({ resumeText: 'Hello', targetRole: 'Engineer' }));
    expect(res.status).toBe(401);

    const getRes = await GET();
    expect(getRes.status).toBe(401);
  });

  it('returns 400 if resumeText or targetRole is missing', async () => {
    authState.user = { _id: new ObjectId() };
    
    const res1 = await POST(jsonReq({ targetRole: 'Engineer' }));
    expect(res1.status).toBe(400);

    const res2 = await POST(jsonReq({ resumeText: 'My resume' }));
    expect(res2.status).toBe(400);
  });

  it('successfully analyzes a resume and saves it in tenant database', async () => {
    const userId = new ObjectId();
    authState.user = { _id: userId };

    const payload = {
      resumeText: 'Experienced developer in React and TypeScript.',
      targetRole: 'Senior Frontend Engineer',
      fileName: 'resume.txt',
    };

    const res = await POST(jsonReq(payload));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.analysisId).toBeDefined();

    // Verify zod parsing validation
    const parsed = ResumeAnalysisSchema.safeParse(body.analysis);
    expect(parsed.success).toBe(true);

    // Verify stored document in tenant isolated database collection 'user_resumes'
    expect(dbState.inserted).toHaveLength(1);
    const savedDoc = dbState.inserted[0];
    expect(savedDoc.userId.toString()).toBe(userId.toString());
    expect(savedDoc.resumeText).toBe(payload.resumeText);
    expect(savedDoc.targetRole).toBe(payload.targetRole);
    expect(savedDoc.fileName).toBe(payload.fileName);
    expect(savedDoc.atsScore).toBe(88);
    expect(savedDoc.jobDescriptionMatch.roleName).toBe('Frontend Developer');
  });

  it('successfully fetches user resume analyses history via GET', async () => {
    authState.user = { _id: new ObjectId() };
    dbState.findResult = [
      {
        _id: new ObjectId(),
        targetRole: 'Frontend Developer',
        atsScore: 88,
        createdAt: new Date(),
      },
    ];

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.resumes).toHaveLength(1);
    expect(body.resumes[0].targetRole).toBe('Frontend Developer');
  });
});
