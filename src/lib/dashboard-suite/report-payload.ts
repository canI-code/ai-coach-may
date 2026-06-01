// Feature: candidate-dashboard-suite
// Report payload read-through mapping (pure)

import type { CategoryScore, ReportReadyResponse, Resource, TimelineEntry } from './types';
import type { CoachingReportDoc, TurnRecord } from '../interview/schemas';
import { buildPerTurnHistory, compileStrengthsImprovements } from './per-turn';

const CATEGORY_LABELS: Record<string, string> = {
  technicalAccuracy: 'Technical Accuracy',
  communication: 'Communication',
  voiceCi: 'Voice Confidence',
  bodyCi: 'Body Language',
};

export function mapReportToReadyResponse(
  reportDoc: CoachingReportDoc,
  turns: TurnRecord[]
): ReportReadyResponse['report'] {
  const categoryRows = buildCategoryRows(reportDoc.categoryScores);
  const resourcesStatus = reportDoc.resourcesError === true ? 'query_failed' : 'ok';
  const perTurnHistory = buildPerTurnHistory(turns || []);
  const { strengths, improvements } = compileStrengthsImprovements(turns || []);

  return {
    confidenceIndex: reportDoc.ciScore,
    categoryScores: categoryRows,
    weaknessTags: reportDoc.weaknessTags || [],
    resources: reportDoc.resources || [],
    resourcesStatus,
    narrative: reportDoc.narrative || '',
    behavioralTimeline: (reportDoc.behavioralTimeline || []).map((entry) => ({
      tSeconds: entry.tSeconds,
      event: entry.label,
    })),
    perTurnHistory,
    strengths,
    improvements,
  };
}

export function buildCategoryRows(categoryScores: Record<string, number>): CategoryScore[] {
  return [
    {
      label: CATEGORY_LABELS.technicalAccuracy,
      value: categoryScores.technicalAccuracy,
      maxValue: 100,
    },
    {
      label: CATEGORY_LABELS.communication,
      value: categoryScores.communication,
      maxValue: 100,
    },
    {
      label: CATEGORY_LABELS.voiceCi,
      value: categoryScores.voiceCi,
      maxValue: 100,
    },
    {
      label: CATEGORY_LABELS.bodyCi,
      value: categoryScores.bodyCi,
      maxValue: 100,
    },
  ];
}

