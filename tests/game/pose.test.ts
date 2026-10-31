import { describe, expect, test } from 'vitest';
import { poseFor } from '../../src/game/render/pose';
import { hudModel } from '../../src/game/render/hudModel';
import { createMatch } from '../../src/game/sim/match';
import type { Action, Fighter } from '../../src/game/sim/types';

const fighter = (action: Action): Fighter => ({ ...createMatch().fighters[0], action });
const attack = (move: 'punch_l' | 'kick_r', frame: number): Action => ({ kind: 'attack', move, frame, hasHit: false, evaded: false, combo: null });

describe('poseFor', () => {
  test('idle keeps the lead arm bent in guard', () => {
    expect(poseFor(fighter({ kind: 'idle' })).armFront.b).toBeGreaterThan(1.2);
  });
  test('a jab on its active frame straightens the lead arm', () => {
    expect(poseFor(fighter(attack('punch_l', 4))).armFront.b).toBeLessThan(0.2);
  });
  test('a rear kick raises the back leg toward horizontal', () => {
    expect(poseFor(fighter(attack('kick_r', 10))).legBack.a).toBeGreaterThan(1.2);
  });
  test('crouching lowers the body and KO lies down', () => {
    expect(poseFor(fighter({ kind: 'crouch' })).crouch).toBeGreaterThan(0);
    expect(poseFor(fighter({ kind: 'ko' })).lying).toBe(true);
  });
});

describe('hudModel', () => {
  test('a fresh match shows full bars and 99 seconds', () => {
    expect(hudModel(createMatch())).toEqual({ hp: [1, 1], stamina: [1, 1], special: [0, 0], seconds: 99, result: null });
  });
  test('results are shown from the player (fighter 0) perspective', () => {
    const m = createMatch();
    m.result = { winner: 0, reason: 'ko' };
    expect(hudModel(m).result).toBe('YOU WIN');
    m.result = { winner: 1, reason: 'timeout' };
    expect(hudModel(m).result).toBe('YOU LOSE');
    m.result = { winner: null, reason: 'timeout' };
    expect(hudModel(m).result).toBe('DRAW');
  });
});
