// Feature: candidate-dashboard-suite
// PDF model builder and export-action state (pure)

import type { ReportPdfModel, ExportActionState, CategoryScore, Resource } from './types';

export function buildReportPdfModel(report: {
  confidenceIndex: number;
  categoryScores: CategoryScore[];
  weaknessTags: string[];
  resources: Resource[];
  narrative: string;
}): ReportPdfModel {
  return {
    title: 'Interview Performance Report',
    confidenceIndex: report.confidenceIndex,
    categoryScores: report.categoryScores,
    weaknessTags: report.weaknessTags,
    resources: report.resources.map((r) => ({ title: r.title, url: r.url })),
    narrative: report.narrative,
  };
}

export function exportActionState(status: string, inProgress: boolean): ExportActionState {
  if (status !== 'ready') {
    return 'hidden';
  }
  return inProgress ? 'in-progress-disabled' : 'enabled';
}
