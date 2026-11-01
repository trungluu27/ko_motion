export type Difficulty = 'easy' | 'normal' | 'hard';

export type DifficultyParams = {
  reactionMs: number;
  /** chance to start attacking when in range, per decision */
  aggression: number;
  /** chance to raise an anticipatory guard when the opponent is close, per decision */
  blockChance: number;
  dodgeChance: number;
  /** chance to punish an opponent attack that is in recovery */
  counterChance: number;
  comboLen: 1 | 2 | 3;
  idlePauseMs: number;
  adaptive: boolean;
};

/** Spec 8, retuned by spec ai-difficulty 2.4. */
export const DIFFICULTIES: Readonly<Record<Difficulty, DifficultyParams>> = {
  easy: { reactionMs: 600, aggression: 0.25, blockChance: 0.15, dodgeChance: 0.05, counterChance: 0, comboLen: 1, idlePauseMs: 1200, adaptive: false },
  normal: { reactionMs: 300, aggression: 0.5, blockChance: 0.55, dodgeChance: 0.15, counterChance: 0.65, comboLen: 2, idlePauseMs: 600, adaptive: true },
  hard: { reactionMs: 220, aggression: 0.65, blockChance: 0.65, dodgeChance: 0.25, counterChance: 0.85, comboLen: 3, idlePauseMs: 300, adaptive: true },
};

/** The AI re-decides every 100 ms. */
export const DECISION_FRAMES = 6;

export const msToFrames = (ms: number): number => Math.round((ms * 60) / 1000);
