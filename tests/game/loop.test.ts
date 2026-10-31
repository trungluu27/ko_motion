import { expect, test } from 'vitest';
import { FixedStep } from '../../src/game/loop';

test('one 60 Hz frame of time yields one tick', () => {
  expect(new FixedStep().advance(16.7)).toBe(1);
});

test('a huge delta (tab was hidden) is capped at 5 ticks and the backlog is dropped', () => {
  const s = new FixedStep();
  expect(s.advance(5000)).toBe(5);
  expect(s.advance(0)).toBe(0);
});

test('leftover time carries over to the next frame', () => {
  const s = new FixedStep();
  expect(s.advance(10)).toBe(0);
  expect(s.advance(10)).toBe(1);
});
