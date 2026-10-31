import { describe, expect, test } from 'vitest';
import { OneEuroFilter, PoseSmoother } from '../../src/motion/oneEuro';
import { DEFAULT_CONFIG } from '../../src/motion/config';
import { synthFrame } from '../helpers/synthPose';

const { minCutoff, beta, dCutoff } = DEFAULT_CONFIG.oneEuro;
const stdev = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe('OneEuroFilter', () => {
  test('constant signal passes through unchanged', () => {
    const f = new OneEuroFilter(minCutoff, beta, dCutoff);
    for (let i = 0; i < 30; i++) expect(f.filter(5, i * 33.3)).toBeCloseTo(5, 9);
  });

  test('reduces jitter by more than half', () => {
    const f = new OneEuroFilter(minCutoff, beta, dCutoff);
    const rnd = lcg(42);
    const input: number[] = [];
    const output: number[] = [];
    for (let i = 0; i < 300; i++) {
      const x = 5 + (rnd() - 0.5) * 0.1;
      input.push(x);
      output.push(f.filter(x, i * 33.3));
    }
    expect(stdev(output.slice(30))).toBeLessThan(0.5 * stdev(input.slice(30)));
  });

  test('follows a step within 10 frames at 30 fps', () => {
    const f = new OneEuroFilter(minCutoff, beta, dCutoff);
    f.filter(0, 0);
    let y = 0;
    for (let i = 1; i <= 10; i++) y = f.filter(1, i * 33.3);
    expect(y).toBeGreaterThan(0.9);
  });
});

describe('PoseSmoother', () => {
  test('smooths image and world coordinates, keeps visibility', () => {
    const s = new PoseSmoother(DEFAULT_CONFIG.oneEuro);
    s.smooth(synthFrame({ hipX: 0.5 }, 0));
    const out = s.smooth(synthFrame({ hipX: 0.6, visibility: 0.7 }, 33));
    expect(out.image[0].x).toBeGreaterThan(0.5);
    expect(out.image[0].x).toBeLessThan(0.6);
    expect(out.image[0].visibility).toBe(0.7);
    expect(out.world).toHaveLength(33);
  });
});
