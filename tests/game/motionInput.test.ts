import { describe, expect, test } from 'vitest';
import { MotionInput } from '../../src/game/input/motionInput';
import type { EngineOutput } from '../../src/motion/motionEngine';
import { type ActionEvent, type ControlState, DEFAULT_STATE, type DiscreteAction, type TrackingStatus } from '../../src/shared/types';

const ev = (action: DiscreteAction, t: number): ActionEvent => ({ action, confidence: 1, t, frameId: 0 });
const out = (events: ActionEvent[], state: Partial<ControlState> = {}, tracking: TrackingStatus = 'ok', t = 0): EngineOutput => ({
  t, events, state: { ...DEFAULT_STATE, ...state }, tracking, latencyMs: null, needsRecalibration: false, features: null,
});

describe('MotionInput', () => {
  test('a fresh punch becomes one attack', () => {
    const mi = new MotionInput();
    mi.push(out([ev('punch_l', 1000)]));
    expect(mi.next(1100).attack).toBe('punch_l');
    expect(mi.next(1116).attack).toBeNull();
  });

  test('events older than 250 ms are dropped (e.g. queued during a pause)', () => {
    const mi = new MotionInput();
    mi.push(out([ev('punch_l', 1000)]));
    expect(mi.next(1300).attack).toBeNull();
  });

  test('two punches in one frame attack on consecutive ticks', () => {
    const mi = new MotionInput();
    mi.push(out([ev('punch_l', 1000), ev('punch_r', 1000)]));
    expect([mi.next(1010).attack, mi.next(1026).attack]).toEqual(['punch_l', 'punch_r']);
  });

  test('a jump arriving with a punch waits for the next tick', () => {
    const mi = new MotionInput();
    mi.push(out([ev('jump', 1000), ev('punch_r', 1000)]));
    const a = mi.next(1010);
    const b = mi.next(1026);
    expect([a.attack, a.jump]).toEqual(['punch_r', false]);
    expect([b.attack, b.jump]).toEqual([null, true]);
  });

  test('held states pass through; dodge either side dodges', () => {
    const mi = new MotionInput();
    mi.push(out([], { block: true, move: 1, dodge: -1 }));
    expect(mi.next(0)).toMatchObject({ block: true, move: 1, dodge: true, crouch: false });
  });

  test('lost tracking releases every held state', () => {
    const mi = new MotionInput();
    mi.push(out([], { block: true, move: 1 }, 'ok'));
    mi.push(out([], { block: true, move: 1 }, 'partial'));
    expect(mi.next(0)).toMatchObject({ block: false, move: 0 });
  });

  test('clear empties the queue', () => {
    const mi = new MotionInput();
    mi.push(out([ev('kick_r', 1000)]));
    mi.clear();
    expect(mi.next(1010).attack).toBeNull();
  });
});
