import { describe, expect, test } from 'vitest';
import { FpsCounter, LatencyStats } from '../../src/lab/latencyStats';

describe('LatencyStats', () => {
  test('is empty until samples arrive', () => {
    const s = new LatencyStats();
    expect(s.p50()).toBeNull();
    expect(s.p95()).toBeNull();
  });
  test('reports interpolated percentiles', () => {
    const s = new LatencyStats();
    for (let i = 1; i <= 100; i++) s.add(i);
    expect(s.p50()).toBeCloseTo(50.5, 9);
    expect(s.p95()).toBeCloseTo(95.05, 9);
  });
  test('drops the oldest samples beyond capacity', () => {
    const s = new LatencyStats(3);
    for (const x of [1000, 1, 2, 3]) s.add(x);
    expect(s.p95()).toBeLessThanOrEqual(3);
  });
});

test('FpsCounter counts ticks within the last second', () => {
  const c = new FpsCounter();
  for (let i = 0; i < 60; i++) c.tick(i * 33.3);
  expect(c.fps()).toBe(31);
});
