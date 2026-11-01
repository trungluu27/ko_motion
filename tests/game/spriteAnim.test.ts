import { describe, expect, test } from 'vitest';
import { type AnimCtx, type ClipInfo, clipInfoFromMeta, spriteFrame } from '../../src/game/render/spriteAnim';
import { createMatch } from '../../src/game/sim/match';
import type { Action, Fighter } from '../../src/game/sim/types';

const META = {
  clips: { idle: 60, walk_fwd: 36, walk_back: 44, jump: 37, crouch: 7, punch_l: 9, punch_r: 12, kick_l: 15, kick_r: 17, special: 24, block: 10, dodge: 28, hit_high: 19, hit_mid: 22, knockdown: 43, victory: 37, defeat: 46 },
  impact: { punch_l: 2, punch_r: 3, kick_l: 4, kick_r: 5, special: 6 },
};
const clips: ClipInfo = clipInfoFromMeta(META);

const fighter = (action: Action, over: Partial<Fighter> = {}): Fighter => ({ ...createMatch().fighters[0], action, ...over });
const ctx = (over: Partial<AnimCtx> = {}): AnimCtx => ({
  self: 0, opponentX: 650, dx: 0, lastHitMove: null, result: null, tick: 0, actionTicks: 0, sinceResult: 0, clips, ...over,
});
const attack = (move: 'punch_l' | 'kick_r', frame: number): Action => ({ kind: 'attack', move, frame, hasHit: false, evaded: false, combo: null });

describe('spriteFrame', () => {
  test('idle loops over its frames at 30 sprites per second', () => {
    expect(spriteFrame(fighter({ kind: 'idle' }), ctx({ tick: 0 }))).toEqual({ clip: 'idle', index: 0 });
    expect(spriteFrame(fighter({ kind: 'idle' }), ctx({ tick: 10 })).index).toBe(5);
    expect(spriteFrame(fighter({ kind: 'idle' }), ctx({ tick: 120 })).index).toBe(0);
  });

  test('walking toward the opponent is walk_fwd on either side of the arena', () => {
    expect(spriteFrame(fighter({ kind: 'walk' }, { x: 350 }), ctx({ opponentX: 650, dx: 5 })).clip).toBe('walk_fwd');
    expect(spriteFrame(fighter({ kind: 'walk' }, { x: 350 }), ctx({ opponentX: 650, dx: -5 })).clip).toBe('walk_back');
    expect(spriteFrame(fighter({ kind: 'walk' }, { x: 800 }), ctx({ opponentX: 300, dx: -5 })).clip).toBe('walk_fwd');
  });

  test('the impact sprite shows on the first active frame', () => {
    expect(spriteFrame(fighter(attack('punch_l', 4)), ctx())).toEqual({ clip: 'punch_l', index: 2 });
    expect(spriteFrame(fighter(attack('punch_l', 2)), ctx()).index).toBe(1);
  });

  test('a telegraph stretches the startup so the impact still lands on the first active frame', () => {
    const npc = (frame: number) => spriteFrame(fighter(attack('punch_l', frame), { extraStartup: 24 }), ctx());
    expect(npc(27).index).toBeLessThan(2);
    expect(npc(28)).toEqual({ clip: 'punch_l', index: 2 });
  });

  test('recovery advances one sprite per two frames and never runs past the clip', () => {
    expect(spriteFrame(fighter(attack('kick_r', 16)), ctx()).index).toBe(5 + 3);
    expect(spriteFrame(fighter(attack('kick_r', 500)), ctx()).index).toBe(16);
  });

  test('hit reactions depend on what hit last', () => {
    const hit = fighter({ kind: 'hitstun', frames: 10 });
    expect(spriteFrame(hit, ctx({ lastHitMove: 'punch_r' })).clip).toBe('hit_high');
    expect(spriteFrame(hit, ctx({ lastHitMove: 'kick_l' })).clip).toBe('hit_mid');
  });

  test('after a KO the winner celebrates and the loser stays down', () => {
    const result = { winner: 0 as const, reason: 'ko' as const };
    expect(spriteFrame(fighter({ kind: 'idle' }), ctx({ result, sinceResult: 200 })).clip).toBe('victory');
    const down = spriteFrame(fighter({ kind: 'ko' }), ctx({ self: 1, result, actionTicks: 1000 }));
    expect(down).toEqual({ clip: 'knockdown', index: 42 });
  });

  test('losing on time shows defeat', () => {
    const result = { winner: 1 as const, reason: 'timeout' as const };
    expect(spriteFrame(fighter({ kind: 'idle' }), ctx({ result, sinceResult: 10 })).clip).toBe('defeat');
  });

  test('crouch and block hold their last frame', () => {
    expect(spriteFrame(fighter({ kind: 'crouch' }), ctx({ actionTicks: 100 }))).toEqual({ clip: 'crouch', index: 6 });
    expect(spriteFrame(fighter({ kind: 'blockstun', frames: 3 }), ctx({ actionTicks: 100 })).clip).toBe('block');
  });
});
