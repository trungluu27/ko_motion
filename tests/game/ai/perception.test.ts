import { expect, test } from 'vitest';
import { Perception } from '../../../src/game/ai/perception';
import { createMatch } from '../../../src/game/sim/match';

test('the opponent is seen reactionFrames ticks late', () => {
  const f = createMatch().fighters[0];
  const p = new Perception(3);
  f.x = 1; p.observe(f);
  f.x = 2; p.observe(f);
  expect(p.seen()).toBeNull();
  f.x = 3; p.observe(f);
  f.x = 4; p.observe(f);
  expect(p.seen()?.x).toBe(1);
});

test('stored snapshots are copies', () => {
  const f = createMatch().fighters[0];
  const p = new Perception(0);
  f.action = { kind: 'jump', frame: 3 };
  p.observe(f);
  if (f.action.kind === 'jump') f.action.frame = 10;
  expect(p.seen()?.action).toEqual({ kind: 'jump', frame: 3 });
});

test('the buffer never grows beyond reactionFrames + 1', () => {
  const f = createMatch().fighters[0];
  const p = new Perception(5);
  for (let i = 0; i < 100; i++) p.observe(f);
  expect(p.size).toBe(6);
});
