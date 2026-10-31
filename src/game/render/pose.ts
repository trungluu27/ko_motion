import { JUMP_FRAMES } from '../sim/constants';
import { MOVES } from '../sim/moves';
import type { Fighter, MoveId } from '../sim/types';

/** Joint angles in radians: `a` swings the limb from hanging straight down (+ = toward facing), `b` bends the middle joint. */
export type Limb = { a: number; b: number };

export type Pose = {
  /** torso tilt, + = toward facing */
  lean: number;
  /** jump height, 0..1 */
  lift: number;
  /** crouch depth, 0..1 */
  crouch: number;
  armFront: Limb;
  armBack: Limb;
  legFront: Limb;
  legBack: Limb;
  lying: boolean;
};

const GUARD: Pose = {
  lean: 0.08, lift: 0, crouch: 0,
  armFront: { a: 0.9, b: 1.9 }, armBack: { a: 0.6, b: 2.1 },
  legFront: { a: 0.25, b: 0.15 }, legBack: { a: -0.25, b: 0.1 },
  lying: false,
};

const STRAIGHT = { a: Math.PI / 2, b: 0.05 };

const IMPACT: Record<MoveId, Partial<Pose>> = {
  punch_l: { lean: 0.2, armFront: STRAIGHT },
  punch_r: { lean: 0.25, armBack: { a: Math.PI / 2, b: 0.05 } },
  kick_l: { lean: -0.2, legFront: { a: 1.4, b: 0.1 } },
  kick_r: { lean: -0.3, legBack: { a: 1.5, b: 0.1 } },
  special: { lean: 0.3, armFront: STRAIGHT, armBack: { a: 1.45, b: 0.1 } },
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpLimb = (x: Limb, y: Limb, k: number): Limb => ({ a: lerp(x.a, y.a, k), b: lerp(x.b, y.b, k) });

function blend(from: Pose, to: Partial<Pose>, k: number): Pose {
  const t: Pose = { ...from, ...to };
  return {
    lean: lerp(from.lean, t.lean, k),
    lift: lerp(from.lift, t.lift, k),
    crouch: lerp(from.crouch, t.crouch, k),
    armFront: lerpLimb(from.armFront, t.armFront, k),
    armBack: lerpLimb(from.armBack, t.armBack, k),
    legFront: lerpLimb(from.legFront, t.legFront, k),
    legBack: lerpLimb(from.legBack, t.legBack, k),
    lying: k >= 0.5 ? t.lying : from.lying,
  };
}

/** Keyframed pose for the fighter's current action (attacks: guard → impact during startup, hold while active, back during recovery). */
export function poseFor(f: Fighter): Pose {
  const a = f.action;
  switch (a.kind) {
    case 'attack': {
      const d = MOVES[a.move];
      const start = d.startup + f.extraStartup;
      const k = a.frame < start ? a.frame / start : a.frame < start + d.active ? 1 : 1 - (a.frame - start - d.active) / d.recovery;
      return blend(GUARD, IMPACT[a.move], Math.max(0, Math.min(1, k)));
    }
    case 'walk': {
      const s = Math.sin(f.x / 12) * 0.35;
      return { ...GUARD, legFront: { a: 0.25 + s, b: 0.2 }, legBack: { a: -0.25 - s, b: 0.2 } };
    }
    case 'crouch':
      return { ...GUARD, crouch: 1, legFront: { a: 1.0, b: 1.8 }, legBack: { a: 0.2, b: 1.9 } };
    case 'jump':
      return { ...GUARD, lift: Math.sin((Math.PI * a.frame) / JUMP_FRAMES), legFront: { a: 0.9, b: 1.6 }, legBack: { a: 0.3, b: 1.7 } };
    case 'block':
      return { ...GUARD, lean: -0.05, armFront: { a: 1.25, b: 2.5 }, armBack: { a: 1.15, b: 2.6 } };
    case 'blockstun':
      return { ...GUARD, lean: -0.15, armFront: { a: 1.25, b: 2.5 }, armBack: { a: 1.15, b: 2.6 } };
    case 'dodge':
      return { ...GUARD, lean: -0.5, crouch: 0.3 };
    case 'hitstun':
      return { ...GUARD, lean: -0.35, armFront: { a: 0.3, b: 0.8 }, armBack: { a: -0.2, b: 0.6 } };
    case 'ko':
      return { ...GUARD, lying: true };
    default:
      return GUARD;
  }
}
