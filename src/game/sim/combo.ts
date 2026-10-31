import { COMBO_GAP, COUNTER_SPAN } from './constants';
import type { ComboName, Fighter, HistoryToken } from './types';

export type ComboDef = { name: ComboName; seq: HistoryToken[]; damageMult: number; specialBonus: number; maxSpan?: number };

/** Spec 6.2. */
export const COMBOS: readonly ComboDef[] = [
  { name: 'double_jab', seq: ['punch_l', 'punch_r'], damageMult: 1.2, specialBonus: 10 },
  { name: 'triple_attack', seq: ['punch_l', 'punch_r', 'kick_r'], damageMult: 1.4, specialBonus: 20 },
  { name: 'counter', seq: ['block', 'dodge', 'punch_r'], damageMult: 1.5, specialBonus: 25, maxSpan: COUNTER_SPAN },
  { name: 'power_combo', seq: ['punch_r', 'kick_l', 'kick_r'], damageMult: 1.5, specialBonus: 25 },
];

const BY_LENGTH = [...COMBOS].sort((a, b) => b.seq.length - a.seq.length);

export const HISTORY_LIMIT = 6;

/** The longest combo whose sequence ends the history, with every step at most COMBO_GAP frames apart. */
export function matchCombo(history: Fighter['history']): ComboDef | null {
  for (const c of BY_LENGTH) {
    const tail = history.slice(-c.seq.length);
    if (tail.length !== c.seq.length || tail.some((h, i) => h.token !== c.seq[i])) continue;
    if (tail.some((h, i) => i > 0 && h.frame - tail[i - 1].frame > COMBO_GAP)) continue;
    if (c.maxSpan !== undefined && tail[tail.length - 1].frame - tail[0].frame > c.maxSpan) continue;
    return c;
  }
  return null;
}

export const comboByName = (name: ComboName): ComboDef => COMBOS.find((c) => c.name === name)!;
