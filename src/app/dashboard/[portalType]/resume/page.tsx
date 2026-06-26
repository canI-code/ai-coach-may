'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ScrollText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  FileText,
  Loader2,
  Trash2,
  Check,
  ChevronRight,
  Info
} from 'lucide-react';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';

interface ResumeAnalysis {
  atsScore: number;
  formattingScore: number;
  skillsScore: number;
  experienceScore: number;
  hardSkills: string[];
  softSkills: string[];
  formattingFeedback: string[];
  googleXyzSuggestions: Array<{
    original: string;
    improved: string;
    reason: string;
  }>;
  jobDescriptionMatch: {
    roleName: string;
    matchPercentage: number;
    missingSkills: string[];
    recommendations: string[];
  };
}

export default function ResumeAnalyzerPage() {
  const router = useRouter();
  const params = useParams();
  const portalType = (params?.portalType as string) || 'b2c';

  // Input states
  const [resumeText, setResumeText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // App flow states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<ResumeAnalysis | null>(null);
  const [error, setError] = useState('');

  // History/Past analyses
  const [pastAnalyses, setPastAnalyses] = useState<any[]>([]);
  const [isLoadingPast, setIsLoadingPast] = useState(false);

  const steps = [
    { label: 'Extracting resume text...', duration: 1200 },
    { label: 'Auditing formatting & layout...', duration: 1500 },
    { label: 'Checking ATS compliance...', duration: 1800 },
    { label: 'Comparing skills to target role...', duration: 1500 },
  ];

  // Fetch past analyses on load
  const fetchPastAnalyses = async () => {
    try {
      setIsLoadingPast(true);
      const res = await fetch('/api/students/resume/analyze');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPastAnalyses(data.resumes || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch past analyses:', err);
    } finally {
      setIsLoadingPast(false);
    }
  };

  useEffect(() => {
    fetchPastAnalyses();
  }, []);

  // Handle step increments during analysis
  useEffect(() => {
    if (!isAnalyzing) return;

    let currentStep = 0;
    const runSteps = () => {
      if (currentStep < steps.length - 1) {
        const timer = setTimeout(() => {
          currentStep += 1;
          setActiveStep(currentStep);
          runSteps();
        }, steps[currentStep].duration);
        return () => clearTimeout(timer);
      }
    };
    runSteps();
  }, [isAnalyzing]);

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFile = async (selectedFile: File) => {
    setFileName(selectedFile.name);
    setFile(selectedFile);
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      try {
        const text = await selectedFile.text();
        setResumeText(text);
      } catch (err) {
        console.error('Error reading file:', err);
        setError('Could not read text from selected file. Try copying and pasting your text.');
      }
    } else {
      setResumeText('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const selectedFile = e.dataTransfer.files[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const clearInputs = () => {
    setResumeText('');
    setFileName('');
    setFile(null);
    setError('');
  };

  // Submit analysis
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeText.trim() && !file) {
      setError('Please provide resume text or upload a resume file.');
      return;
    }
    if (!targetRole.trim()) {
      setError('Please specify a target role.');
      return;
    }

    setError('');
    setIsAnalyzing(true);
    setActiveStep(0);

    try {
      const formData = new FormData();
      formData.append('targetRole', targetRole);
      if (fileName) formData.append('fileName', fileName);
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('resumeText', resumeText);
      }

      const res = await fetch('/api/students/resume/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Analysis failed');
      }

      setAnalysisResult(data.analysis);
      fetchPastAnalyses(); // Refresh history
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Circular gauge score helper
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8 relative">
      <AmbientGlow color="amber" size="lg" />

      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-md">
              <ScrollText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Resume Analyzer & Builder</h1>
              <p className="text-[#a1a1aa] text-xs mt-0.5">
                Optimize your resume for ATS screening, skills match, and Google XYZ formatting formula.
              </p>
            </div>
          </div>
          {analysisResult && (
            <Button
              onClick={() => {
                setAnalysisResult(null);
                clearInputs();
              }}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Analyze Another
            </Button>
          )}
        </div>

        {/* Input Interface */}
        {!isAnalyzing && !analysisResult && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left/Middle: File Upload or Paste Form */}
            <div className="lg:col-span-2 space-y-6">
              <GlassCard className="border-white/5 text-left" padding="lg">
                <CardTitle className="text-lg mb-2 flex items-center gap-2">
                  <Upload size={18} className="text-amber-400" />
                  Upload or Paste Resume
                </CardTitle>
                <CardDescription className="mb-4">
                  Drag and drop your resume file or paste the plain text directly below.
                </CardDescription>

                <div className="space-y-4">
                  
                  {/* File Upload Dropzone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center text-center cursor-pointer group ${
                      isDragOver
                        ? 'border-amber-400 bg-amber-500/5'
                        : 'border-white/10 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.02]'
                    }`}
                    onClick={() => document.getElementById('resume-file-input')?.click()}
                  >
                    <input
                      id="resume-file-input"
                      type="file"
                      className="hidden"
                      accept=".txt,.doc,.docx,.pdf"
                      onChange={handleFileChange}
                    />
                    
                    {fileName ? (
                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl">
                        <FileText className="text-amber-400" size={20} />
                        <span className="text-sm font-semibold max-w-[200px] truncate">{fileName}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearInputs();
                          }}
                          className="text-[#a1a1aa] hover:text-red-400 p-1"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 group-hover:text-amber-400 transition-colors mb-3">
                          <Upload size={22} />
                        </div>
                        <p className="text-xs font-semibold text-white mb-1">
                          Drag & drop file here or <span className="text-amber-400">browse</span>
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Supports PDF, DOCX, TXT (TXT reads instantly)
                        </p>
                      </>
                    )}
                  </div>

                  {/* Textarea for Manual Paste */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Or Paste Resume Plain Text
                    </label>
                    <textarea
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Paste resume content (Work Experience, Skills, Education)..."
                      className="w-full h-72 bg-[#0a0a0b]/60 border border-white/10 rounded-2xl p-4 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/40 transition-colors resize-none leading-relaxed"
                    />
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Right Side: Configuration Options */}
            <div className="space-y-6">
              <GlassCard className="border-white/5 text-left" padding="lg">
                <CardTitle className="text-lg mb-2 flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-400" />
                  Target Details
                </CardTitle>
                <CardDescription className="mb-6">
                  Input target role details to check keywords compatibility.
                </CardDescription>

                <form onSubmit={handleAnalyze} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Target Role / Job Title
                    </label>
                    <input
                      type="text"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      placeholder="e.g. Frontend Engineer, Product Manager"
                      className="w-full bg-[#0a0a0b]/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-gray-200 focus:outline-none focus:border-amber-500/40 transition-colors"
                      required
                    />
                  </div>

                  {error && (
                    <div className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-left">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full justify-center gap-2">
                    Start Analysis
                    <ArrowRight size={14} />
                  </Button>
                </form>
              </GlassCard>

              {/* History List */}
              <GlassCard className="border-white/5 text-left" padding="md">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Past Analyses
                </CardTitle>
                {isLoadingPast ? (
                  <div className="flex items-center gap-2 py-4 justify-center text-xs text-gray-400">
                    <Loader2 size={14} className="animate-spin" />
                    Loading history...
                  </div>
                ) : pastAnalyses.length === 0 ? (
                  <div className="text-xs text-gray-500 py-6 text-center">
                    No past analyses found.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {pastAnalyses.map((item) => (
                      <button
                        key={item._id}
                        onClick={() => setAnalysisResult(item)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all text-left"
                      >
                        <div className="truncate pr-2">
                          <div className="text-xs font-semibold text-white truncate">
                            {item.jobDescriptionMatch?.roleName || item.targetRole}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-amber-400 shrink-0">
                          {item.atsScore}%
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        )}

        {/* Progress View */}
        {isAnalyzing && (
          <div className="max-w-md mx-auto py-12">
            <GlassCard className="border-white/5 text-center" padding="lg">
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto mb-5" />
              <h2 className="text-lg font-bold text-white mb-2">Analyzing Resume...</h2>
              <p className="text-xs text-[#a1a1aa] mb-6">
                Our AI model is auditing the format and matching key skills.
              </p>

              {/* Steps Progress bar list */}
              <div className="space-y-3.5 text-left mb-6">
                {steps.map((step, idx) => {
                  const isDone = idx < activeStep;
                  const isActive = idx === activeStep;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                        isActive
                          ? 'border-amber-500/30 bg-amber-500/5 text-amber-300 font-semibold'
                          : isDone
                          ? 'border-emerald-500/20 bg-emerald-500/[0.02] text-emerald-400'
                          : 'border-transparent text-gray-500'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : isActive ? (
                        <Loader2 size={16} className="text-amber-400 animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-white/10 shrink-0" />
                      )}
                      <span className="text-xs">{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Simulated Progress bar */}
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-500 ease-out"
                  style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </GlassCard>
          </div>
        )}

        {/* Results Screen */}
        {analysisResult && (
          <div className="space-y-6 text-left">
            
            {/* Top Scorecard Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* ATS circular gauge */}
              <GlassCard className="border-white/5 flex flex-col items-center justify-center p-6 text-center">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">
                  Overall ATS Compatibility
                </CardTitle>
                
                <div className="relative flex items-center justify-center w-36 h-36">
                  {/* Circular SVG */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="72"
                      cy="72"
                      r={radius}
                      className="stroke-white/5"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="72"
                      cy="72"
                      r={radius}
                      className="stroke-amber-400 transition-all duration-1000 ease-out"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (analysisResult.atsScore / 100) * circumference}
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  {/* Inside Center text */}
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-extrabold text-white">{analysisResult.atsScore}%</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">ATS Score</span>
                  </div>
                </div>

                <div className="mt-4 text-[10px] font-semibold text-[#a1a1aa] bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  {analysisResult.atsScore >= 80 ? 'Highly Compatible' : analysisResult.atsScore >= 60 ? 'Needs Refinement' : 'Critical Gaps Found'}
                </div>
              </GlassCard>

              {/* Sub-scores Progress Bars */}
              <GlassCard className="border-white/5 md:col-span-2 flex flex-col justify-between" padding="lg">
                <div>
                  <CardTitle className="text-base font-semibold text-white mb-1">
                    Analysis Sub-components
                  </CardTitle>
                  <CardDescription className="mb-6">
                    A checklist of compliance metrics auditing formatting, experience structure, and skills.
                  </CardDescription>
                </div>

                <div className="space-y-4">
                  
                  {/* Formatting */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 font-medium">Layout & Formatting</span>
                      <span className="text-amber-400 font-bold">{analysisResult.formattingScore}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/[0.02]">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${analysisResult.formattingScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Skills Score */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 font-medium">Skills Coverage</span>
                      <span className="text-amber-400 font-bold">{analysisResult.skillsScore}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/[0.02]">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${analysisResult.skillsScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Experience Score */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 font-medium">Experience & Impact Statements</span>
                      <span className="text-amber-400 font-bold">{analysisResult.experienceScore}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/[0.02]">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${analysisResult.experienceScore}%` }}
                      />
                    </div>
                  </div>

                </div>
              </GlassCard>

            </div>

            {/* Google XYZ suggestions table */}
            <GlassCard className="border-white/5" padding="lg">
              <CardTitle className="text-lg mb-1 flex items-center gap-2">
                <Sparkles size={18} className="text-amber-400" />
                Google XYZ Formula Suggestions
              </CardTitle>
              <CardDescription className="mb-5">
                Convert passive statements to action-oriented bullet points: <span className="font-semibold text-gray-200">Accomplished [X] as measured by [Y], by doing [Z]</span>.
              </CardDescription>

              <div className="overflow-x-auto border border-white/5 rounded-2xl bg-white/[0.01]">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-gray-400 font-bold uppercase tracking-wider">
                      <th className="px-4 py-3.5 text-left w-1/3">Original statement</th>
                      <th className="px-4 py-3.5 text-left w-1/3">Improved (Google XYZ formula)</th>
                      <th className="px-4 py-3.5 text-left w-1/3">Actionable Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisResult.googleXyzSuggestions.map((item, idx) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors leading-relaxed">
                        <td className="px-4 py-3.5 text-red-300 font-medium align-top">
                          {item.original}
                        </td>
                        <td className="px-4 py-3.5 text-emerald-400 font-semibold align-top">
                          {item.improved}
                        </td>
                        <td className="px-4 py-3.5 text-gray-300 align-top">
                          {item.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            {/* Split Skills list & Job match recommendation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Skills checklist */}
              <GlassCard className="border-white/5" padding="lg">
                <CardTitle className="text-base font-semibold text-white mb-4">
                  Identified Core Skills
                </CardTitle>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Hard Technical Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.hardSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Soft / Cognitive Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.softSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Job match panel */}
              <GlassCard className="border-white/5 flex flex-col justify-between" padding="lg">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <CardTitle className="text-base font-semibold text-white">
                      Job Match Assessment
                    </CardTitle>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                      {analysisResult.jobDescriptionMatch.roleName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/5 mb-5">
                    <div className="text-xl font-extrabold text-amber-400">
                      {analysisResult.jobDescriptionMatch.matchPercentage}%
                    </div>
                    <div className="text-[10px] text-[#a1a1aa] leading-snug">
                      Match compatibility with standard expectations of <span className="font-semibold text-white">{analysisResult.jobDescriptionMatch.roleName}</span> role.
                    </div>
                  </div>

                  {/* Missing skills list */}
                  <div className="space-y-4">
                    {analysisResult.jobDescriptionMatch.missingSkills.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Missing Skills Gap</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.jobDescriptionMatch.missingSkills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {analysisResult.jobDescriptionMatch.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Recommended Actions</h4>
                        <ul className="space-y-1.5">
                          {analysisResult.jobDescriptionMatch.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-xs text-gray-300 flex items-start gap-1.5 leading-relaxed">
                              <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>

            </div>

            {/* Layout audit feedback */}
            <GlassCard className="border-white/5" padding="lg">
              <CardTitle className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Info size={16} className="text-amber-400" />
                Formatting Feedback & Structure Audit
              </CardTitle>
              <ul className="space-y-2.5">
                {analysisResult.formattingFeedback.map((feedback, idx) => (
                  <li key={idx} className="text-xs text-gray-300 flex items-start gap-2.5 leading-relaxed">
                    <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <span>{feedback}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>

          </div>
        )}

      </div>
    </div>
  );
}
