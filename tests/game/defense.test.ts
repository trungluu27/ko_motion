import { describe, expect, test } from 'vitest';
import { createMatch } from '../../src/game/sim/match';
import type { Match, TickInput } from '../../src/game/sim/types';
import { inp } from './helpers/sim';
import { stepMatch } from '../../src/game/sim/match';

const at = (gap: number): Match => {
  const m = createMatch();
  m.fighters[0].x = 400;
  m.fighters[1].x = 400 + gap;
  return m;
};

/** Runs ticks where fighter 0 attacks at `attackTick` and fighter 1 follows `def(tick)`. */
function scenario(m: Match, attack: TickInput['attack'], attackTick: number, ticks: number, def: (tick: number) => Partial<TickInput>) {
  const events = [];
  for (let t = 1; t <= ticks; t++) {
    stepMatch(m, [inp(t === attackTick ? { attack } : {}), inp(def(t))]);
    events.push(...m.events.map((e) => ({ ...e, tick: t })));
  }
  return events;
}

describe('defense', () => {
  test('blocking cuts damage by 80%, costs 5 stamina and causes blockstun', () => {
    const m = at(100);
    const ev = scenario(m, 'punch_l', 1, 5, () => ({ block: true }));
    expect(ev.find((e) => e.type === 'blocked')).toMatchObject({ fighter: 0, damage: 1 });
    expect(m.fighters[1].hp).toBe(99);
    expect(m.fighters[1].stamina).toBe(95);
    expect(m.fighters[1].action.kind).toBe('blockstun');
  });

  test('blocking with less than 5 stamina breaks the guard', () => {
    const m = at(100);
    m.fighters[1].stamina = 4;
    m.fighters[1].sinceSpend = 0;
    const ev = scenario(m, 'punch_l', 1, 5, () => ({ block: true }));
    expect(ev.some((e) => e.type === 'guard_break')).toBe(true);
    expect(m.fighters[1].hp).toBe(95);
    expect(m.fighters[1].action).toEqual({ kind: 'hitstun', frames: 20 });
  });

  test('a dodge is invulnerable for 20 frames and reports one evade', () => {
    const m = at(100);
    const ev = scenario(m, 'punch_l', 2, 12, (t) => (t === 1 ? { dodge: true } : {}));
    expect(m.fighters[1].hp).toBe(100);
    expect(ev.filter((e) => e.type === 'evaded')).toHaveLength(1);
    expect(ev.find((e) => e.type === 'evaded')).toMatchObject({ fighter: 1, move: 'punch_l' });
  });

  test('a dodge can be punished during its 12 recovery frames', () => {
    const m = at(100);
    scenario(m, 'punch_l', 22, 30, (t) => (t === 1 ? { dodge: true } : {}));
    expect(m.fighters[1].hp).toBe(95);
  });

  test('crouching avoids high attacks but not mid ones', () => {
    const high = at(100);
    scenario(high, 'punch_l', 2, 10, () => ({ crouch: true }));
    expect(high.fighters[1].hp).toBe(100);
    const mid = at(100);
    scenario(mid, 'kick_l', 2, 14, () => ({ crouch: true }));
    expect(mid.fighters[1].hp).toBe(90);
  });

  test('being airborne avoids mid attacks', () => {
    const m = at(100);
    scenario(m, 'kick_l', 3, 16, (t) => (t === 1 ? { jump: true } : {}));
    expect(m.fighters[1].hp).toBe(100);
  });
});
