import { describe, expect, test } from 'vitest';
import { AiInput } from '../../../src/game/ai/aiInput';
import type { Difficulty } from '../../../src/game/ai/difficulty';
import { telegraphFor } from '../../../src/game/sim/constants';
import { createMatch, stepMatch } from '../../../src/game/sim/match';
import { MOVES } from '../../../src/game/sim/moves';
import { type Match, type MoveId, NO_INPUT, type TickInput } from '../../../src/game/sim/types';

/** A keyboard player that walks into range of one move and presses it whenever free. */
const spammer = (move: MoveId) => (m: Match): TickInput => {
  const [p, ai] = m.fighters;
  if (Math.abs(ai.x - p.x) > MOVES[move].range) return { ...NO_INPUT, move: Math.sign(ai.x - p.x) as -1 | 1 };
  const free = ['idle', 'walk', 'crouch', 'block'].includes(p.action.kind);
  return free ? { ...NO_INPUT, attack: move } : { ...NO_INPUT };
};
const idle = (): TickInput => ({ ...NO_INPUT });

const SEEDS = 20;

function play(diff: Difficulty, bot: (m: Match) => TickInput, telegraph = telegraphFor('keyboard')) {
  let aiWins = 0;
  const moves: Record<string, number> = {};
  for (let seed = 1; seed <= SEEDS; seed++) {
    const m = createMatch({ extraStartup: [0, telegraph] });
    const ai = new AiInput(diff, 1, seed);
    while (!m.result) {
      stepMatch(m, [bot(m), ai.next(m)]);
      for (const e of m.events) if (e.type === 'attack' && e.fighter === 1 && e.move) moves[e.move] = (moves[e.move] ?? 0) + 1;
    }
    if (m.result.winner === 1) aiWins++;
  }
  return { aiWins, moves };
}

const SPAMS: MoveId[] = ['kick_r', 'kick_l', 'punch_l'];
const kickShare = (moves: Record<string, number>) => {
  const total = Object.values(moves).reduce((a, b) => a + b, 0);
  return ((moves.kick_l ?? 0) + (moves.kick_r ?? 0)) / Math.max(1, total);
};

describe('difficulty ladder (spec ai-difficulty 3)', () => {
  test.each(SPAMS)('Hard beats a %s spammer at least 16/20', (move) => {
    expect(play('hard', spammer(move)).aiWins).toBeGreaterThanOrEqual(16);
  });

  test.each(SPAMS)('Normal beats a %s spammer at least 10/20', (move) => {
    expect(play('normal', spammer(move)).aiWins).toBeGreaterThanOrEqual(10);
  });

  test('Easy stays easier than Normal against spammers', () => {
    const wins = (d: Difficulty) => SPAMS.reduce((n, mv) => n + play(d, spammer(mv)).aiWins, 0);
    expect(wins('easy')).toBeLessThan(wins('normal'));
  });

  test.each(['normal', 'hard'] as const)('%s kicks in at least a quarter of its attacks', (diff) => {
    expect(kickShare(play(diff, idle).moves)).toBeGreaterThanOrEqual(0.25);
  });

  test('Hard still wins with the body-control telegraph', () => {
    expect(play('hard', spammer('kick_r'), telegraphFor('body')).aiWins).toBeGreaterThanOrEqual(10);
  });
});
