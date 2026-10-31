import type { Fighter, MoveId, SimEvent } from '../sim/types';

/** Scale factors applied to the difficulty's probabilities; each stays within ±30%. */
export type Multipliers = { block: number; dodge: number; aggression: number; counter: number; kickBias: number };

export const NEUTRAL: Readonly<Multipliers> = Object.freeze({ block: 1, dodge: 1, aggression: 1, counter: 1, kickBias: 1 });

const WINDOW_FRAMES = 20 * 60;
const MIN_ATTACKS = 5;
const UP = 1.3;
const DOWN = 0.7;

type Entry = { frame: number; kind: 'punch' | 'kick' | 'special' | 'block' | 'dodge' | 'ai_attack' };

const kindOf = (move: MoveId | undefined): Entry['kind'] =>
  move === 'kick_l' || move === 'kick_r' ? 'kick' : move === 'special' ? 'special' : 'punch';

/** Rolling 20-second record of the player's habits (concept doc 5.3) turned into AI multipliers. */
export class PlayerStats {
  private entries: Entry[] = [];
  private lastAction: Fighter['action']['kind'] = 'idle';

  observe(events: SimEvent[], player: Fighter, playerIndex: 0 | 1, frame: number): void {
    for (const e of events) {
      if (e.type !== 'attack') continue;
      this.entries.push({ frame, kind: e.fighter === playerIndex ? kindOf(e.move) : 'ai_attack' });
    }
    const kind = player.action.kind;
    if ((kind === 'block' || kind === 'dodge') && kind !== this.lastAction) this.entries.push({ frame, kind });
    this.lastAction = kind;
    const cutoff = frame - WINDOW_FRAMES;
    while (this.entries.length && this.entries[0].frame <= cutoff) this.entries.shift();
  }

  multipliers(frame: number): Multipliers {
    const recent = this.entries.filter((e) => e.frame > frame - WINDOW_FRAMES);
    const count = (k: Entry['kind']) => recent.filter((e) => e.kind === k).length;
    const punches = count('punch');
    const kicks = count('kick');
    const attacks = punches + kicks + count('special');
    const blocks = count('block');
    const aiAttacks = count('ai_attack');
    const m: Multipliers = { ...NEUTRAL };

    if (attacks >= MIN_ATTACKS) {
      if (punches / attacks > 0.6) m.block = UP;
      if (kicks / attacks > 0.4) {
        m.dodge = UP;
        m.kickBias = DOWN;
      }
      const seconds = Math.max(1, Math.min(frame, WINDOW_FRAMES) / 60);
      if (attacks / seconds > 1) m.counter = UP;
    }
    if (blocks >= 5 || (aiAttacks > 0 && blocks >= 0.3 * aiAttacks)) {
      m.aggression = UP;
      m.kickBias = UP;
    }
    return m;
  }
}
