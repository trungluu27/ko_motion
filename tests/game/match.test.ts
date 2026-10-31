import { describe, expect, test } from 'vitest';
import { createMatch } from '../../src/game/sim/match';
import { press, run } from './helpers/sim';

describe('match clock and result', () => {
  test('running out the clock with equal HP is a draw', () => {
    const m = createMatch();
    run(m, 5940);
    expect(m.framesLeft).toBe(0);
    expect(m.result).toEqual({ winner: null, reason: 'timeout' });
  });

  test('on timeout the fighter with more HP wins', () => {
    const m = createMatch();
    m.fighters[0].hp = 90;
    run(m, 5940);
    expect(m.result).toEqual({ winner: 1, reason: 'timeout' });
  });

  test('nothing changes after the match has a result', () => {
    const m = createMatch();
    run(m, 5940);
    expect(run(m, 10, { attack: 'punch_l', move: 1 })).toEqual([]);
    expect(m.framesLeft).toBe(0);
    expect(m.fighters[0].x).toBe(350);
  });
});

describe('telegraphed attacks', () => {
  test('extra startup delays the active window (NPC jab hits on tick 29 instead of 5)', () => {
    const m = createMatch({ extraStartup: [0, 24] });
    m.fighters[0].x = 400;
    m.fighters[1].x = 500;
    const ev = press(m, 1, { attack: 'punch_l' }, 30);
    expect(ev.find((e) => e.type === 'hit')).toMatchObject({ fighter: 1, tick: 29 });
  });
});
