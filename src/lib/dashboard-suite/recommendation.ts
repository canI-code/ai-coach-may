// Feature: candidate-dashboard-suite
// Recommendation state selection (pure)

import type { RecommendationState, Resource } from './types';
import { MAX_RECOMMENDATION_RESOURCES } from './constants';

export function selectRecommendationState(report: {
  resourcesStatus: 'ok' | 'query_failed';
  weaknessTags: string[];
  resources: Resource[];
}): RecommendationState {
  // Precedence: resource-query-failure → empty weakness set → empty matched-resource list → resources
  if (report.resourcesStatus === 'query_failed') {
    return { type: 'resource-unavailable' };
  }

  if (report.weaknessTags.length === 0) {
    return { type: 'no-weaknesses' };
  }

  if (report.resources.length === 0) {
    return { type: 'no-matched-resources' };
  }

  const cappedResources = report.resources.slice(0, MAX_RECOMMENDATION_RESOURCES);
  return {
    type: 'resources',
    resources: cappedResources,
    nextSteps: 'Review the recommended resources and practice the identified areas for improvement.',
  };
}

export function toResourceLinks(resources: Resource[]): Array<{ title: string; url: string }> {
  return resources.map((r) => ({ title: r.title, url: r.url }));
}
