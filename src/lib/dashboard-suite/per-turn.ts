// Feature: candidate-dashboard-suite
// Per-turn history and strengths/improvements compilation (pure)

import type { PerTurnRow } from './types';
import type { TurnRecord } from '../interview/schemas';

export function buildPerTurnHistory(turns: TurnRecord[]): PerTurnRow[] {
  const sortedTurns = [...turns].sort((a, b) => a.index - b.index);
  return sortedTurns.map((turn) => ({
    turnIndex: turn.index,
    transcript: turn.transcript || '',
    questionText: turn.questionText ?? '',
    questionOrigin: turn.questionOrigin ?? (turn.index <= 1 ? 'cover' : 'database'),
    evaluation: turn.evaluation
      ? {
          strengths: turn.evaluation.strengths || [],
          improvements: turn.evaluation.improvements || [],
          technicalAccuracy: turn.evaluation.technicalAccuracy,
          communication: turn.evaluation.communication,
          voiceCi: turn.evaluation.voiceCi,
          bodyCi: turn.evaluation.bodyCi,
        }
      : null,
  }));
}

export function compileStrengthsImprovements(turns: TurnRecord[]): {
  strengths: string[];
  improvements: string[];
} {
  const strengthsSet = new Set<string>();
  const improvementsSet = new Set<string>();

  for (const turn of turns) {
    if (turn.evaluation) {
      for (const s of turn.evaluation.strengths || []) {
        strengthsSet.add(s);
      }
      for (const i of turn.evaluation.improvements || []) {
        improvementsSet.add(i);
      }
    }
  }

  return {
    strengths: Array.from(strengthsSet),
    improvements: Array.from(improvementsSet),
  };
}
