import type { Rng } from '../../shared/rng';
import { ARENA_W, EDGE, MAX_SPECIAL, WALK_SPEED } from '../sim/constants';
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
  /** how old `seen` is, in ticks: used to estimate what the opponent is doing now */
  reactionFrames: number;
  frame: number;
  params: DifficultyParams;
  mult: Multipliers;
};

const LOW_STAMINA = 20;
const RECOVERED_STAMINA = 50;
const WALL_MARGIN = 5;
/** close-range engage distance: a jab's knockback (30) still leaves the cross (range 120) in reach */
const PUNCH_DISTANCE = 85;
/** mid-range engage distance: inside both kicks, outside both punches */
const KICK_DISTANCE = 145;
/** the AI waits this far outside the opponent's longest reach (spec ai-difficulty 2.3) */
const HOVER_MARGIN = 15;
/** how far from the hover distance still counts as "there" */
const HOVER_SLACK = 20;
const MAX_PROB = 0.95;
const GUARD_MARGIN = 10;
const GUARD_RELEASE_DISTANCE = 220;
const GUARD_MIN_FRAMES = 18;
const GUARD_EXTRA_FRAMES = 18;
/** against a punch-heavy player, this share of guards ducks under the (high) punches instead of blocking */
const LOW_GUARD_SHARE = 0.6;
/** punches first: they recover before the opponent's hitstun ends; kicks only when nothing else lands in time */
const PUNISH_ORDER: MoveId[] = ['punch_r', 'punch_l', 'kick_l', 'kick_r'];
/** a punish may land a few frames after the opponent recovers: their fastest answer (the jab) still needs 4 frames */
const PUNISH_SLACK = 3;
const BASIC: MoveId[] = ['punch_l', 'punch_r', 'kick_l', 'kick_r'];

const COMBO_2: MoveId[][] = [
  ['punch_l', 'punch_r'],
  ['punch_l', 'kick_r'],
  ['punch_r', 'kick_l'],
];
const COMBO_3: MoveId[][] = [
  ['punch_l', 'punch_r', 'kick_r'],
  ['punch_r', 'kick_l', 'kick_r'],
];

const isFree = (f: Fighter) =>
  f.action.kind === 'idle' || f.action.kind === 'walk' || f.action.kind === 'crouch' || f.action.kind === 'block';

/** The opponent's attack as it most likely is now: what we saw, aged by our reaction delay. */
function attackNow(ctx: BrainContext): { move: MoveId; frame: number; activeFrom: number; activeTo: number; end: number } | null {
  const a = ctx.seen?.action;
  if (!a || a.kind !== 'attack') return null;
  const d = MOVES[a.move];
  const activeFrom = d.startup + (a.telegraph ?? 0);
  const end = activeFrom + d.active + d.recovery;
  const frame = a.frame + ctx.reactionFrames;
  return frame < end ? { move: a.move, frame, activeFrom, activeTo: activeFrom + d.active, end } : null;
}

/** The opponent's longest reach with the stamina (and meter) they have. */
function threatRange(seen: Seen): number {
  const ranges = BASIC.filter((m) => seen.stamina >= MOVES[m].stamina).map((m) => MOVES[m].range);
  if (seen.special >= MAX_SPECIAL) ranges.push(MOVES.special.range);
  return Math.max(0, ...ranges);
}

const walkFrames = (d: number, move: MoveId) => Math.ceil(Math.max(0, d - MOVES[move].range) / WALK_SPEED);

/** Finite-state fighter AI. Re-decides every DECISION_FRAMES ticks or when its current plan finishes; punishes on any tick. */
export class AiBrain {
  private st: AiState = 'idle';
  private plan: MoveId[] = [];
  private holdUntil = 0;
  private nextDecision = 0;
  private specialStep = 0;
  /** the current guard is a crouch (evades high attacks) rather than a block */
  private low = false;
  /** distance the AI committed to close before attacking, or null when not committed */
  private engage: number | null = null;
  /** a counter that has to walk in gives up after this frame (the opening has closed) */
  private counterUntil = 0;
  /** start frame of the last opponent attack we already rolled a punish / a dodge for */
  private rolledCounter: number | null = null;
  private rolledDodge: number | null = null;

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
    const busy = (this.st === 'attack' || this.st === 'counter') && this.plan.length > 0;
    if (!busy && this.st !== 'special' && this.react(ctx, this.distance(ctx))) {
      this.nextDecision = frame + DECISION_FRAMES;
    } else if (frame >= this.nextDecision || this.planDone(ctx)) {
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
    if (this.st === 'approach' && this.engage !== null) return this.distance(ctx) <= this.engage;
    return false;
  }

  private distance(ctx: BrainContext): number {
    return Math.abs((ctx.seen?.x ?? ctx.self.x) - ctx.self.x);
  }

  private pinnedWhenRetreating(ctx: BrainContext): boolean {
    const away = -Math.sign((ctx.seen?.x ?? 0) - ctx.self.x);
    return (away < 0 && ctx.self.x <= EDGE + WALL_MARGIN) || (away > 0 && ctx.self.x >= ARENA_W - EDGE - WALL_MARGIN);
  }

  /** The first move in PUNISH_ORDER that lands (walking in first if needed) before the opponent recovers. */
  private punishMove(ctx: BrainContext, d: number, framesLeft: number): MoveId | null {
    return PUNISH_ORDER.find((m) => ctx.self.stamina >= MOVES[m].stamina && walkFrames(d, m) + MOVES[m].startup < framesLeft + PUNISH_SLACK) ?? null;
  }

  /** Rolls once per opponent attack: punish it in recovery, or dodge it before it lands. */
  private react(ctx: BrainContext, d: number): boolean {
    const { self, params, mult, frame } = ctx;
    const now = attackNow(ctx);
    if (!now || !isFree(self)) return false;
    const key = frame - now.frame;
    if (now.frame >= now.activeTo) {
      if (this.rolledCounter === key) return false;
      const move = this.punishMove(ctx, d, now.end - now.frame);
      if (!move) return false;
      this.rolledCounter = key;
      if (!this.chance(params.counterChance * mult.counter)) return false;
      this.st = 'counter';
      this.plan = [move];
      this.engage = null;
      this.counterUntil = frame + walkFrames(d, move);
      return true;
    }
    if (now.frame < now.activeTo && d <= MOVES[now.move].range && this.rolledDodge !== key) {
      this.rolledDodge = key;
      if (this.chance(params.dodgeChance * mult.dodge)) {
        this.st = 'dodge';
        return true;
      }
    }
    return false;
  }

  private decide(ctx: BrainContext): void {
    const { self, seen, params, mult, frame } = ctx;
    const d = this.distance(ctx);
    // keep finishing a combo; reactions may interrupt pauses and guards
    if ((this.st === 'attack' || this.st === 'counter') && this.plan.length > 0) return;
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
      this.engage = null;
      return;
    }
    // inside the opponent's reach the guard comes up, even mid-approach
    const threat = seen ? threatRange(seen) : 0;
    const now = attackNow(ctx);
    const recovering = now !== null && now.frame >= now.activeTo;
    if (d <= threat + GUARD_MARGIN && !recovering && this.chance(params.blockChance * mult.block)) {
      this.st = 'block';
      this.low = mult.block > 1 && this.chance(LOW_GUARD_SHARE);
      this.holdUntil = frame + GUARD_MIN_FRAMES + Math.floor(this.rng() * (GUARD_EXTRA_FRAMES + 1));
      return;
    }
    // committed: keep closing in, then strike
    if (this.engage !== null) {
      if (d <= this.engage) {
        this.engage = null;
        this.st = 'attack';
        this.plan = this.chooseSequence(ctx, d);
      } else {
        this.st = 'approach';
      }
      return;
    }
    if (this.chance(params.aggression * mult.aggression)) {
      // kick spacing half the time (more when the player keeps blocking, less when they kick)
      this.engage = this.chance(0.5 * mult.kickBias) ? KICK_DISTANCE : PUNCH_DISTANCE;
      if (d <= this.engage) {
        this.engage = null;
        this.st = 'attack';
        this.plan = this.chooseSequence(ctx, d);
      } else {
        this.st = 'approach';
      }
      return;
    }
    // footsies: wait just outside the opponent's reach
    const hover = threat + HOVER_MARGIN;
    if (d < hover - HOVER_SLACK && !this.pinnedWhenRetreating(ctx)) {
      this.st = 'retreat';
    } else if (d > hover + HOVER_SLACK) {
      this.st = 'approach';
    } else {
      this.st = 'idle';
      this.holdUntil = frame + msToFrames(params.idlePauseMs);
    }
  }

  private chooseSequence(ctx: BrainContext, d: number): MoveId[] {
    const { comboLen } = ctx.params;
    const kicky = ctx.mult.kickBias > 1;
    const punchesReach = d <= MOVES.punch_r.range;
    if (comboLen >= 3 && punchesReach) return [...(kicky ? COMBO_3[1] : this.pick(COMBO_3))];
    if (comboLen >= 2 && punchesReach) return [...(kicky ? COMBO_2[1 + Math.floor(this.rng() * 2)] : this.pick(COMBO_2))];
    const inRange = BASIC.filter((m) => MOVES[m].range >= d);
    // past punch reach only kicks connect
    const kicks = inRange.filter((m) => m.startsWith('kick'));
    if (inRange.length === 0) return ['kick_r'];
    return [(kicky || !punchesReach) && kicks.length ? this.pick(kicks) : this.pick(inRange)];
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
        return this.low ? { ...NO_INPUT, crouch: true } : { ...NO_INPUT, block: true };
      case 'dodge':
        this.st = 'idle';
        this.holdUntil = ctx.frame;
        return { ...NO_INPUT, dodge: true };
      case 'counter':
      case 'attack': {
        if (!isFree(self) || this.plan.length === 0) return { ...NO_INPUT };
        const move = this.plan[0];
        if (MOVES[move].range < this.distance(ctx)) {
          // a punish walks in while the opening lasts
          if (this.st === 'counter' && ctx.frame <= this.counterUntil) return { ...NO_INPUT, move: toward };
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
