import type { EngineOutput } from '../../motion/motionEngine';
import { type ControlState, DEFAULT_STATE, type DiscreteAction } from '../../shared/types';
import { type MoveId, NO_INPUT, type TickInput } from '../sim/types';
import { STALE_OUTPUT_MS } from '../trackingPause';

/** Body events older than this when a tick consumes them are dropped (spec 7). */
export const MAX_EVENT_AGE_MS = 250;

/** Turns motion-engine outputs into one TickInput per sim tick. */
export class MotionInput {
  private queue: { action: DiscreteAction; t: number }[] = [];
  private state: ControlState = { ...DEFAULT_STATE };
  private lastPushAt: number | null = null;

  push(out: EngineOutput, receivedAt = performance.now()): void {
    this.lastPushAt = receivedAt;
    for (const e of out.events) this.queue.push({ action: e.action, t: e.t });
    this.state = out.tracking === 'ok' ? { ...out.state } : { ...DEFAULT_STATE };
  }

  /** One attack per tick; a jump is only taken on a tick without an attack. */
  next(now: number): TickInput {
    this.queue = this.queue.filter((e) => now - e.t <= MAX_EVENT_AGE_MS);
    // no engine output for a while (camera gone): release held moves and guards
    if (this.lastPushAt !== null && now - this.lastPushAt > STALE_OUTPUT_MS) this.state = { ...DEFAULT_STATE };
    const attackIdx = this.queue.findIndex((e) => e.action !== 'jump');
    let attack: MoveId | null = null;
    let jump = false;
    if (attackIdx >= 0) {
      attack = this.queue.splice(attackIdx, 1)[0].action as MoveId;
    } else {
      const jumpIdx = this.queue.findIndex((e) => e.action === 'jump');
      if (jumpIdx >= 0) {
        this.queue.splice(jumpIdx, 1);
        jump = true;
      }
    }
    return {
      ...NO_INPUT,
      attack,
      jump,
      block: this.state.block,
      crouch: this.state.crouch,
      dodge: this.state.dodge !== 0,
      move: this.state.move,
    };
  }

  clear(): void {
    this.queue = [];
  }
}
