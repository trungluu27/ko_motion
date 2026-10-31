import { describe, expect, test } from 'vitest';
import { keyboardControl } from '../../src/game/input/keyboardMap';
import { IntentBuilder } from '../../src/game/input/intent';
import { DummyInput } from '../../src/game/input/dummyInput';

const keys = (down: string[], pressed: string[] = []) => ({ down: new Set(down), pressed: new Set(pressed) });
const tickFrom = (down: string[], pressed: string[] = []) => {
  const b = new IntentBuilder();
  b.push(keyboardControl(keys(down, pressed), 0));
  return b;
};

describe('keyboard → intent', () => {
  test('holding D walks right and A walks left', () => {
    expect(tickFrom(['KeyD']).next().move).toBe(1);
    expect(tickFrom(['KeyA']).next().move).toBe(-1);
  });

  test('pressing J attacks with punch_l for exactly one tick', () => {
    const b = tickFrom(['KeyJ'], ['KeyJ']);
    expect(b.next().attack).toBe('punch_l');
    expect(b.next().attack).toBeNull();
  });

  test('J and K in the same tick queue punch_l then punch_r', () => {
    const b = tickFrom(['KeyJ', 'KeyK'], ['KeyJ', 'KeyK']);
    expect([b.next().attack, b.next().attack]).toEqual(['punch_l', 'punch_r']);
  });

  test('U/I kick, W jumps, S crouches, Space blocks, Q/E dodge', () => {
    expect(tickFrom(['KeyU'], ['KeyU']).next().attack).toBe('kick_l');
    expect(tickFrom(['KeyI'], ['KeyI']).next().attack).toBe('kick_r');
    expect(tickFrom(['KeyW'], ['KeyW']).next().jump).toBe(true);
    expect(tickFrom(['KeyS']).next().crouch).toBe(true);
    expect(tickFrom(['Space']).next().block).toBe(true);
    expect(tickFrom(['KeyQ']).next().dodge).toBe(true);
    expect(tickFrom(['KeyE']).next().dodge).toBe(true);
  });

  test('a held key without a fresh press does not attack again', () => {
    expect(tickFrom(['KeyJ']).next().attack).toBeNull();
  });
});

describe('DummyInput', () => {
  test('jab mode throws punch_l every 120 frames', () => {
    const d = new DummyInput('jab');
    const attacks = Array.from({ length: 300 }, (_, f) => d.next(f).attack).map((a, f) => (a ? f : -1)).filter((f) => f >= 0);
    expect(attacks).toEqual([120, 240]);
  });
  test('block mode always blocks; idle does nothing', () => {
    expect(new DummyInput('block').next(5).block).toBe(true);
    expect(new DummyInput('idle').next(120)).toMatchObject({ attack: null, block: false, move: 0 });
  });
});
