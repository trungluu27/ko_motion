import type { Action, Fighter } from '../sim/types';

export type Seen = { x: number; action: Action; hp: number; stamina: number; special: number };

/** What the AI knows about its opponent: the opponent's state as it was reactionFrames ticks ago. */
export class Perception {
  private buffer: Seen[] = [];

  constructor(private readonly reactionFrames: number) {}

  observe(opponent: Fighter): void {
    this.buffer.push({
      x: opponent.x,
      action: { ...opponent.action },
      hp: opponent.hp,
      stamina: opponent.stamina,
      special: opponent.special,
    });
    if (this.buffer.length > this.reactionFrames + 1) this.buffer.shift();
  }

  seen(): Seen | null {
    return this.buffer.length > this.reactionFrames ? this.buffer[0] : null;
  }

  get size(): number {
    return this.buffer.length;
  }
}
