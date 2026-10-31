import { describe, expect, test } from 'vitest';
import { createMatch } from '../../src/game/sim/match';
import type { Match } from '../../src/game/sim/types';
import { press, run } from './helpers/sim';

const at = (gap: number): Match => {
  const m = createMatch();
  m.fighters[0].x = 400;
  m.fighters[1].x = 400 + gap;
  return m;
};

describe('attacks', () => {
  test('a jab in range hits on its first active frame (tick 5)', () => {
    const m = at(100);
    const ev = press(m, 0, { attack: 'punch_l' }, 6);
    expect(ev.find((e) => e.type === 'attack')).toMatchObject({ fighter: 0, move: 'punch_l', tick: 1 });
    expect(ev.find((e) => e.type === 'hit')).toMatchObject({ fighter: 0, move: 'punch_l', damage: 5, tick: 5 });
    expect(m.fighters[1].hp).toBe(95);
    expect(m.fighters[0].stamina).toBeLessThan(100);
  });

  test('the defender is stunned and pushed back', () => {
    const m = at(100);
    press(m, 0, { attack: 'punch_l' }, 4);
    expect(m.fighters[1].action.kind).toBe('hitstun');
    expect(m.fighters[1].x).toBe(530);
  });

  test('a jab out of range misses', () => {
    const m = at(200);
    const ev = press(m, 0, { attack: 'punch_l' }, 20);
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
    expect(m.fighters[1].hp).toBe(100);
  });

  test('simultaneous jabs trade: both are hit', () => {
    const m = at(100);
    run(m, 1, { attack: 'punch_l' }, { attack: 'punch_l' });
    run(m, 6);
    expect(m.fighters.map((f) => f.hp)).toEqual([95, 95]);
  });

  test('attack input during hitstun is ignored', () => {
    const m = at(100);
    press(m, 0, { attack: 'punch_l' }, 4);
    const ev = run(m, 3, {}, { attack: 'punch_r' });
    expect(ev.some((e) => e.type === 'attack' && e.fighter === 1)).toBe(false);
  });

  test('reducing HP to zero is a KO and ends the match', () => {
    const m = at(100);
    m.fighters[1].hp = 5;
    const ev = press(m, 0, { attack: 'punch_l' }, 6);
    expect(ev.some((e) => e.type === 'ko' && e.fighter === 0)).toBe(true);
    expect(m.fighters[1].hp).toBe(0);
    expect(m.fighters[1].action.kind).toBe('ko');
    expect(m.result).toEqual({ winner: 0, reason: 'ko' });
    expect(run(m, 5, {}, { attack: 'punch_l' })).toEqual([]);
  });

  test('not enough stamina emits tired and spends nothing', () => {
    const m = at(100);
    m.fighters[0].stamina = 3;
    m.fighters[0].sinceSpend = 0;
    const ev = press(m, 0, { attack: 'punch_l' });
    expect(ev).toEqual([{ type: 'tired', fighter: 0, move: 'punch_l', tick: 1 }]);
    expect(m.fighters[0].stamina).toBe(3);
    expect(m.fighters[0].action.kind).toBe('idle');
  });

  test('hitstop freezes the match clock for 4 ticks after a hit', () => {
    const m = at(100);
    press(m, 0, { attack: 'punch_l' }, 4);
    const left = m.framesLeft;
    run(m, 4);
    expect(m.framesLeft).toBe(left);
    run(m, 1);
    expect(m.framesLeft).toBe(left - 1);
  });
});
