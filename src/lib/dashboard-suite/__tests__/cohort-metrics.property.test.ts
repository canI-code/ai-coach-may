// Feature: candidate-dashboard-suite, Property 26: Cohort metrics are in scope and consistent
// Feature: candidate-dashboard-suite, Property 27: CSV export stays in scope

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeCohortMetrics, toCohortCsv } from '../cohort-metrics';

describe('Dashboard Suite: Cohort Metrics', () => {
  it('Property 26: Cohort metrics are in scope and consistent', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userId: fc.string(),
            institutionCode: fc.option(fc.string(), { nil: undefined }),
            ciScore: fc.integer({ min: 0, max: 100 }),
            weaknessTags: fc.array(fc.string())
          })
        ),
        fc.string(),
        (reports, institutionCode) => {
          const metrics = computeCohortMetrics(reports, institutionCode);
          
          expect(metrics.institutionCode).toBe(institutionCode);
          
          const inScopeReports = reports.filter(r => r.institutionCode === institutionCode);
          const uniqueUsers = new Set(inScopeReports.map(r => r.userId));
          
          expect(metrics.candidateCount).toBe(uniqueUsers.size);
          
          if (inScopeReports.length === 0) {
            expect(metrics.averageCi).toBeNull();
            expect(metrics.skillClusterFrequency).toHaveLength(0);
          } else {
            expect(metrics.averageCi).not.toBeNull();
            expect(metrics.averageCi).toBeGreaterThanOrEqual(0);
            expect(metrics.averageCi).toBeLessThanOrEqual(100);
            
            // Check sorting of skill clusters
            for (let i = 1; i < metrics.skillClusterFrequency.length; i++) {
              const prev = metrics.skillClusterFrequency[i - 1];
              const curr = metrics.skillClusterFrequency[i];
              expect(prev.count).toBeGreaterThanOrEqual(curr.count);
              if (prev.count === curr.count) {
                expect(prev.tag.localeCompare(curr.tag)).toBeLessThanOrEqual(0);
              }
            }
          }
        }
      )
    );
  });

  it('Property 27: CSV export stays in scope', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            institutionCode: fc.option(fc.string(), { nil: undefined }),
            name: fc.string(),
            score: fc.integer()
          })
        ),
        fc.string(),
        (rows, institutionCode) => {
          const metrics = { institutionCode, candidateCount: 0, averageCi: null, skillClusterFrequency: [] };
          const csv = toCohortCsv(metrics, rows);
          
          const inScopeRows = rows.filter(r => r.institutionCode === institutionCode);
          
          if (inScopeRows.length === 0) {
            expect(csv).toBe('');
          } else {
            const lines = csv.split('\n');
            expect(lines.length).toBe(inScopeRows.length + 1); // +1 for header
            
            // Header should not contain institutionCode
            expect(lines[0]).not.toContain('institutionCode');
            
            // In scope data count matches
            expect(lines.slice(1)).toHaveLength(inScopeRows.length);
          }
        }
      )
    );
  });
});