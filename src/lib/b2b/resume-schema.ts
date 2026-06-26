import { z } from 'zod';

export const ResumeAnalysisSchema = z.object({
  atsScore: z.number().min(0).max(100),
  formattingScore: z.number().min(0).max(100),
  skillsScore: z.number().min(0).max(100),
  experienceScore: z.number().min(0).max(100),
  hardSkills: z.array(z.string()),
  softSkills: z.array(z.string()),
  formattingFeedback: z.array(z.string()),
  googleXyzSuggestions: z.array(z.object({
    original: z.string(),
    improved: z.string(),
    reason: z.string()
  })),
  jobDescriptionMatch: z.object({
    roleName: z.string(),
    matchPercentage: z.number().min(0).max(100),
    missingSkills: z.array(z.string()),
    recommendations: z.array(z.string())
  })
});

export type ResumeAnalysis = z.infer<typeof ResumeAnalysisSchema>;
