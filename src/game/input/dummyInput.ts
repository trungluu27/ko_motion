import { NO_INPUT, type TickInput } from '../sim/types';

export type DummyMode = 'idle' | 'jab' | 'block';

const JAB_EVERY = 120;

/** Sparring dummy until the Phase 4 AI exists: stands still, jabs every 2 s, or holds block. */
export class DummyInput {
  constructor(readonly mode: DummyMode) {}

  next(frame: number): TickInput {
    if (this.mode === 'block') return { ...NO_INPUT, block: true };
    if (this.mode === 'jab' && frame > 0 && frame % JAB_EVERY === 0) return { ...NO_INPUT, attack: 'punch_l' };
    return { ...NO_INPUT };
  }
}
