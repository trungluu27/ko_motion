import { describe, expect, test } from 'vitest';
import { createRng } from '../../src/shared/rng';
import { MATCH_FRAMES, MAX_HP } from '../../src/game/sim/constants';
import { createMatch } from '../../src/game/sim/match';
import { DUMMY_REFILL_TICKS, trainingTick } from '../../src/game/training/dummy';
import { DRILL_MOVES, Drill, type DrillMove, PROMPT_MS } from '../../src/game/training/drill';
import type { ActionEvent } from '../../src/shared/types';

describe('sandbag (spec phase5 5)', () => {
  test('the player never loses HP and the clock never runs down', () => {
    const m = createMatch();
    m.fighters[0].hp = 40;
    m.framesLeft = 10;
    trainingTick(m, 0);
    expect(m.fighters[0].hp).toBe(MAX_HP);
    expect(m.framesLeft).toBe(MATCH_FRAMES);
  });

  test('the sandbag refills only after a quiet spell', () => {
    const m = createMatch();
    m.fighters[1].hp = 30;
    trainingTick(m, DUMMY_REFILL_TICKS - 1);
    expect(m.fighters[1].hp).toBe(30);
    trainingTick(m, DUMMY_REFILL_TICKS);
    expect(m.fighters[1].hp).toBe(MAX_HP);
  });

  test('the sandbag is never knocked out', () => {
    const m = createMatch();
    m.fighters[1].hp = 0;
    m.result = { winner: 0, reason: 'ko' };
    m.fighters[1].action = { kind: 'ko' };
    trainingTick(m, 0);
    expect(m.result).toBeNull();
    expect(m.fighters[1].hp).toBeGreaterThan(0);
    expect(m.fighters[1].action.kind).toBe('idle');
  });
});

const ev = (action: ActionEvent['action'], t: number): ActionEvent => ({ action, confidence: 1, t, frameId: 0 });
const none = { events: [] as ActionEvent[], block: false };

/** Steps the drill in 10 ms ticks until it shows a prompt; returns the time. */
function untilPrompt(d: Drill, t: number): number {
  for (let i = 0; i < 1000; i++, t += 10) if (d.update(t, none).phase === 'prompt') return t;
  throw new Error('no prompt');
}

/** Answers a prompt correctly. */
const answer = (move: DrillMove, t: number) => (move === 'block' ? { events: [], block: true } : { events: [ev(move, t)], block: false });

describe('drill (spec phase5 5)', () => {
  test('runs 12 rounds then is done', () => {
    const d = new Drill(createRng(1));
    let t = 0;
    for (let r = 0; r < 12; r++) {
      t = untilPrompt(d, t);
      const prompt = d.update(t, none).prompt!;
      d.update(t + 300, answer(prompt, t + 300));
      t += 310;
    }
    for (let i = 0; i < 300; i++, t += 10) d.update(t, none);
    expect(d.update(t, none).phase).toBe('done');
    expect(d.summary().accuracy).toBe(1);
    expect(d.summary().meanReactionMs).toBeCloseTo(300, 0);
  });

  test('never calls the same move three times in a row', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const seq = new Drill(createRng(seed)).sequence;
      expect(seq.length).toBe(12);
      for (let i = 2; i < seq.length; i++) expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false);
      expect(seq.every((m) => DRILL_MOVES.includes(m))).toBe(true);
    }
  });

  test('a wrong move is wrong; silence until the deadline is a miss', () => {
    const d = new Drill(createRng(2));
    let t = untilPrompt(d, 0);
    const p = d.update(t, none).prompt!;
    const other: DrillMove = p === 'punch_l' ? 'kick_r' : 'punch_l';
    expect(d.update(t + 200, answer(other, t + 200)).last).toMatchObject({ move: p, outcome: 'wrong' });
    t = untilPrompt(d, t + 210);
    const p2 = d.update(t, none).prompt!;
    expect(d.update(t + PROMPT_MS + 1, none).last).toMatchObject({ move: p2, outcome: 'miss', reactionMs: null });
  });

  test('events from before the prompt are ignored', () => {
    const d = new Drill(createRng(3));
    const t = untilPrompt(d, 0);
    const p = d.update(t, none).prompt!;
    const stale = p === 'block' ? { events: [ev('punch_l', t - 50)], block: false } : { events: [ev(p, t - 50)], block: false };
    expect(d.update(t + 20, stale).phase).toBe('prompt');
  });

  test('summary counts per move', () => {
    const d = new Drill(createRng(4), { rounds: 2 });
    let t = untilPrompt(d, 0);
    const a = d.update(t, none).prompt!;
    d.update(t + 400, answer(a, t + 400));
    t = untilPrompt(d, t + 410);
    const b = d.update(t, none).prompt!;
    d.update(t + PROMPT_MS + 1, none);
    const s = d.summary();
    expect(s.accuracy).toBe(0.5);
    expect(s.meanReactionMs).toBeCloseTo(400, 0);
    expect(s.perMove[a].hit).toBeGreaterThanOrEqual(1);
    expect(s.perMove[b].total).toBeGreaterThanOrEqual(1);
  });
});
