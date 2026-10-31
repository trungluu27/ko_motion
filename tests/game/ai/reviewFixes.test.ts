import { describe, expect, test } from 'vitest';
import { AiBrain } from '../../../src/game/ai/fsm';
import { createRng } from '../../../src/shared/rng';
import { ctx, params, seenAt } from './helpers';

describe('AI review fixes', () => {
  test('a full special meter with too little stamina does not press attacks (no tired spam)', () => {
    const brain = new AiBrain(createRng(1));
    const out = Array.from({ length: 30 }, (_, frame) =>
      brain.next(ctx({ frame, self: { special: 100, stamina: 4, x: 965 }, seen: seenAt(870) })),
    );
    expect(out.every((i) => i.attack === null)).toBe(true);
  });

  test('being hit mid-combo drops the rest of the combo', () => {
    const brain = new AiBrain(createRng(3));
    const p = params({ aggression: 1, comboLen: 3 });
    const first = brain.next(ctx({ frame: 0, seen: seenAt(520), params: p }));
    expect(first.attack).not.toBeNull();
    for (let frame = 1; frame <= 14; frame++) {
      brain.next(ctx({ frame, seen: seenAt(520), params: p, self: { action: { kind: 'hitstun', frames: 15 - frame } } }));
    }
    // knocked back out of punch range, now free again
    const after = brain.next(ctx({ frame: 15, seen: seenAt(400), params: params({ comboLen: 3 }) }));
    expect(after.attack).toBeNull();
  });
});
