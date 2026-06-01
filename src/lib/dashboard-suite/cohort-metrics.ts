// Feature: candidate-dashboard-suite
// Cohort aggregation and CSV formatting (pure)

import type { CohortMetrics, WeaknessTagCount } from './types';

export interface CohortReportInput {
  userId: string;
  institutionCode?: string;
  ciScore: number;
  weaknessTags: string[];
}

export function computeCohortMetrics(
  reports: CohortReportInput[],
  institutionCode: string
): CohortMetrics {
  const inScope = reports.filter(r => r.institutionCode === institutionCode);
  
  const uniqueCandidates = new Set<string>();
  let sumCi = 0;
  const tagCounts = new Map<string, number>();

  for (const r of inScope) {
    uniqueCandidates.add(r.userId);
    sumCi += r.ciScore;
    for (const tag of (r.weaknessTags || [])) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const averageCi = inScope.length > 0 ? Math.round(sumCi / inScope.length) : null;

  const skillClusterFrequency: WeaknessTagCount[] = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return {
    institutionCode,
    candidateCount: uniqueCandidates.size,
    averageCi,
    skillClusterFrequency
  };
}

export interface CsvRowInput {
  institutionCode?: string;
  [key: string]: any;
}

export function toCohortCsv(metrics: CohortMetrics, rows: CsvRowInput[]): string {
  const inScope = rows.filter(r => r.institutionCode === metrics.institutionCode);
  
  if (inScope.length === 0) return '';

  const headers = Object.keys(inScope[0]).filter(k => k !== 'institutionCode');
  
  const headerRow = headers.join(',');
  const dataRows = inScope.map(row => 
    headers.map(h => {
      const val = row[h] ?? '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}