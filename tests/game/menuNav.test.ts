import { describe, expect, test } from 'vitest';
import { routeLaunch } from '../../src/game/launch';
import { menuNav } from '../../src/game/menuNav';
import { DEFAULT_SETTINGS } from '../../src/game/settings';

describe('menuNav', () => {
  test('up/down move and wrap around', () => {
    expect(menuNav(0, 4, 'ArrowDown')).toEqual({ index: 1, action: 'none' });
    expect(menuNav(3, 4, 'KeyS')).toEqual({ index: 0, action: 'none' });
    expect(menuNav(0, 4, 'ArrowUp')).toEqual({ index: 3, action: 'none' });
    expect(menuNav(2, 4, 'KeyW')).toEqual({ index: 1, action: 'none' });
  });

  test('select, back, left and right keep the index', () => {
    expect(menuNav(2, 4, 'Enter')).toEqual({ index: 2, action: 'select' });
    expect(menuNav(2, 4, 'Space')).toEqual({ index: 2, action: 'select' });
    expect(menuNav(2, 4, 'Escape')).toEqual({ index: 2, action: 'back' });
    expect(menuNav(2, 4, 'ArrowLeft').action).toBe('left');
    expect(menuNav(2, 4, 'KeyA').action).toBe('left');
    expect(menuNav(2, 4, 'ArrowRight').action).toBe('right');
    expect(menuNav(2, 4, 'KeyD').action).toBe('right');
    expect(menuNav(2, 4, 'KeyZ')).toEqual({ index: 2, action: 'none' });
  });
});

describe('routeLaunch (spec phase5 2)', () => {
  const s = (over = {}) => ({ ...DEFAULT_SETTINGS, ...over });

  test('first time on the keyboard: safety, then the fight', () => {
    expect(routeLaunch({ mode: 'fight', opponent: 'normal' }, s())).toEqual(['safety', 'fight']);
  });

  test('acknowledged and on the keyboard: straight in', () => {
    expect(routeLaunch({ mode: 'dummy' }, s({ safetyAck: true }))).toEqual(['fight']);
    expect(routeLaunch({ mode: 'drill' }, s({ safetyAck: true }))).toEqual(['drill']);
  });

  test('body control goes through calibration', () => {
    expect(routeLaunch({ mode: 'fight', opponent: 'hard' }, s({ control: 'body' }))).toEqual(['safety', 'calibration', 'fight']);
    expect(routeLaunch({ mode: 'drill' }, s({ control: 'body', safetyAck: true }))).toEqual(['calibration', 'drill']);
  });
});
