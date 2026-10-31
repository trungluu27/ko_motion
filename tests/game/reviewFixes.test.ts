import { describe, expect, test } from 'vitest';
import { createMatch, stepMatch } from '../../src/game/sim/match';
import type { Match, SimEvent, TickInput } from '../../src/game/sim/types';
import { inp } from './helpers/sim';

const at = (gap: number): Match => {
  const m = createMatch();
  m.fighters[0].x = 400;
  m.fighters[1].x = 400 + gap;
  return m;
};

function tick(m: Match, p0: Partial<TickInput> = {}, p1: Partial<TickInput> = {}): SimEvent[] {
  stepMatch(m, [inp(p0), inp(p1)]);
  return m.events;
}

describe('review fixes', () => {
  test('a combo trade gives both fighters their combo bonus (no order bias)', () => {
    const m = at(115); // jabs (range 110) whiff, crosses (range 120) connect
    const ev: SimEvent[] = [];
    ev.push(...tick(m, { attack: 'punch_l' }, { attack: 'punch_l' }));
    for (let i = 0; i < 16; i++) ev.push(...tick(m));
    ev.push(...tick(m, { attack: 'punch_r' }, { attack: 'punch_r' }));
    for (let i = 0; i < 15; i++) ev.push(...tick(m));
    expect(ev.filter((e) => e.type === 'combo').map((e) => e.fighter).sort()).toEqual([0, 1]);
    expect(m.fighters[0].hp).toBeCloseTo(m.fighters[1].hp, 9);
    expect(m.fighters[0].special).toBe(m.fighters[1].special);
  });

  test('pressing attack while tired still blocks that tick', () => {
    const m = createMatch({ extraStartup: [0, 0] });
    m.fighters[0].x = 400;
    m.fighters[1].x = 500;
    m.fighters[0].stamina = 5;
    m.fighters[0].sinceSpend = 0;
    const ev: SimEvent[] = [];
    ev.push(...tick(m, { block: true }, { attack: 'punch_l' }));
    for (let i = 0; i < 3; i++) ev.push(...tick(m, { block: true }));
    ev.push(...tick(m, { block: true, attack: 'kick_l' }));
    expect(ev.map((e) => e.type)).toContain('tired');
    expect(ev.map((e) => e.type)).toContain('blocked');
    expect(m.fighters[0].hp).toBe(99);
  });

  test('a punch pressed during hitstop is kept and can cancel into the special', () => {
    const m = at(80);
    m.fighters[0].special = 95;
    tick(m, { attack: 'punch_l' });
    for (let i = 0; i < 3; i++) tick(m);
    tick(m); // jab connects: special reaches 100, hitstop starts
    expect(m.hitstop).toBe(4);
    tick(m, { attack: 'punch_r' }); // pressed during the freeze
    for (let i = 0; i < 4; i++) tick(m);
    expect(m.fighters[0].action).toMatchObject({ kind: 'attack', move: 'special' });
  });
});
