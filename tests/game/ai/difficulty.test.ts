import { expect, test } from 'vitest';
import { createRng } from '../../../src/shared/rng';
import { DIFFICULTIES, msToFrames } from '../../../src/game/ai/difficulty';

test('difficulty table matches spec ai-difficulty 2.4', () => {
  expect(DIFFICULTIES).toEqual({
    easy: { reactionMs: 600, aggression: 0.25, blockChance: 0.15, dodgeChance: 0.05, counterChance: 0, comboLen: 1, idlePauseMs: 1200, adaptive: false },
    normal: { reactionMs: 300, aggression: 0.5, blockChance: 0.55, dodgeChance: 0.15, counterChance: 0.65, comboLen: 2, idlePauseMs: 600, adaptive: true },
    hard: { reactionMs: 220, aggression: 0.65, blockChance: 0.65, dodgeChance: 0.25, counterChance: 0.85, comboLen: 3, idlePauseMs: 300, adaptive: true },
  });
});

test('seeded rng is deterministic, in [0,1), and seed-dependent', () => {
  const a = createRng(42);
  const b = createRng(42);
  const xs = Array.from({ length: 5 }, () => a());
  expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
  expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  expect(createRng(1)()).not.toBe(createRng(2)());
});

test('msToFrames converts at 60 Hz', () => {
  expect(msToFrames(250)).toBe(15);
  expect(msToFrames(600)).toBe(36);
});
