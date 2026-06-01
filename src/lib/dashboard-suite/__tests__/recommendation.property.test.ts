// Feature: candidate-dashboard-suite, Property 15: Recommendation rendering preserves order and caps at five
// Feature: candidate-dashboard-suite, Property 16: Institution-first order is preserved
// Feature: candidate-dashboard-suite, Property 17: Resource links target their URL
// Feature: candidate-dashboard-suite, Property 18: Recommendation state precedence

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { selectRecommendationState, toResourceLinks } from '../recommendation';
import type { Resource } from '../types';
import { MAX_RECOMMENDATION_RESOURCES } from '../constants';

const resourceArb = fc.record({
  title: fc.string(),
  url: fc.string(),
  rationale: fc.option(fc.string(), { nil: undefined })
}) as fc.Arbitrary<Resource>;

describe('Dashboard Suite: Recommendation State Selection', () => {
  it('Property 18: Recommendation state precedence', () => {
    fc.assert(
      fc.property(
        fc.record({
          resourcesStatus: fc.constantFrom<'ok' | 'query_failed'>('ok', 'query_failed'),
          weaknessTags: fc.array(fc.string()),
          resources: fc.array(resourceArb)
        }),
        (report) => {
          const state = selectRecommendationState(report);
          
          if (report.resourcesStatus === 'query_failed') {
            expect(state.type).toBe('resource-unavailable');
          } else if (report.weaknessTags.length === 0) {
            expect(state.type).toBe('no-weaknesses');
          } else if (report.resources.length === 0) {
            expect(state.type).toBe('no-matched-resources');
          } else {
            expect(state.type).toBe('resources');
          }
        }
      )
    );
  });

  it('Property 15 & 16: Recommendation rendering preserves order (including institution-first) and caps at five', () => {
    fc.assert(
      fc.property(
        fc.array(resourceArb),
        (resources) => {
          const report = {
            resourcesStatus: 'ok' as const,
            weaknessTags: ['tag1'],
            resources
          };
          const state = selectRecommendationState(report);
          
          if (resources.length === 0) {
            expect(state.type).toBe('no-matched-resources');
            return;
          }
          
          expect(state.type).toBe('resources');
          if (state.type === 'resources') {
            const expectedLength = Math.min(resources.length, MAX_RECOMMENDATION_RESOURCES);
            expect(state.resources).toHaveLength(expectedLength);
            
            // Ensure order is preserved exactly
            for (let i = 0; i < expectedLength; i++) {
              expect(state.resources[i]).toEqual(resources[i]);
            }
          }
        }
      )
    );
  });

  it('Property 17: Resource links target their URL', () => {
    fc.assert(
      fc.property(
        fc.array(resourceArb),
        (resources) => {
          const links = toResourceLinks(resources);
          
          expect(links).toHaveLength(resources.length);
          for (let i = 0; i < resources.length; i++) {
            expect(links[i].url).toBe(resources[i].url);
            expect(links[i].title).toBe(resources[i].title);
          }
        }
      )
    );
  });
});