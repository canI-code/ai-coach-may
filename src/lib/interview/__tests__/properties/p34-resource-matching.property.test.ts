import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { rankResources } from '@/lib/interview/resource-matcher';
import type { Resource } from '@/lib/interview/schemas';

const TAGS = ['t1', 't2', 't3', 't4', 't5'];
const INSTITUTIONS = ['INST_A', 'INST_B', undefined];

const resourceArb: fc.Arbitrary<Resource> = fc.record({
  id: fc.uuid(),
  title: fc.string(),
  url: fc.webUrl(),
  tags: fc.array(fc.constantFrom(...TAGS), { maxLength: 5 }),
  institutionCode: fc.constantFrom(...INSTITUTIONS),
});

// Feature: interview-module, Property 34: Resource matching is capped, relevant, and institution-first
describe('Property 34: resource matching capped, relevant, institution-first', () => {
  it('returns <=5 relevant resources ordered institution-first', () => {
    fc.assert(
      fc.property(
        fc.array(resourceArb, { maxLength: 30 }),
        fc.array(fc.constantFrom(...TAGS), { minLength: 1, maxLength: 5 }),
        fc.constantFrom('INST_A', 'INST_B'),
        (resources, weaknessTags, institutionCode) => {
          const ranked = rankResources(resources, weaknessTags, institutionCode);
          expect(ranked.length).toBeLessThanOrEqual(5);
          for (const r of ranked) {
            expect(r.tags.some((t) => weaknessTags.includes(t))).toBe(true);
          }
          // no institution-matched resource may appear after a global one
          let seenGlobal = false;
          for (const r of ranked) {
            if (r.institutionCode === institutionCode) {
              expect(seenGlobal).toBe(false);
            } else {
              seenGlobal = true;
            }
          }
        },
      ),
    );
  });
});
