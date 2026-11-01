import { createRng } from '../../shared/rng';
import { type Match, NO_INPUT, type TickInput } from '../sim/types';
import { NEUTRAL, PlayerStats } from './adaptive';
import { DIFFICULTIES, type Difficulty, msToFrames } from './difficulty';
import { AiBrain } from './fsm';
import { Perception } from './perception';

/** An AI-controlled fighter: perceives the opponent with a reaction delay, adapts (Normal/Hard), and decides via AiBrain. */
export class AiInput {
  private readonly perception: Perception;
  private readonly stats = new PlayerStats();
  private readonly brain: AiBrain;
  private readonly reactionFrames: number;

  constructor(
    readonly difficulty: Difficulty,
    private readonly self: 0 | 1,
    seed = 1,
  ) {
    this.reactionFrames = msToFrames(DIFFICULTIES[difficulty].reactionMs);
    this.perception = new Perception(this.reactionFrames);
    this.brain = new AiBrain(createRng(seed));
  }

  next(m: Match): TickInput {
    if (m.result) return { ...NO_INPUT };
    const params = DIFFICULTIES[this.difficulty];
    const other = (1 - this.self) as 0 | 1;
    this.perception.observe(m.fighters[other]);
    if (params.adaptive) this.stats.observe(m.events, m.fighters[other], other, m.frame);
    return this.brain.next({
      self: m.fighters[this.self],
      seen: this.perception.seen(),
      reactionFrames: this.reactionFrames,
      frame: m.frame,
      params,
      mult: params.adaptive ? this.stats.multipliers(m.frame) : { ...NEUTRAL },
    });
  }
}
