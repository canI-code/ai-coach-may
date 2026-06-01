// Feature: candidate-dashboard-suite, Property 6: Per-turn history is complete and ordered

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildPerTurnHistory, compileStrengthsImprovements } from '../per-turn';
import type { TurnRecord } from '../../interview/schemas';

describe('Dashboard Suite: Per-turn History', () => {
  it('Property 6: Per-turn history is complete and ordered, evaluation null when missing', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            index: fc.integer({ min: 0 }),
            questionId: fc.string(),
            transcript: fc.string(),
            metrics: fc.record({} as any), // mock metrics
            difficultyAfter: fc.integer(),
            createdAt: fc.date(),
            evaluation: fc.option(
              fc.record({
                technicalAccuracy: fc.integer(),
                communication: fc.integer(),
                voiceCi: fc.integer(),
                bodyCi: fc.integer(),
                strengths: fc.array(fc.string()),
                improvements: fc.array(fc.string()),
                difficultyAdjustment: fc.constant<'same'>('same')
              }),
              { nil: undefined }
            )
          }),
          { selector: (t) => t.index }
        ),
        (turns) => {
          const turnsList = turns as TurnRecord[];
          const history = buildPerTurnHistory(turnsList);
          
          expect(history).toHaveLength(turns.length);
          
          // sorted by turnIndex ascending
          for (let i = 1; i < history.length; i++) {
            expect(history[i].turnIndex).toBeGreaterThanOrEqual(history[i - 1].turnIndex);
          }
          
          // evaluation mapped correctly
          for (const row of history) {
            const originalTurn = turns.find(t => t.index === row.turnIndex);
            if (originalTurn?.evaluation) {
              expect(row.evaluation).not.toBeNull();
              expect(row.evaluation?.strengths).toEqual(originalTurn.evaluation.strengths || []);
              expect(row.evaluation?.improvements).toEqual(originalTurn.evaluation.improvements || []);
            } else {
              expect(row.evaluation).toBeNull();
            }
          }
        }
      )
    );
  });

  it('Property 6b: Strengths and improvements are distinct lists', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            index: fc.integer(),
            questionId: fc.string(),
            transcript: fc.string(),
            metrics: fc.record({} as any),
            difficultyAfter: fc.integer(),
            createdAt: fc.date(),
            evaluation: fc.option(
              fc.record({
                technicalAccuracy: fc.integer(),
                communication: fc.integer(),
                voiceCi: fc.integer(),
                bodyCi: fc.integer(),
                strengths: fc.array(fc.string()),
                improvements: fc.array(fc.string()),
                difficultyAdjustment: fc.constant<'same'>('same')
              }),
              { nil: undefined }
            )
          })
        ),
        (turns) => {
          const compiled = compileStrengthsImprovements(turns as TurnRecord[]);
          
          const expectedStrengths = new Set<string>();
          const expectedImprovements = new Set<string>();
          
          for (const t of turns) {
            if (t.evaluation) {
              for (const s of t.evaluation.strengths || []) expectedStrengths.add(s);
              for (const i of t.evaluation.improvements || []) expectedImprovements.add(i);
            }
          }
          
          expect(compiled.strengths).toEqual(Array.from(expectedStrengths));
          expect(compiled.improvements).toEqual(Array.from(expectedImprovements));
          
          // Test distinctness inside the compiled lists
          expect(new Set(compiled.strengths).size).toBe(compiled.strengths.length);
          expect(new Set(compiled.improvements).size).toBe(compiled.improvements.length);
        }
      )
    );
  });
});