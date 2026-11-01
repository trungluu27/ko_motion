import { COMBO_GAP } from './sim/constants';
import type { SimEvent } from './sim/types';

export type StatsSnapshot = {
  punches: number;
  kicks: number;
  specials: number;
  hitsLanded: number;
  /** opponent attacks the player blocked */
  blocked: number;
  damageDealt: number;
  damageTaken: number;
  longestCombo: number;
  seconds: number;
};

/** The player's (fighter 0) numbers for the result screen (spec phase5 4). */
export class MatchStats {
  private s: StatsSnapshot = {
    punches: 0, kicks: 0, specials: 0, hitsLanded: 0, blocked: 0, damageDealt: 0, damageTaken: 0, longestCombo: 0, seconds: 0,
  };
  /** landed hits in the current chain */
  currentCombo = 0;
  private lastHitFrame = -Infinity;

  observe(events: SimEvent[], frame: number): void {
    const s = this.s;
    s.seconds = Math.floor(frame / 60);
    for (const e of events) {
      const mine = e.fighter === 0;
      if (e.type === 'attack' && mine) {
        if (e.move === 'special') s.specials++;
        else if (e.move === 'kick_l' || e.move === 'kick_r') s.kicks++;
        else s.punches++;
      } else if (e.type === 'hit' || e.type === 'guard_break') {
        if (mine) {
          this.currentCombo = frame - this.lastHitFrame <= COMBO_GAP ? this.currentCombo + 1 : 1;
          this.lastHitFrame = frame;
          s.longestCombo = Math.max(s.longestCombo, this.currentCombo);
          s.hitsLanded++;
          s.damageDealt += e.damage ?? 0;
        } else {
          this.currentCombo = 0;
          this.lastHitFrame = -Infinity;
          s.damageTaken += e.damage ?? 0;
        }
      } else if (e.type === 'blocked') {
        if (mine) {
          s.damageDealt += e.damage ?? 0;
        } else {
          s.blocked++;
          s.damageTaken += e.damage ?? 0;
        }
      }
    }
  }

  snapshot(): StatsSnapshot {
    return { ...this.s };
  }
}

/** A playful calorie figure, not a measurement (spec phase5 4). */
export const kcalEstimate = (s: Pick<StatsSnapshot, 'punches' | 'kicks' | 'specials'>): number =>
  0.1 * (s.punches + s.specials) + 0.2 * s.kicks;
