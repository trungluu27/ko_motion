import { describe, expect, test } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, nextBg } from '../../src/game/settings';
import { maskToAlpha } from '../../src/view/personMatte';

const store = (v: object): Storage => {
  const m = new Map([['bf.settings', JSON.stringify(v)]]);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, x: string) => void m.set(k, x) } as unknown as Storage;
};

describe('webcam background setting (spec webcam-background 2)', () => {
  test('defaults to the real camera; unknown values fall back', () => {
    expect(DEFAULT_SETTINGS.webcamBg).toBe('off');
    expect(loadSettings(store({ webcamBg: 'beach' })).webcamBg).toBe('off');
    expect(loadSettings(store({ webcamBg: 'neon' })).webcamBg).toBe('neon');
  });

  test('B cycles through the four backgrounds', () => {
    expect(nextBg('off')).toBe('blur');
    expect(nextBg('blur')).toBe('neon');
    expect(nextBg('neon')).toBe('studio');
    expect(nextBg('studio')).toBe('off');
  });
});

describe('maskToAlpha', () => {
  test('samples every step-th pixel into an alpha channel', () => {
    // 8×4 mask: left half person (1), right half background (0)
    const w = 8, h = 4;
    const data = new Float32Array(w * h).map((_, i) => (i % w < 4 ? 1 : 0));
    const a = maskToAlpha(data, w, h, 2);
    expect(a.w).toBe(4);
    expect(a.h).toBe(2);
    expect(a.alpha.length).toBe(4 * 2);
    expect(Array.from(a.alpha)).toEqual([255, 255, 0, 0, 255, 255, 0, 0]);
  });

  test('partial confidence becomes partial alpha and sizes round up', () => {
    const a = maskToAlpha(new Float32Array([0.5, 0.25, 1]), 3, 1, 2);
    expect(a.w).toBe(2);
    expect(a.h).toBe(1);
    expect(Array.from(a.alpha)).toEqual([128, 255]);
  });
});
