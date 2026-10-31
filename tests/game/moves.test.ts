import { expect, test } from 'vitest';
import { MOVES } from '../../src/game/sim/moves';
import { NO_INPUT } from '../../src/game/sim/types';

test('move table matches spec 6.1 frame data', () => {
  expect(MOVES).toEqual({
    punch_l: { startup: 4, active: 3, recovery: 10, damage: 5, stamina: 6, specialCost: 0, range: 110, height: 'high' },
    punch_r: { startup: 6, active: 3, recovery: 14, damage: 8, stamina: 8, specialCost: 0, range: 120, height: 'high' },
    kick_l: { startup: 8, active: 4, recovery: 18, damage: 10, stamina: 12, specialCost: 0, range: 150, height: 'mid' },
    kick_r: { startup: 10, active: 4, recovery: 20, damage: 13, stamina: 14, specialCost: 0, range: 160, height: 'mid' },
    special: { startup: 12, active: 6, recovery: 30, damage: 25, stamina: 0, specialCost: 100, range: 220, height: 'mid' },
  });
});

test('NO_INPUT does nothing', () => {
  expect(NO_INPUT).toEqual({ attack: null, block: false, crouch: false, dodge: false, move: 0, jump: false });
});
