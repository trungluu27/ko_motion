import { expect, test } from 'vitest';
import { mergeInputs } from '../../src/game/input/mergeInputs';
import { NO_INPUT } from '../../src/game/sim/types';

test('the first source with an attack wins; held states are OR-ed; move follows whichever is non-zero', () => {
  const body = { ...NO_INPUT, attack: 'punch_l' as const, block: true };
  const keys = { ...NO_INPUT, attack: 'kick_r' as const, move: 1 as const, crouch: true };
  expect(mergeInputs(body, keys)).toEqual({ attack: 'punch_l', block: true, crouch: true, dodge: false, move: 1, jump: false });
});

test('falls back to the second source attack and jump when the first has none', () => {
  expect(mergeInputs(NO_INPUT, { ...NO_INPUT, attack: 'kick_l', jump: true })).toMatchObject({ attack: 'kick_l', jump: true });
});
