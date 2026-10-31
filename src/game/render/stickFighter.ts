import type Phaser from 'phaser';
import { MOVES } from '../sim/moves';
import type { Fighter } from '../sim/types';
import type { Limb, Pose } from './pose';

export const PLAYER_COLOR = 0x22d3ee;
export const OPPONENT_COLOR = 0xf472b6;
const TELEGRAPH_COLOR = 0xfacc15;

/** Body proportions in screen pixels. */
const BODY = { thigh: 46, shin: 44, torso: 72, upperArm: 34, foreArm: 32, head: 15, neck: 8 };

type P = { x: number; y: number };

export type ArenaView = {
  /** arena x (0..1000) → screen x */
  toScreen: (x: number) => number;
  groundY: number;
};

/** Point at `len` px from `from` along angle `ang` (0 = straight down, + = toward facing `d`). */
const along = (from: P, ang: number, len: number, d: number): P => ({
  x: from.x + d * Math.sin(ang) * len,
  y: from.y + Math.cos(ang) * len,
});

function segment(g: Phaser.GameObjects.Graphics, a: P, b: P, color: number, alpha: number): void {
  g.lineStyle(16, color, 0.18 * alpha);
  g.lineBetween(a.x, a.y, b.x, b.y);
  g.lineStyle(6, color, alpha);
  g.lineBetween(a.x, a.y, b.x, b.y);
}

function limb(g: Phaser.GameObjects.Graphics, root: P, l: Limb, lens: [number, number], d: number, bendSign: 1 | -1, color: number, alpha: number): P {
  const mid = along(root, l.a, lens[0], d);
  const end = along(mid, l.a + bendSign * l.b, lens[1], d);
  segment(g, root, mid, color, alpha);
  segment(g, mid, end, color, alpha);
  return end;
}

/** Point where the fighter's attack connects (for hit sparks), in screen pixels. */
export function strikePoint(f: Fighter, view: ArenaView): P {
  return { x: view.toScreen(f.x) + f.facing * 70, y: view.groundY - 150 };
}

/** Draws a neon stick fighter for the given pose; the attacking limb flashes yellow during an NPC telegraph. */
export function drawFighter(g: Phaser.GameObjects.Graphics, f: Fighter, pose: Pose, color: number, view: ArenaView): void {
  const d = f.facing;
  const sx = view.toScreen(f.x);
  if (pose.lying) {
    const y = view.groundY - 8;
    segment(g, { x: sx - d * 60, y }, { x: sx + d * 40, y }, color, 0.8);
    segment(g, { x: sx + d * 40, y }, { x: sx + d * 85, y: y - 6 }, color, 0.8);
    segment(g, { x: sx - d * 30, y }, { x: sx - d * 10, y: y - 30 }, color, 0.8);
    g.lineStyle(6, color, 0.8);
    g.strokeCircle(sx - d * 78, y - 10, BODY.head);
    return;
  }

  const a = f.action;
  const telegraph = a.kind === 'attack' && f.extraStartup > 0 && a.frame < MOVES[a.move].startup + f.extraStartup && a.frame % 6 < 3;
  const tint = (part: 'armFront' | 'armBack' | 'legFront' | 'legBack') => {
    if (!telegraph || a.kind !== 'attack') return color;
    const owner = { punch_l: 'armFront', punch_r: 'armBack', kick_l: 'legFront', kick_r: 'legBack', special: 'armFront' }[a.move];
    return owner === part || (a.move === 'special' && part === 'armBack') ? TELEGRAPH_COLOR : color;
  };

  const legLen = BODY.thigh + BODY.shin;
  const hip: P = { x: sx, y: view.groundY - legLen * (1 - 0.35 * pose.crouch) - pose.lift * 120 };
  const shoulder: P = { x: hip.x + d * Math.sin(pose.lean) * BODY.torso, y: hip.y - Math.cos(pose.lean) * BODY.torso };
  const headC: P = {
    x: shoulder.x + d * Math.sin(pose.lean) * (BODY.neck + BODY.head),
    y: shoulder.y - Math.cos(pose.lean) * (BODY.neck + BODY.head),
  };

  // back limbs first, dimmer, so the front limbs read on top
  limb(g, shoulder, pose.armBack, [BODY.upperArm, BODY.foreArm], d, 1, tint('armBack'), 0.55);
  limb(g, hip, pose.legBack, [BODY.thigh, BODY.shin], d, -1, tint('legBack'), 0.55);
  segment(g, hip, shoulder, color, 1);
  g.lineStyle(16, color, 0.18);
  g.strokeCircle(headC.x, headC.y, BODY.head);
  g.lineStyle(6, color, 1);
  g.strokeCircle(headC.x, headC.y, BODY.head);
  limb(g, hip, pose.legFront, [BODY.thigh, BODY.shin], d, -1, tint('legFront'), 1);
  limb(g, shoulder, pose.armFront, [BODY.upperArm, BODY.foreArm], d, 1, tint('armFront'), 1);
}
