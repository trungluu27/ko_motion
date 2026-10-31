import { MAX_HP, MAX_SPECIAL, MAX_STAMINA } from '../sim/constants';
import type { Match } from '../sim/types';

export type HudModel = {
  hp: [number, number];
  stamina: [number, number];
  special: [number, number];
  seconds: number;
  result: string | null;
};

/** Bars as 0..1 fractions; result text from the player's (fighter 0) side. */
export function hudModel(m: Match): HudModel {
  const [a, b] = m.fighters;
  const result = !m.result ? null : m.result.winner === null ? 'DRAW' : m.result.winner === 0 ? 'YOU WIN' : 'YOU LOSE';
  return {
    hp: [a.hp / MAX_HP, b.hp / MAX_HP],
    stamina: [a.stamina / MAX_STAMINA, b.stamina / MAX_STAMINA],
    special: [a.special / MAX_SPECIAL, b.special / MAX_SPECIAL],
    seconds: Math.ceil(m.framesLeft / 60),
    result,
  };
}
