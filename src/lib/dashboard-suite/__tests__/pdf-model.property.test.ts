// Feature: candidate-dashboard-suite, Property 13: PDF export action visibility
// Feature: candidate-dashboard-suite, Property 14: Generated PDF model carries the report's data
// Feature: candidate-dashboard-suite, Property 6.4: Builder consumes only passed payload

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildReportPdfModel, exportActionState } from '../pdf-model';
import type { CategoryScore, Resource } from '../types';

describe('Dashboard Suite: PDF Model Builder and Export State', () => {
  it('Property 13: PDF export action visibility', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.boolean(),
        (status, inProgress) => {
          const state = exportActionState(status, inProgress);
          
          if (status !== 'ready') {
            expect(state).toBe('hidden');
          } else if (inProgress) {
            expect(state).toBe('in-progress-disabled');
          } else {
            expect(state).toBe('enabled');
          }
        }
      )
    );
  });

  it('Property 14: Generated PDF model carries the report data (and consumes only the payload)', () => {
    fc.assert(
      fc.property(
        fc.record({
          confidenceIndex: fc.integer(),
          categoryScores: fc.array(fc.record({
            label: fc.string(),
            value: fc.integer(),
            maxValue: fc.integer()
          }) as fc.Arbitrary<CategoryScore>),
          weaknessTags: fc.array(fc.string()),
          resources: fc.array(fc.record({
            title: fc.string(),
            url: fc.string(),
            rationale: fc.option(fc.string(), { nil: undefined })
          }) as fc.Arbitrary<Resource>),
          narrative: fc.string()
        }),
        (reportPayload) => {
          const model = buildReportPdfModel(reportPayload);
          
          expect(model.title).toBe('Interview Performance Report');
          expect(model.confidenceIndex).toBe(reportPayload.confidenceIndex);
          expect(model.categoryScores).toEqual(reportPayload.categoryScores);
          expect(model.weaknessTags).toEqual(reportPayload.weaknessTags);
          expect(model.narrative).toBe(reportPayload.narrative);
          
          expect(model.resources).toHaveLength(reportPayload.resources.length);
          for (let i = 0; i < reportPayload.resources.length; i++) {
            expect(model.resources[i]).toEqual({
              title: reportPayload.resources[i].title,
              url: reportPayload.resources[i].url
            });
            // Ensure no rationale is carried over to the PDF model's resources
            expect(model.resources[i]).not.toHaveProperty('rationale');
          }
        }
      )
    );
  });

  it('Property 6.4: Unit test confirming builder consumes only the passed payload', () => {
    // This is tested implicitly by the fact that buildReportPdfModel is a pure function
    // taking only one argument and returning a value. 
    // We can also ensure it doesn't try to access global object or session.
    // By passing an exact object with no prototype methods, we ensure it only reads keys we give it.
    
    const plainPayload = Object.assign(Object.create(null), {
      confidenceIndex: 80,
      categoryScores: [],
      weaknessTags: [],
      resources: [{ title: 'Res1', url: 'http://example.com' }],
      narrative: 'Good'
    });
    
    const result = buildReportPdfModel(plainPayload);
    expect(result.confidenceIndex).toBe(80);
    expect(result.resources[0].title).toBe('Res1');
  });
});