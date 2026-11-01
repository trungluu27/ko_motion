import { NEUTRAL, type Multipliers } from '../../../src/game/ai/adaptive';
import { DIFFICULTIES, type DifficultyParams } from '../../../src/game/ai/difficulty';
import type { BrainContext } from '../../../src/game/ai/fsm';
import type { Seen } from '../../../src/game/ai/perception';
import { createMatch } from '../../../src/game/sim/match';
import type { Action, Fighter } from '../../../src/game/sim/types';

/** Normal difficulty with every chance switched off unless overridden. */
export const params = (p: Partial<DifficultyParams> = {}): DifficultyParams => ({
  ...DIFFICULTIES.normal, aggression: 0, blockChance: 0, dodgeChance: 0, counterChance: 0, ...p,
});

export const seenAt = (x: number, action: Action = { kind: 'idle' }): Seen => ({ x, action, hp: 100, stamina: 100, special: 0 });

export function ctx(over: { self?: Partial<Fighter>; seen?: Seen | null; frame?: number; params?: DifficultyParams; mult?: Multipliers } = {}): BrainContext {
  const self = { ...createMatch().fighters[1], x: 600, facing: -1 as const, ...over.self };
  return { self, seen: over.seen === undefined ? seenAt(500) : over.seen, reactionFrames: 0, frame: over.frame ?? 0, params: over.params ?? params(), mult: over.mult ?? { ...NEUTRAL } };
}
