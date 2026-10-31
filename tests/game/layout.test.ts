import { describe, expect, test } from 'vitest';
import { VIEW_MODES, arenaView, layoutFor } from '../../src/game/layout';

describe('layoutFor', () => {
  test('split puts the webcam left and the arena right', () => {
    expect(layoutFor('split')).toEqual({ arena: { x: 480, y: 0, w: 800, h: 720 }, webcam: { x: 0, y: 0, w: 480, h: 720 } });
  });
  test('pip keeps the full arena with a small webcam top-right under the HUD', () => {
    expect(layoutFor('pip')).toEqual({ arena: { x: 0, y: 0, w: 1280, h: 720 }, webcam: { x: 944, y: 90, w: 320, h: 180 } });
  });
  test('game mode has no webcam', () => {
    expect(layoutFor('game').webcam).toBeNull();
  });
  test('V cycles split → pip → game', () => {
    expect(VIEW_MODES).toEqual(['split', 'pip', 'game']);
  });
});

describe('arenaView', () => {
  test('maps the 1000-unit arena into the split region with scaled bodies', () => {
    const v = arenaView(layoutFor('split').arena);
    expect(v.toScreen(0)).toBeCloseTo(505, 9);
    expect(v.toScreen(1000)).toBeCloseTo(1255, 9);
    expect(v.bodyScale).toBeCloseTo(0.625, 9);
    expect(v.groundY).toBe(620);
  });
  test('the full-width arena matches the phase 2 mapping', () => {
    const v = arenaView(layoutFor('game').arena);
    expect([v.toScreen(0), v.toScreen(1000), v.bodyScale]).toEqual([40, 1240, 1]);
  });
});
