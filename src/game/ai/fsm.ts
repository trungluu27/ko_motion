import type { Rng } from '../../shared/rng';
import { ARENA_W, EDGE, MAX_SPECIAL } from '../sim/constants';
import { MOVES } from '../sim/moves';
import { type Fighter, type MoveId, NO_INPUT, type TickInput } from '../sim/types';
import type { Multipliers } from './adaptive';
import { DECISION_FRAMES, type DifficultyParams, msToFrames } from './difficulty';
import type { Seen } from './perception';

export type AiState = 'idle' | 'approach' | 'attack' | 'block' | 'dodge' | 'counter' | 'retreat' | 'special';

export type BrainContext = {
  self: Fighter;
  /** the opponent as perceived (reactionMs late); null until enough history */
  seen: Seen | null;
  frame: number;
  params: DifficultyParams;
  mult: Multipliers;
};

const LOW_STAMINA = 20;
const RECOVERED_STAMINA = 50;
const WALL_MARGIN = 5;
/** stop approaching here so a jab's knockback (30) still leaves the cross (range 120) in reach */
const PUNCH_DISTANCE = 85;
const POKE_DISTANCE = 150;
const MAX_PROB = 0.95;
const GUARD_DISTANCE = 170;
const GUARD_RELEASE_DISTANCE = 220;
const GUARD_MIN_FRAMES = 18;
const GUARD_EXTRA_FRAMES = 18;
const COUNTER_ORDER: MoveId[] = ['punch_l', 'punch_r', 'kick_l', 'kick_r'];

const COMBO_3: MoveId[][] = [
  ['punch_l', 'punch_r', 'kick_r'],
  ['punch_r', 'kick_l', 'kick_r'],
];

const isFree = (f: Fighter) =>
  f.action.kind === 'idle' || f.action.kind === 'walk' || f.action.kind === 'crouch' || f.action.kind === 'block';

/** Finite-state fighter AI. Re-decides every DECISION_FRAMES ticks or when its current plan finishes. */
export class AiBrain {
  private st: AiState = 'idle';
  private plan: MoveId[] = [];
  private holdUntil = 0;
  private nextDecision = 0;
  private specialStep = 0;
  /** start frame of the last opponent attack we already rolled a reaction for */
  private rolledFor: number | null = null;

  constructor(private readonly rng: Rng) {}

  get state(): AiState {
    return this.st;
  }

  private chance(p: number): boolean {
    return p > 0 && this.rng() < Math.min(MAX_PROB, p);
  }

  private pick<T>(xs: T[]): T {
    return xs[Math.floor(this.rng() * xs.length)];
  }

  next(ctx: BrainContext): TickInput {
    const { self, seen, frame } = ctx;
    if (!seen) return { ...NO_INPUT };
    // a combo interrupted by a hit or a block is abandoned rather than resumed out of range
    if ((self.action.kind === 'hitstun' || self.action.kind === 'blockstun') && this.plan.length > 0) {
      this.plan = [];
      this.st = 'idle';
      this.holdUntil = frame;
    }
    if (frame >= this.nextDecision || this.planDone(ctx)) {
      this.nextDecision = frame + DECISION_FRAMES;
      this.decide(ctx);
    }
    return this.act(ctx, Math.sign(seen.x - self.x) as -1 | 0 | 1);
  }

  /** True when the current state has nothing left to do and should not wait for the next decision tick. */
  private planDone(ctx: BrainContext): boolean {
    if (this.st === 'attack' || this.st === 'counter') return this.plan.length === 0 && isFree(ctx.self);
    if (this.st === 'dodge') return true;
    if (this.st === 'special') return this.specialStep >= 2;
    return false;
  }

  private distance(ctx: BrainContext): number {
    return Math.abs((ctx.seen?.x ?? ctx.self.x) - ctx.self.x);
  }

  private pinnedWhenRetreating(ctx: BrainContext): boolean {
    const away = -Math.sign((ctx.seen?.x ?? 0) - ctx.self.x);
    return (away < 0 && ctx.self.x <= EDGE + WALL_MARGIN) || (away > 0 && ctx.self.x >= ARENA_W - EDGE - WALL_MARGIN);
  }

  /** Rolls once per opponent attack: punish it in recovery, or dodge it during startup. */
  private react(ctx: BrainContext, d: number): boolean {
    const { seen, self, params, mult, frame } = ctx;
    const a = seen?.action;
    if (!a || !isFree(self)) return false;
    if (a.kind === 'blockstun' || (a.kind === 'attack' && a.frame >= MOVES[a.move].startup + MOVES[a.move].active)) {
      const key = a.kind === 'attack' ? frame - a.frame : -1 - frame;
      if (a.kind === 'attack' && this.rolledFor === key) return false;
      this.rolledFor = a.kind === 'attack' ? key : this.rolledFor;
      const move = COUNTER_ORDER.find((m) => MOVES[m].range >= d && self.stamina >= MOVES[m].stamina);
      if (move && this.chance(params.counterChance * mult.counter)) {
        this.st = 'counter';
        this.plan = [move];
        return true;
      }
      return false;
    }
    if (a.kind === 'attack' && a.frame < MOVES[a.move].startup && d <= MOVES[a.move].range) {
      const key = frame - a.frame;
      if (this.rolledFor === key) return false;
      this.rolledFor = key;
      if (this.chance(params.dodgeChance * mult.dodge)) {
        this.st = 'dodge';
        return true;
      }
    }
    return false;
  }

  private decide(ctx: BrainContext): void {
    const { self, params, mult, frame } = ctx;
    const d = this.distance(ctx);
    // keep finishing a combo; reactions may interrupt pauses and guards
    if ((this.st === 'attack' || this.st === 'counter') && this.plan.length > 0) return;
    if (this.react(ctx, d)) return;
    if (this.st === 'block' && d > GUARD_RELEASE_DISTANCE) this.holdUntil = frame;
    if ((this.st === 'idle' || this.st === 'block') && frame < this.holdUntil) return;
    if (this.st === 'retreat' && self.stamina < RECOVERED_STAMINA && !this.pinnedWhenRetreating(ctx)) return;

    if (self.special >= MAX_SPECIAL && d <= MOVES.special.range && isFree(self) && self.stamina >= MOVES.punch_l.stamina) {
      this.st = 'special';
      this.specialStep = 0;
      return;
    }
    if (self.stamina < LOW_STAMINA && !this.pinnedWhenRetreating(ctx)) {
      this.st = 'retreat';
      return;
    }
    if (d <= GUARD_DISTANCE && this.chance(params.blockChance * mult.block)) {
      this.st = 'block';
      this.holdUntil = frame + GUARD_MIN_FRAMES + Math.floor(this.rng() * (GUARD_EXTRA_FRAMES + 1));
      return;
    }
    const stop = mult.kickBias < 1 ? POKE_DISTANCE : PUNCH_DISTANCE;
    if (d <= stop) {
      if (this.chance(params.aggression * mult.aggression)) {
        this.st = 'attack';
        this.plan = this.chooseSequence(ctx, d);
      } else {
        this.st = 'idle';
        this.holdUntil = frame + msToFrames(params.idlePauseMs);
      }
      return;
    }
    this.st = 'approach';
  }

  private chooseSequence(ctx: BrainContext, d: number): MoveId[] {
    const { comboLen } = ctx.params;
    const kicky = ctx.mult.kickBias > 1;
    const punchesReach = d <= MOVES.punch_r.range;
    if (comboLen >= 3 && punchesReach) return [...(kicky ? COMBO_3[1] : this.pick(COMBO_3))];
    if (comboLen >= 2 && punchesReach && !kicky) return ['punch_l', 'punch_r'];
    const inRange = (['punch_l', 'punch_r', 'kick_l', 'kick_r'] as MoveId[]).filter((m) => MOVES[m].range >= d);
    const kicks = inRange.filter((m) => m.startsWith('kick'));
    if (inRange.length === 0) return ['kick_r'];
    return [kicky && kicks.length ? this.pick(kicks) : this.pick(inRange)];
  }

  private act(ctx: BrainContext, toward: -1 | 0 | 1): TickInput {
    const { self } = ctx;
    switch (this.st) {
      case 'approach':
        return { ...NO_INPUT, move: toward };
      case 'retreat':
        return { ...NO_INPUT, move: (-toward || 1) as -1 | 1 };
      case 'special': {
        if (this.specialStep === 0 && isFree(self)) {
          this.specialStep = 1;
          return { ...NO_INPUT, attack: 'punch_l' };
        }
        if (this.specialStep === 1) {
          this.specialStep = 2;
          return { ...NO_INPUT, attack: 'punch_r' };
        }
        return { ...NO_INPUT };
      }
      case 'block':
        return { ...NO_INPUT, block: true };
      case 'dodge':
        this.st = 'idle';
        this.holdUntil = ctx.frame;
        return { ...NO_INPUT, dodge: true };
      case 'counter':
      case 'attack': {
        if (!isFree(self) || this.plan.length === 0) return { ...NO_INPUT };
        const move = this.plan[0];
        if (MOVES[move].range < this.distance(ctx)) {
          this.plan = [];
          this.st = 'idle';
          this.holdUntil = ctx.frame;
          return { ...NO_INPUT };
        }
        if (self.stamina < MOVES[move].stamina) {
          this.plan = [];
          this.st = 'retreat';
          return { ...NO_INPUT, move: (-toward || 1) as -1 | 1 };
        }
        this.plan.shift();
        return { ...NO_INPUT, attack: move };
      }
      default:
        return { ...NO_INPUT };
    }
  }
}
