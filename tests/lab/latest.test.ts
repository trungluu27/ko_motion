import { expect, test } from 'vitest';
import { Latest } from '../../src/lab/latest';

test('only the most recently started request is current', () => {
  const l = new Latest();
  const a = l.begin();
  const b = l.begin();
  expect(l.isCurrent(a)).toBe(false);
  expect(l.isCurrent(b)).toBe(true);
});
