import { describe, expect, test } from 'vitest';
import { AiBrain } from '../../../src/game/ai/fsm';
import { createRng } from '../../../src/shared/rng';
import type { TickInput } from '../../../src/game/sim/types';
import { ctx, params, seenAt } from './helpers';

/** Runs the brain for n ticks against a fixed context; `self.action` is reset to idle each tick (as if free). */
function drive(brain: AiBrain, n: number, make: (frame: number) => ReturnType<typeof ctx>): TickInput[] {
  return Array.from({ length: n }, (_, frame) => brain.next(make(frame)));
}

describe('AiBrain – offense', () => {
  test('walks toward a distant opponent', () => {
    const brain = new AiBrain(createRng(1));
    const [first] = drive(brain, 1, (frame) => ctx({ frame, seen: seenAt(200) }));
    expect(first.move).toBe(-1);
    expect(brain.state).toBe('approach');
  });

  test('attacks within one decision when in range with aggression 1', () => {
    const brain = new AiBrain(createRng(1));
    const out = drive(brain, 6, (frame) => ctx({ frame, seen: seenAt(520), params: params({ aggression: 1 }) }));
    expect(out.some((i) => i.attack !== null)).toBe(true);
  });

  test('comboLen 2 throws a jab then a cross', () => {
    const brain = new AiBrain(createRng(3));
    const out = drive(brain, 12, (frame) => ctx({ frame, seen: seenAt(520), params: params({ aggression: 1, comboLen: 2 }) }));
    expect(out.map((i) => i.attack).filter(Boolean).slice(0, 2)).toEqual(['punch_l', 'punch_r']);
  });

  test('retreats to recover stamina', () => {
    const brain = new AiBrain(createRng(1));
    const [first] = drive(brain, 1, (frame) => ctx({ frame, self: { stamina: 10 }, seen: seenAt(520) }));
    expect(brain.state).toBe('retreat');
    expect(first.move).toBe(1);
  });

  test('does not keep retreating when pinned against the wall', () => {
    const brain = new AiBrain(createRng(1));
    const states = drive(brain, 12, (frame) => ctx({ frame, self: { stamina: 10, x: 965, facing: -1 }, seen: seenAt(870) })).map(() => brain.state);
    expect(brain.state).not.toBe('retreat');
    expect(states.length).toBe(12);
  });

  test('a full special meter in range fires jab then cross on consecutive ticks', () => {
    const brain = new AiBrain(createRng(1));
    const out = drive(brain, 2, (frame) => ctx({ frame, self: { special: 100 }, seen: seenAt(450) }));
    expect(out.map((i) => i.attack)).toEqual(['punch_l', 'punch_r']);
    expect(brain.state).toBe('special');
  });
});
