import { describe, expect, test } from 'vitest';
import { NEUTRAL, PlayerStats } from '../../../src/game/ai/adaptive';
import { createMatch } from '../../../src/game/sim/match';
import type { MoveId } from '../../../src/game/sim/types';

const player = createMatch().fighters[0];
const attack = (stats: PlayerStats, move: MoveId, frame: number) =>
  stats.observe([{ type: 'attack', fighter: 0, move }], player, 0, frame);

const inRange = (m: Record<string, number>) => Object.values(m).every((v) => v >= 0.7 && v <= 1.3);

describe('PlayerStats', () => {
  test('no data gives neutral multipliers', () => {
    expect(new PlayerStats().multipliers(600)).toEqual(NEUTRAL);
  });

  test('a punch-heavy player makes the AI guard more', () => {
    const s = new PlayerStats();
    for (let i = 0; i < 10; i++) attack(s, i % 2 ? 'punch_l' : 'punch_r', i * 30);
    const m = s.multipliers(300);
    expect(m.block).toBe(1.3);
    expect(inRange(m)).toBe(true);
  });

  test('a kick-heavy player makes the AI dodge more and keep its distance', () => {
    const s = new PlayerStats();
    for (let i = 0; i < 6; i++) attack(s, 'kick_r', i * 30);
    attack(s, 'punch_l', 200);
    attack(s, 'punch_l', 230);
    const m = s.multipliers(300);
    expect(m.dodge).toBe(1.3);
    expect(m.kickBias).toBe(0.7);
  });

  test('frequent blocking makes the AI more aggressive with heavier attacks', () => {
    const s = new PlayerStats();
    for (let i = 0; i < 6; i++) {
      player.action = { kind: 'block' };
      s.observe([], player, 0, i * 20);
      player.action = { kind: 'idle' };
      s.observe([], player, 0, i * 20 + 10);
    }
    const m = s.multipliers(130);
    expect(m.aggression).toBe(1.3);
    expect(m.kickBias).toBe(1.3);
  });

  test('data older than 20 seconds is ignored', () => {
    const s = new PlayerStats();
    for (let i = 0; i < 10; i++) attack(s, 'punch_l', i * 30);
    expect(s.multipliers(300 + 1200)).toEqual(NEUTRAL);
  });
});
