import { DODGE_INVULN, DODGE_RECOVERY, JUMP_FRAMES } from '../sim/constants';
import { MOVES } from '../sim/moves';
import type { Fighter, MatchResult, MoveId } from '../sim/types';

export type ClipName =
  | 'idle' | 'walk_fwd' | 'walk_back' | 'jump' | 'crouch'
  | 'punch_l' | 'punch_r' | 'kick_l' | 'kick_r' | 'special'
  | 'block' | 'dodge' | 'hit_high' | 'hit_mid' | 'knockdown' | 'victory' | 'defeat';

export type ClipInfo = Record<ClipName, { count: number; impact: number }>;

export type AnimCtx = {
  self: 0 | 1;
  opponentX: number;
  /** x change since the previous tick (walk direction) */
  dx: number;
  lastHitMove: MoveId | null;
  result: MatchResult | null;
  /** ticks since the match started (loops) */
  tick: number;
  /** ticks since the current action kind began */
  actionTicks: number;
  /** ticks since the match result appeared */
  sinceResult: number;
  clips: ClipInfo;
};

/** Jump height at the apex, in screen px at bodyScale 1 (jump clips are rendered in place). */
export const JUMP_LIFT_PX = 120;

/** Vertical offset of a jumping fighter, following the sim's jump arc so the sprite is airborne exactly when the sim is. */
export function jumpLiftPx(f: Fighter, bodyScale: number): number {
  return f.action.kind === 'jump' ? Math.sin((Math.PI * f.action.frame) / JUMP_FRAMES) * JUMP_LIFT_PX * bodyScale : 0;
}

/** Walking direction measured per sim tick, kept across ticks without movement (no fwd/back flicker). */
export class WalkTracker {
  private prevX: number | null = null;
  dx = 0;

  tick(f: Fighter): void {
    const step = this.prevX === null ? 0 : f.x - this.prevX;
    this.prevX = f.x;
    if (f.action.kind !== 'walk') this.dx = 0;
    else if (step !== 0) this.dx = step;
  }
}

/** Delay before the KO winner starts celebrating, so the knockdown reads first. */
const VICTORY_DELAY = 60;

export function clipInfoFromMeta(meta: { clips: Record<string, number>; impact: Record<string, number> }): ClipInfo {
  const info = {} as ClipInfo;
  for (const [name, count] of Object.entries(meta.clips)) info[name as ClipName] = { count, impact: meta.impact[name] ?? 0 };
  return info;
}

const last = (c: ClipInfo, clip: ClipName) => Math.max(0, c[clip].count - 1);
const at = (c: ClipInfo, clip: ClipName, i: number) => ({ clip, index: Math.max(0, Math.min(Math.floor(i), last(c, clip))) });
const loop = (c: ClipInfo, clip: ClipName, tick: number) => ({ clip, index: Math.floor(tick / 2) % c[clip].count });

/** Which sprite to show for a fighter's sim state (spec 5.1). */
export function spriteFrame(f: Fighter, ctx: AnimCtx): { clip: ClipName; index: number } {
  const { clips: c, result } = ctx;
  const a = f.action;

  if (result && a.kind !== 'ko') {
    if (result.winner === ctx.self) {
      const t = ctx.sinceResult - (result.reason === 'ko' ? VICTORY_DELAY : 0);
      if (t >= 0) return at(c, 'victory', t / 2);
    } else if (result.winner !== null && result.reason === 'timeout') {
      return at(c, 'defeat', ctx.sinceResult / 2);
    }
    return loop(c, 'idle', ctx.tick);
  }

  switch (a.kind) {
    case 'walk': {
      const toward = Math.sign(ctx.opponentX - f.x);
      return loop(c, ctx.dx === 0 || Math.sign(ctx.dx) === toward ? 'walk_fwd' : 'walk_back', ctx.tick);
    }
    case 'jump':
      return at(c, 'jump', (a.frame / JUMP_FRAMES) * c.jump.count);
    case 'crouch':
      return at(c, 'crouch', ctx.actionTicks / 2);
    case 'block':
    case 'blockstun':
      return at(c, 'block', ctx.actionTicks / 2);
    case 'dodge':
      return at(c, 'dodge', (a.frame / (DODGE_INVULN + DODGE_RECOVERY)) * c.dodge.count);
    case 'hitstun': {
      const high = ctx.lastHitMove === 'punch_l' || ctx.lastHitMove === 'punch_r';
      return at(c, high ? 'hit_high' : 'hit_mid', ctx.actionTicks / 2);
    }
    case 'ko':
      return at(c, 'knockdown', ctx.actionTicks / 2);
    case 'attack': {
      const clip = a.move as ClipName;
      const startup = MOVES[a.move].startup + f.extraStartup;
      const impact = c[clip].impact;
      // the startup (stretched over any telegraph) reaches the impact sprite exactly on the first active frame
      if (a.frame < startup) return at(c, clip, (a.frame * impact) / startup);
      return at(c, clip, impact + (a.frame - startup) / 2);
    }
    default:
      return loop(c, 'idle', ctx.tick);
  }
}
