import { describe, expect, test } from 'vitest';
import { AiInput } from '../../../src/game/ai/aiInput';
import type { Difficulty } from '../../../src/game/ai/difficulty';
import { NPC_TELEGRAPH } from '../../../src/game/sim/constants';
import { createMatch, stepMatch } from '../../../src/game/sim/match';
import { NO_INPUT, type Match, type SimEvent, type TickInput } from '../../../src/game/sim/types';

function aiVsAi(a: Difficulty, b: Difficulty, seed: number, maxTicks = 5940) {
  const m = createMatch({ extraStartup: [NPC_TELEGRAPH, NPC_TELEGRAPH] });
  const ais = [new AiInput(a, 0, seed), new AiInput(b, 1, seed + 1000)];
  const events: SimEvent[] = [];
  for (let i = 0; i < maxTicks && !m.result; i++) {
    stepMatch(m, [ais[0].next(m), ais[1].next(m)]);
    events.push(...m.events);
  }
  return { m, events };
}

function vsIdle(difficulty: Difficulty, ticks: number, seed = 1, setup?: (m: Match) => void) {
  const m = createMatch({ extraStartup: [0, NPC_TELEGRAPH] });
  setup?.(m);
  const ai = new AiInput(difficulty, 1, seed);
  const inputs: TickInput[] = [];
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks && !m.result; i++) {
    const input = ai.next(m);
    inputs.push(input);
    stepMatch(m, [{ ...NO_INPUT }, input]);
    events.push(...m.events);
  }
  return { m, inputs, events };
}

describe('AiInput integration', () => {
  test('a Normal AI damages a player who stands still', () => {
    const { m } = vsIdle('normal', 60 * 60);
    expect(m.fighters[0].hp).toBeLessThan(100);
  });

  test('Hard vs Easy finishes the match and Easy still fights back', () => {
    const { m, events } = aiVsAi('hard', 'easy', 7);
    expect(m.result).not.toBeNull();
    expect(events.some((e) => e.type === 'attack' && e.fighter === 1)).toBe(true);
  });

  test('Normal vs Normal is a real fight: it finishes and both sides keep attacking', () => {
    const { m, events } = aiVsAi('normal', 'normal', 7);
    expect(m.result).not.toBeNull();
    for (const f of [0, 1]) expect(events.filter((e) => e.type === 'attack' && e.fighter === f).length).toBeGreaterThanOrEqual(5);
  });

  test('the same seed reproduces the same inputs', () => {
    expect(vsIdle('hard', 600, 5).inputs).toEqual(vsIdle('hard', 600, 5).inputs);
  });

  test('Hard beats Easy in at least 7 of 10 seeds', () => {
    let wins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { m } = aiVsAi('hard', 'easy', seed * 17);
      const [h, e] = m.fighters;
      if (m.result?.winner === 0 || (m.result?.winner === null && h.hp > e.hp)) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(7);
  });

  test('a new AI for a new match does not inherit anything from the previous one', () => {
    vsIdle('hard', 1200, 9);
    expect(vsIdle('hard', 300, 9).inputs).toEqual(vsIdle('hard', 300, 9).inputs);
  });

  test('returns no input once the match has a result', () => {
    const m = createMatch();
    m.result = { winner: 0, reason: 'ko' };
    expect(new AiInput('hard', 1).next(m)).toEqual(NO_INPUT);
  });

  test('a cornered, exhausted AI does not freeze', () => {
    const { m, events } = vsIdle('normal', 300, 3, (mm) => {
      mm.fighters[1].x = 30;
      mm.fighters[0].x = 130;
      mm.fighters[1].stamina = 5;
    });
    const attacked = events.some((e) => e.type === 'attack' && e.fighter === 1);
    expect(attacked || m.fighters[1].x > 35).toBe(true);
  });
});
