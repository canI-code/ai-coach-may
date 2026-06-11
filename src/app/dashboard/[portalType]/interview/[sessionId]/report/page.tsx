'use client';

/**
 * Interview report page — mounts the {@link ReportView}, which polls
 * `GET /api/interview/[sessionId]/report` until the background Report_Orchestrator
 * marks the Confidence Index report `ready`, then renders it (Req 16.7, 20.2, 20.3).
 *
 * Next.js 16: this is a Client Component (ReportView owns polling state/effects); the
 * dynamic `sessionId` route param is a Promise and is unwrapped with React's `use()`.
 */

import React, { use } from 'react';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { ReportView } from '../../components/ReportView';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function InterviewReportPage({ params }: PageProps) {
  const { sessionId } = use(params);

  return (
    <main className="min-h-screen bg-transparent text-white p-4 md:p-8 relative">
      <AmbientGlow color="teal" size="lg" position="center" className="opacity-15" />

      <div className="max-w-4xl mx-auto relative z-10">
        <ReportView sessionId={sessionId} />
      </div>
    </main>
  );
}
