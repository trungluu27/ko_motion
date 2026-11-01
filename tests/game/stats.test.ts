import { describe, expect, test } from 'vitest';
import { MatchStats, kcalEstimate } from '../../src/game/stats';
import type { SimEvent } from '../../src/game/sim/types';

const hit = (fighter: 0 | 1, damage = 5): SimEvent => ({ type: 'hit', fighter, move: 'punch_l', damage });
const attack = (fighter: 0 | 1, move: SimEvent['move']): SimEvent => ({ type: 'attack', fighter, move });

describe('MatchStats (spec phase5 4)', () => {
  test('counts the player attacks by kind', () => {
    const s = new MatchStats();
    s.observe([attack(0, 'punch_l'), attack(0, 'punch_r'), attack(0, 'kick_r'), attack(0, 'special'), attack(1, 'kick_l')], 0);
    expect(s.snapshot()).toMatchObject({ punches: 2, kicks: 1, specials: 1 });
  });

  test('three hits 30 frames apart are a 3-hit combo', () => {
    const s = new MatchStats();
    [0, 30, 60].forEach((f) => s.observe([hit(0)], f));
    expect(s.snapshot().longestCombo).toBe(3);
    expect(s.currentCombo).toBe(3);
    expect(s.snapshot().hitsLanded).toBe(3);
  });

  test('the live combo counter lapses after COMBO_GAP without a hit', () => {
    const s = new MatchStats();
    [0, 30].forEach((f) => s.observe([hit(0)], f));
    expect(s.comboAt(60)).toBe(2);
    expect(s.comboAt(30 + 43)).toBe(0);
  });

  test('hits more than COMBO_GAP apart do not chain', () => {
    const s = new MatchStats();
    [0, 50, 100].forEach((f) => s.observe([hit(0)], f));
    expect(s.snapshot().longestCombo).toBe(1);
  });

  test('being hit in between breaks the chain', () => {
    const s = new MatchStats();
    s.observe([hit(0)], 0);
    s.observe([hit(1)], 10);
    s.observe([hit(0)], 20);
    expect(s.snapshot().longestCombo).toBe(1);
  });

  test('a blocked attack is no landed hit; blocking the opponent counts as blocked', () => {
    const s = new MatchStats();
    s.observe([{ type: 'blocked', fighter: 0, move: 'punch_l', damage: 1 }], 0);
    s.observe([{ type: 'blocked', fighter: 1, move: 'kick_r', damage: 2.6 }], 10);
    s.observe([{ type: 'guard_break', fighter: 0, move: 'kick_r', damage: 13 }], 20);
    const snap = s.snapshot();
    expect(snap.hitsLanded).toBe(1);
    expect(snap.blocked).toBe(1);
    expect(snap.damageDealt).toBeCloseTo(14);
    expect(snap.damageTaken).toBeCloseTo(2.6);
  });

  test('seconds follow the last observed frame', () => {
    const s = new MatchStats();
    s.observe([], 0);
    s.observe([], 600);
    expect(s.snapshot().seconds).toBe(10);
  });

  test('kcal estimate weights kicks double', () => {
    expect(kcalEstimate({ punches: 10, specials: 0, kicks: 5 })).toBeCloseTo(2);
  });
});
