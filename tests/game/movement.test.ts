import { describe, expect, test } from 'vitest';
import { createMatch } from '../../src/game/sim/match';
import { run } from './helpers/sim';

describe('movement', () => {
  test('a new match places fighters facing each other with full resources', () => {
    const m = createMatch();
    expect(m.fighters.map((f) => [f.x, f.facing, f.hp, f.stamina, f.special])).toEqual([[350, 1, 100, 100, 0], [650, -1, 100, 100, 0]]);
    expect(m.framesLeft).toBe(5940);
  });

  test('walking right for 10 ticks moves 50 units', () => {
    const m = createMatch();
    run(m, 10, { move: 1 });
    expect(m.fighters[0].x).toBe(400);
    expect(m.fighters[0].action.kind).toBe('walk');
  });

  test('fighters walking into each other never get closer than 60', () => {
    const m = createMatch();
    for (let i = 0; i < 60; i++) {
      run(m, 1, { move: 1 }, { move: -1 });
      expect(m.fighters[1].x - m.fighters[0].x).toBeGreaterThanOrEqual(60 - 1e-9);
    }
  });

  test('positions are clamped to the arena edges', () => {
    const m = createMatch();
    run(m, 100, { move: -1 }, { move: 1 });
    expect(m.fighters[0].x).toBe(30);
    expect(m.fighters[1].x).toBe(970);
  });

  test('facing flips when fighters swap sides', () => {
    const m = createMatch();
    m.fighters[0].x = 800;
    run(m, 1);
    expect(m.fighters[0].facing).toBe(-1);
    expect(m.fighters[1].facing).toBe(1);
  });

  test('crouching holds position even with a move input', () => {
    const m = createMatch();
    run(m, 5, { crouch: true, move: 1 });
    expect(m.fighters[0].action.kind).toBe('crouch');
    expect(m.fighters[0].x).toBe(350);
  });

  test('a jump lasts 30 frames then returns to idle', () => {
    const m = createMatch();
    run(m, 1, { jump: true });
    expect(m.fighters[0].action.kind).toBe('jump');
    run(m, 29); // ticks 1..30 are the 30 jump frames
    expect(m.fighters[0].action.kind).toBe('jump');
    run(m, 1);
    expect(m.fighters[0].action.kind).toBe('idle');
  });

  test('stamina regenerates 0.25 per frame after 30 frames without spending', () => {
    const m = createMatch();
    m.fighters[0].stamina = 50;
    m.fighters[0].sinceSpend = 0;
    run(m, 30);
    expect(m.fighters[0].stamina).toBe(50);
    run(m, 4);
    expect(m.fighters[0].stamina).toBe(51);
  });
});
