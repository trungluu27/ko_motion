import { MATCH_FRAMES, MAX_HP } from '../sim/constants';
import type { Match } from '../sim/types';

/** Quiet ticks after which the sandbag is back to full HP. */
export const DUMMY_REFILL_TICKS = 90;

/** Sandbag rules on top of the normal sim (spec phase5 5): no clock, no losing, the bag never stays down. */
export function trainingTick(m: Match, ticksSinceHit: number): void {
  const [player, bag] = m.fighters;
  m.framesLeft = MATCH_FRAMES;
  player.hp = MAX_HP;
  if (m.result) {
    m.result = null;
    bag.hp = MAX_HP;
    bag.action = { kind: 'idle' };
  }
  if (ticksSinceHit >= DUMMY_REFILL_TICKS) bag.hp = MAX_HP;
}
