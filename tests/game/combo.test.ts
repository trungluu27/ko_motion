import { describe, expect, test } from 'vitest';
import { createMatch, stepMatch } from '../../src/game/sim/match';
import { matchCombo } from '../../src/game/sim/combo';
import type { Match, SimEvent, TickInput } from '../../src/game/sim/types';
import { inp } from './helpers/sim';

const at = (gap: number): Match => {
  const m = createMatch();
  m.fighters[0].x = 400;
  m.fighters[1].x = 400 + gap;
  return m;
};

/** Plays a script of [ticksToWait, input] steps for fighter 0 (fighter 1 idle); returns all events. */
function play(m: Match, script: [number, Partial<TickInput>][]): SimEvent[] {
  const events: SimEvent[] = [];
  for (const [wait, p] of script) {
    for (let i = 0; i < wait; i++) {
      stepMatch(m, [inp(), inp()]);
      events.push(...m.events);
    }
    stepMatch(m, [inp(p), inp()]);
    events.push(...m.events);
  }
  return events;
}
const idleTicks = (m: Match, n: number) => play(m, [[n - 1, {}]]);

describe('combos', () => {
  test('jab then cross as soon as the jab recovers is a double jab (+20% damage)', () => {
    const m = at(80);
    const ev = [...play(m, [[0, { attack: 'punch_l' }], [20, { attack: 'punch_r' }]]), ...idleTicks(m, 12)];
    expect(ev.filter((e) => e.type === 'hit').map((e) => e.damage)).toEqual([5, 9.6]);
    expect(ev.find((e) => e.type === 'combo')).toMatchObject({ fighter: 0, combo: 'double_jab' });
    expect(m.fighters[1].hp).toBeCloseTo(85.4, 9);
  });

  test('a cross more than 42 frames after the jab is not a combo', () => {
    const m = at(80);
    const ev = [...play(m, [[0, { attack: 'punch_l' }], [50, { attack: 'punch_r' }]]), ...idleTicks(m, 12)];
    expect(ev.some((e) => e.type === 'combo')).toBe(false);
    expect(ev.filter((e) => e.type === 'hit').map((e) => e.damage)).toEqual([5, 8]);
  });

  test('block, dodge, cross within one second is a counter (x1.5)', () => {
    const m = at(100);
    const ev = [...play(m, [[0, { block: true }], [0, { block: true }], [0, { dodge: true }], [32, { attack: 'punch_r' }]]), ...idleTicks(m, 10)];
    expect(ev.find((e) => e.type === 'combo')).toMatchObject({ combo: 'counter' });
    expect(m.fighters[1].hp).toBe(88);
  });

  test('the same sequence spread over more than 60 frames is not a counter', () => {
    const m = at(100);
    const holdBlock: [number, Partial<TickInput>][] = Array.from({ length: 30 }, () => [0, { block: true }]);
    const ev = [...play(m, [...holdBlock, [0, { dodge: true }], [32, { attack: 'punch_r' }]]), ...idleTicks(m, 10)];
    expect(ev.some((e) => e.type === 'combo')).toBe(false);
    expect(m.fighters[1].hp).toBe(92);
  });

  test('matchCombo prefers the longest matching sequence', () => {
    const h = [{ token: 'punch_l' as const, frame: 0 }, { token: 'punch_r' as const, frame: 20 }, { token: 'kick_r' as const, frame: 45 }];
    expect(matchCombo(h)?.name).toBe('triple_attack');
    expect(matchCombo(h.slice(0, 2))?.name).toBe('double_jab');
    expect(matchCombo([{ token: 'kick_r', frame: 0 }])).toBeNull();
  });
});

describe('special', () => {
  test('a second punch within 15 frames with a full meter becomes the special', () => {
    const m = at(300);
    m.fighters[0].special = 100;
    const ev = play(m, [[0, { attack: 'punch_l' }], [4, { attack: 'punch_r' }]]);
    expect(m.fighters[0].action).toMatchObject({ kind: 'attack', move: 'special', frame: 0 });
    expect(m.fighters[0].special).toBe(0);
    expect(ev.filter((e) => e.type === 'attack').map((e) => e.move)).toEqual(['punch_l', 'special']);
  });

  test('without a full meter the second punch is ignored during the first', () => {
    const m = at(300);
    m.fighters[0].special = 90;
    play(m, [[0, { attack: 'punch_l' }], [4, { attack: 'punch_r' }]]);
    expect(m.fighters[0].action).toMatchObject({ kind: 'attack', move: 'punch_l' });
    expect(m.fighters[0].special).toBe(90);
  });
});
