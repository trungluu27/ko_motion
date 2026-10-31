import { expect, test } from 'vitest';
import { type FeatureSample, pruneHistory } from '../../src/lab/debugPanel';

const s = (t: number) => ({ t }) as FeatureSample;

test('pruneHistory keeps only the recent window ending at the latest sample, whatever the order', () => {
  const replayed = [s(900_000), s(900_033)];
  const live = [s(10_000), s(14_000), s(16_100), s(17_000)];
  expect(pruneHistory([...replayed, ...live], 17_000, 6000).map((x) => x.t)).toEqual([14_000, 16_100, 17_000]);
});
