import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDbForUser } from '@/lib/db-selector';
import { getLLMGateway } from '@/lib/interview/llm-gateway';
import { ResumeAnalysisSchema } from '@/lib/b2b/resume-schema';



// Polyfill for pdf-parse which requires DOMMatrix in Node
if (typeof global !== 'undefined') {
  if (!(global as any).DOMMatrix) (global as any).DOMMatrix = class DOMMatrix {};
  if (!(global as any).ImageData) (global as any).ImageData = class ImageData {};
  if (!(global as any).Path2D) (global as any).Path2D = class Path2D {};
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let resumeText = '';
    let targetRole = '';
    let fileName = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      targetRole = (formData.get('targetRole') as string) || '';
      resumeText = (formData.get('resumeText') as string) || '';
      
      if (file) {
        fileName = file.name;
        if (fileName.toLowerCase().endsWith('.pdf')) {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          try {
            const pdfParse = require('pdf-parse/lib/pdf-parse.js');
            const data = await pdfParse(buffer);
            resumeText = data.text;
          } catch (err) {
            console.error('PDF parsing error:', err);
            return NextResponse.json({ error: 'Failed to parse PDF resume. Please ensure it is a valid text-based PDF.' }, { status: 400 });
          }
        } else {
          resumeText = await file.text();
        }
      }
    } else {
      const body = await req.json();
      resumeText = body.resumeText || '';
      targetRole = body.targetRole || '';
      fileName = body.fileName || '';
    }

    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }
    if (!targetRole) {
      return NextResponse.json({ error: 'Target role is required' }, { status: 400 });
    }

    // Call LLM
    const systemPrompt = `You are an expert AI Resume Analyzer.
Your task is to analyze the candidate's resume text against their target role and provide feedback.
You must return your response as a valid JSON object matching this schema:
{
  "atsScore": number (0-100),
  "formattingScore": number (0-100),
  "skillsScore": number (0-100),
  "experienceScore": number (0-100),
  "hardSkills": string[],
  "softSkills": string[],
  "formattingFeedback": string[],
  "googleXyzSuggestions": [
    {
      "original": string,
      "improved": string,
      "reason": string
    }
  ],
  "jobDescriptionMatch": {
    "roleName": string,
    "matchPercentage": number (0-100),
    "missingSkills": string[],
    "recommendations": string[]
  }
}
Do not include any other text, markdown wrapper (like \`\`\`json), or explanations. Return ONLY the raw JSON string.`;

    const prompt = `Resume Text:\n${resumeText}\n\nTarget Role:\n${targetRole}`;

    const gateway = getLLMGateway();
    const res = await gateway.complete({
      prompt,
      system: systemPrompt,
      temperature: 0.2
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'LLM completion failed', details: res.error.message }, { status: 502 });
    }

    let responseText = res.text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }

    let analysisData;
    try {
      analysisData = JSON.parse(responseText);
    } catch (e: any) {
      console.error('Failed to parse JSON from LLM response:', responseText);
      return NextResponse.json({ error: 'Failed to parse analysis JSON', details: e.message }, { status: 502 });
    }

    // Validate using Zod schema
    const validation = ResumeAnalysisSchema.safeParse(analysisData);
    if (!validation.success) {
      console.error('Validation failed for analysis data:', validation.error.format());
      return NextResponse.json({ error: 'Invalid analysis format', details: validation.error.issues }, { status: 502 });
    }

    const { db } = await getDbForUser(user._id);

    const documentToSave = {
      userId: user._id,
      resumeText,
      targetRole,
      fileName: fileName || null,
      ...validation.data,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertResult = await db.collection('user_resumes').insertOne(documentToSave);

    return NextResponse.json({
      success: true,
      analysisId: insertResult.insertedId.toString(),
      analysis: validation.data
    });
  } catch (error: any) {
    console.error('Resume Analysis API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

// Add GET endpoint to fetch the list of analysed resumes for the user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await getDbForUser(user._id);
    const resumes = await db.collection('user_resumes')
      .find({ userId: user._id })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      resumes
    });
  } catch (error: any) {
    console.error('Get Resume Analyses Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
