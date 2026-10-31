import { type ControlFrame, DEFAULT_STATE, type DiscreteAction } from '../../shared/types';
import { NO_INPUT, type MoveId, type TickInput } from '../sim/types';

/** Turns a stream of ControlFrames (keyboard, body or AI) into one TickInput per sim tick. */
export class IntentBuilder {
  private queue: DiscreteAction[] = [];
  private state = { ...DEFAULT_STATE };

  push(c: ControlFrame): void {
    for (const e of c.events) this.queue.push(e.action);
    this.state = { ...c.state };
  }

  /** One attack per tick from the queue; a queued jump is consumed together with it. */
  next(): TickInput {
    const attackIdx = this.queue.findIndex((a) => a !== 'jump');
    const attack = attackIdx >= 0 ? (this.queue.splice(attackIdx, 1)[0] as MoveId) : null;
    const jumpIdx = this.queue.indexOf('jump');
    if (jumpIdx >= 0) this.queue.splice(jumpIdx, 1);
    return {
      ...NO_INPUT,
      attack,
      jump: jumpIdx >= 0,
      block: this.state.block,
      crouch: this.state.crouch,
      dodge: this.state.dodge !== 0,
      move: this.state.move,
    };
  }
}
