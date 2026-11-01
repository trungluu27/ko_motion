import { describe, expect, test } from 'vitest';
import { WalkTracker, jumpLiftPx } from '../../src/game/render/spriteAnim';
import { parallaxOffsets } from '../../src/game/render/stage';
import { createMatch } from '../../src/game/sim/match';
import type { Action, Fighter } from '../../src/game/sim/types';

const fighter = (action: Action, x = 350): Fighter => ({ ...createMatch().fighters[0], action, x });

describe('walk direction', () => {
  test('stays on the last direction between sim ticks (no fwd/back flicker on fast displays)', () => {
    const w = new WalkTracker();
    w.tick(fighter({ kind: 'walk' }, 350));
    w.tick(fighter({ kind: 'walk' }, 345));
    expect(w.dx).toBe(-5);
    // a render frame with no sim tick must not reset the direction
    expect(w.dx).toBe(-5);
    w.tick(fighter({ kind: 'walk' }, 345)); // pushed against the other fighter: no movement this tick
    expect(w.dx).toBe(-5);
    w.tick(fighter({ kind: 'idle' }, 345));
    expect(w.dx).toBe(0);
  });
});

describe('jump lift', () => {
  test('follows the sim jump arc and is zero on the ground', () => {
    expect(jumpLiftPx(fighter({ kind: 'idle' }), 1)).toBe(0);
    expect(jumpLiftPx(fighter({ kind: 'jump', frame: 15 }), 1)).toBeCloseTo(120, 6);
    expect(jumpLiftPx(fighter({ kind: 'jump', frame: 15 }), 0.5)).toBeCloseTo(60, 6);
    expect(jumpLiftPx(fighter({ kind: 'jump', frame: 0 }), 1)).toBeCloseTo(0, 6);
  });
});

describe('parallax', () => {
  test('the floor the fighters stand on never shifts; background layers do', () => {
    const o = parallaxOffsets(800);
    expect(o.floor).toBe(0);
    expect(Math.abs(o.far)).toBeGreaterThan(0);
    expect(Math.abs(o.mid)).toBeGreaterThan(Math.abs(o.far));
    expect(parallaxOffsets(500)).toEqual({ far: 0, mid: 0, floor: 0 });
  });
});
