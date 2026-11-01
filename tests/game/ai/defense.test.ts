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

  test('punishes an attack in recovery with a punch first (it recovers before their hitstun ends)', () => {
    const brain = new AiBrain(createRng(1));
    const out = brain.next(ctx({ seen: seenAt(500, attacking('kick_r', 20)), params: params({ counterChance: 1 }) }));
    expect(out.attack).toBe('punch_r');
    expect(brain.state).toBe('counter');
  });

  test('the punish accounts for the reaction delay: only a move that still lands in time', () => {
    // seen at frame 20 of kick_r (34 total), 12 ticks old -> 2 frames left (+3 slack): only the jab (startup 4) fits
    const brain = new AiBrain(createRng(1));
    const out = brain.next({ ...ctx({ seen: seenAt(500, attacking('kick_r', 20)), params: params({ counterChance: 1 }) }), reactionFrames: 12 });
    expect(out.attack).toBe('punch_l');
    // 14 ticks old: the opening is gone
    const late = new AiBrain(createRng(1));
    const none = late.next({ ...ctx({ seen: seenAt(500, attacking('kick_r', 20)), params: params({ counterChance: 1 }) }), reactionFrames: 14 });
    expect(none.attack).toBeNull();
  });

  test('a far punish walks in while the opening lasts', () => {
    // d = 170: kick_l (range 150) needs 4 walking frames + 8 startup within 34 - 14 = 20 frames
    const brain = new AiBrain(createRng(1));
    const first = brain.next(ctx({ seen: seenAt(430, attacking('kick_r', 14)), params: params({ counterChance: 1 }) }));
    expect(brain.state).toBe('counter');
    expect(first.move).toBe(-1);
  });

  test('guards low against a punch-heavy player some of the time', () => {
    const outs = [1, 2, 3, 4, 5, 6].map((seed) =>
      new AiBrain(createRng(seed)).next(ctx({ seen: seenAt(480), params: params({ blockChance: 1 }), mult: { block: 1.3, dodge: 1, aggression: 1, counter: 1, kickBias: 1 } })),
    );
    expect(outs.some((i) => i.crouch)).toBe(true);
    expect(outs.some((i) => i.block)).toBe(true);
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
