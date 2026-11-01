import { describe, expect, test } from 'vitest';
import { NPC_TELEGRAPH, telegraphFor } from '../../src/game/sim/constants';
import { createMatch } from '../../src/game/sim/match';
import { MOVES } from '../../src/game/sim/moves';
import { press, run } from './helpers/sim';

const npcMatch = () => {
  const m = createMatch({ extraStartup: [0, NPC_TELEGRAPH] });
  m.fighters[0].x = 400;
  m.fighters[1].x = 500;
  return m;
};

describe('per-attack telegraph (spec ai-difficulty 2.1, 2.2)', () => {
  test('a punish against an opponent in recovery skips the telegraph', () => {
    const m = npcMatch();
    // the player whiffs a kick from far away
    m.fighters[1].x = 700;
    press(m, 0, { attack: 'kick_r' });
    run(m, MOVES.kick_r.startup + MOVES.kick_r.active); // now in recovery
    press(m, 1, { attack: 'punch_l' });
    const a = m.fighters[1].action;
    expect(a.kind === 'attack' && a.telegraph).toBe(0);
  });

  test('an attack while the opponent is idle or in startup keeps the full telegraph', () => {
    const m = npcMatch();
    press(m, 1, { attack: 'punch_l' });
    const a = m.fighters[1].action;
    expect(a.kind === 'attack' && a.telegraph).toBe(NPC_TELEGRAPH);

    const m2 = npcMatch();
    press(m2, 0, { attack: 'kick_r' });
    press(m2, 1, { attack: 'punch_l' });
    const b = m2.fighters[1].action;
    expect(b.kind === 'attack' && b.telegraph).toBe(NPC_TELEGRAPH);
  });

  test('the recorded telegraph decides when the hit lands', () => {
    const m = npcMatch();
    m.fighters[1].x = 700;
    press(m, 0, { attack: 'kick_r' });
    run(m, MOVES.kick_r.startup + MOVES.kick_r.active);
    // close the gap so the punish connects
    m.fighters[1].x = m.fighters[0].x + 100;
    press(m, 1, { attack: 'punch_l' });
    const hits = run(m, MOVES.punch_l.startup).filter((e) => e.type === 'hit' && e.fighter === 1);
    expect(hits.length).toBe(1);
  });

  test('keyboard control gets a shorter telegraph than body control', () => {
    expect(telegraphFor('body')).toBe(NPC_TELEGRAPH);
    expect(telegraphFor('keyboard')).toBe(12);
  });
});
