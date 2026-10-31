import { describe, expect, test } from 'vitest';
import { angleDeg, clamp01, median, percentile } from '../../src/shared/math';

describe('angleDeg', () => {
  test('right angle at vertex is 90', () => {
    expect(angleDeg({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90, 9);
  });
  test('collinear points give 180', () => {
    expect(angleDeg({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 })).toBeCloseTo(180, 9);
  });
});

describe('statistics', () => {
  test('median of odd and even lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  test('percentile interpolates linearly', () => {
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(xs, 95)).toBeCloseTo(95.05, 9);
    expect(percentile(xs, 50)).toBeCloseTo(50.5, 9);
  });
});

test('clamp01 bounds to [0,1]', () => {
  expect(clamp01(-1)).toBe(0);
  expect(clamp01(2)).toBe(1);
  expect(clamp01(0.3)).toBe(0.3);
});
