// Feature: candidate-dashboard-suite, Property 4: Timeline timestamp formatting
// Feature: candidate-dashboard-suite, Property 5: Timeline ordering is non-decreasing and stable

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatTimestamp, orderTimeline } from '../timeline';

describe('Dashboard Suite: Timeline Formatting', () => {
  it('Property 4: Timeline timestamp formatting', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 360000 }), // test up to 100 hours
        (tSeconds) => {
          const formatted = formatTimestamp(tSeconds);
          
          const parts = formatted.split(':');
          expect(parts).toHaveLength(2);
          
          const [mm, ss] = parts;
          
          expect(mm.length).toBeGreaterThanOrEqual(2);
          expect(ss).toHaveLength(2);
          
          const mmNum = parseInt(mm, 10);
          const ssNum = parseInt(ss, 10);
          
          expect(mmNum).toBe(Math.floor(tSeconds / 60));
          expect(ssNum).toBe(tSeconds % 60);
        }
      )
    );
  });

  it('Property 5: Timeline ordering is non-decreasing and stable', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            tSeconds: fc.integer({ min: 0, max: 10000 }),
            event: fc.string(),
            originalIndex: fc.nat() // injected just to check stability if needed, but not returned in signature
          })
        ),
        (entries) => {
          // add original indexes for stability check
          const entriesWithIndex = entries.map((e, i) => ({ ...e, originalIndex: i }));
          
          const sorted = orderTimeline(entriesWithIndex as any);
          
          expect(sorted).toHaveLength(entries.length);
          
          // non-decreasing
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].tSeconds).toBeGreaterThanOrEqual(sorted[i - 1].tSeconds);
            
            // stability: if tSeconds are equal, original order must be preserved
            if (sorted[i].tSeconds === sorted[i - 1].tSeconds) {
              expect((sorted[i] as any).originalIndex).toBeGreaterThan((sorted[i - 1] as any).originalIndex);
            }
          }
        }
      )
    );
  });
});