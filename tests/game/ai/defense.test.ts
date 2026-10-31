import { describe, expect, test } from 'vitest';
import { AiBrain } from '../../../src/game/ai/fsm';
import { createRng } from '../../../src/shared/rng';
import type { Action, MoveId } from '../../../src/game/sim/types';
import { ctx, params, seenAt } from './helpers';

const attacking = (move: MoveId, frame: number): Action => ({ kind: 'attack', move, frame, hasHit: false, evaded: false, combo: null });

describe('AiBrain – defense', () => {
  test('raises a guard when the opponent is close, not when far', () => {
    const close = new AiBrain(createRng(1));
    const inputs = Array.from({ length: 8 }, (_, frame) => close.next(ctx({ frame, seen: seenAt(480), params: params({ blockChance: 1 }) })));
    expect(close.state).toBe('block');
    expect(inputs.slice(1).every((i) => i.block)).toBe(true);
    const far = new AiBrain(createRng(1));
    far.next(ctx({ seen: seenAt(200), params: params({ blockChance: 1 }) }));
    expect(far.state).not.toBe('block');
  });

  test('punishes an attack in recovery with the fastest move in range', () => {
    const brain = new AiBrain(createRng(1));
    const out = brain.next(ctx({ seen: seenAt(500, attacking('kick_r', 20)), params: params({ counterChance: 1 }) }));
    expect(out.attack).toBe('punch_l');
    expect(brain.state).toBe('counter');
  });

  test('never punishes with counterChance 0', () => {
    const brain = new AiBrain(createRng(1));
    const out = brain.next(ctx({ seen: seenAt(500, attacking('kick_r', 20)), params: params({ counterChance: 0 }) }));
    expect(out.attack).toBeNull();
  });

  test('dodges an attack seen during its startup', () => {
    const brain = new AiBrain(createRng(1));
    const out = brain.next(ctx({ seen: seenAt(500, attacking('kick_l', 2)), params: params({ dodgeChance: 1 }) }));
    expect(out.dodge).toBe(true);
  });

  test('rolls the punish chance only once per opponent attack', () => {
    let calls = 0;
    const brain = new AiBrain(() => {
      calls++;
      return 0.99;
    });
    for (let frame = 0; frame < 18; frame++) {
      brain.next(ctx({ frame, seen: seenAt(500, attacking('kick_r', 20 + frame)), params: params({ counterChance: 0.5 }) }));
    }
    expect(calls).toBe(1);
  });
});
