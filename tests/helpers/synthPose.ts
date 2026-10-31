// Parametric skeleton that produces MediaPipe-shaped PoseFrames for recognizer tests.
// World: meters, origin at hip center, y down, z negative toward the camera, player's left = +x.
// Image: unmirrored camera, image = hip position + world * scale.
import type { Landmark, PoseFrame } from '../../src/shared/types';
import { LANDMARK_COUNT, LM } from '../../src/motion/landmarks';
import { type Vec3, dist, sub } from '../../src/shared/math';

export type ArmPose = {
  /** |wrist - shoulder| / (upper arm + forearm), 0..1 */
  ext: number;
  /** 'cover' places the wrist beside the nose (block) and ignores ext */
  dir: 'down' | 'forward' | 'side' | 'guard' | 'cover';
};

export type SynthParams = {
  hipX: number;
  hipY: number;
  scale: number;
  /** degrees, + = toward the player's right */
  lean: number;
  hipDrop: number;
  jump: number;
  armL: ArmPose;
  armR: ArmPose;
  liftL: number;
  liftR: number;
  visibility: number;
  hidden?: number[];
};

export const BODY = {
  shoulderWidth: 0.38,
  hipWidth: 0.2,
  torso: 0.5,
  upperArm: 0.28,
  foreArm: 0.26,
  thigh: 0.45,
  shin: 0.43,
  noseAboveShoulders: 0.25,
} as const;

export const DEFAULT_SYNTH: SynthParams = {
  hipX: 0.5,
  hipY: 0.55,
  scale: 0.25,
  lean: 0,
  hipDrop: 0,
  jump: 0,
  armL: { ext: 0.45, dir: 'guard' },
  armR: { ext: 0.45, dir: 'guard' },
  liftL: 0,
  liftR: 0,
  visibility: 0.99,
};

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const scaleV = (a: Vec3, k: number): Vec3 => v(a.x * k, a.y * k, a.z * k);
const norm = (a: Vec3): Vec3 => {
  const n = Math.hypot(a.x, a.y, a.z);
  return n === 0 ? v(0, 0, 0) : scaleV(a, 1 / n);
};
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** Two-bone IK: joint position between root and end, bending toward `hint`. */
function solveJoint(root: Vec3, end: Vec3, l1: number, l2: number, hint: Vec3): Vec3 {
  const d = Math.min(dist(root, end), l1 + l2);
  const axis = norm(sub(end, root));
  if (d === 0) return add(root, scaleV(hint, l1));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let bend = sub(hint, scaleV(axis, dot(hint, axis)));
  if (Math.hypot(bend.x, bend.y, bend.z) < 1e-9) bend = v(0, 0, -1);
  return add(add(root, scaleV(axis, a)), scaleV(norm(bend), h));
}

function armPoints(side: 1 | -1, arm: ArmPose, shoulder: Vec3, nose: Vec3): { elbow: Vec3; wrist: Vec3 } {
  const reach = BODY.upperArm + BODY.foreArm;
  let wrist: Vec3;
  if (arm.dir === 'cover') {
    wrist = add(nose, v(side * 0.07, 0.04, -0.08));
  } else {
    const dirs: Record<Exclude<ArmPose['dir'], 'cover'>, Vec3> = {
      down: v(0, 1, 0),
      forward: v(0, 0, -1),
      side: v(side, 0, 0),
      guard: norm(v(-side * 0.1, 0.25, -0.2)),
    };
    wrist = add(shoulder, scaleV(dirs[arm.dir], arm.ext * reach));
  }
  const elbow = solveJoint(shoulder, wrist, BODY.upperArm, BODY.foreArm, v(side * 0.3, 1, 0.2));
  return { elbow, wrist };
}

function legPoints(side: 1 | -1, hipDrop: number, lift: number): { hip: Vec3; knee: Vec3; ankle: Vec3 } {
  const hip = v(side * BODY.hipWidth / 2, 0, 0);
  const floorY = BODY.thigh + BODY.shin - hipDrop;
  const ankle = v(hip.x, floorY - lift, -lift * 0.8);
  const knee = solveJoint(hip, ankle, BODY.thigh, BODY.shin, v(0, 0, -1));
  return { hip, knee, ankle };
}

/** Rotate upper-body points around the hip center; positive lean tips the head toward -x (player's right). */
function leanPoint(p: Vec3, leanDeg: number): Vec3 {
  const th = (leanDeg * Math.PI) / 180;
  return v(p.x * Math.cos(th) + p.y * Math.sin(th), -p.x * Math.sin(th) + p.y * Math.cos(th), p.z);
}

export function synthFrame(partial: Partial<SynthParams>, t: number, frameId = 0): PoseFrame {
  const p: SynthParams = { ...DEFAULT_SYNTH, ...partial };
  const sw = BODY.shoulderWidth / 2;
  const shoulderL = v(sw, -BODY.torso, 0);
  const shoulderR = v(-sw, -BODY.torso, 0);
  const nose = v(0, -BODY.torso - BODY.noseAboveShoulders, -0.05);
  const armL = armPoints(1, p.armL, shoulderL, nose);
  const armR = armPoints(-1, p.armR, shoulderR, nose);
  const legL = legPoints(1, p.hipDrop, p.liftL);
  const legR = legPoints(-1, p.hipDrop, p.liftR);

  const world: Vec3[] = Array.from({ length: LANDMARK_COUNT }, () => v(0, 0, 0));
  const upper: [number, Vec3][] = [
    [LM.NOSE, nose],
    [LM.L_SHOULDER, shoulderL], [LM.R_SHOULDER, shoulderR],
    [LM.L_ELBOW, armL.elbow], [LM.R_ELBOW, armR.elbow],
    [LM.L_WRIST, armL.wrist], [LM.R_WRIST, armR.wrist],
  ];
  for (const [i, pt] of upper) world[i] = leanPoint(pt, p.lean);
  world[LM.L_HIP] = legL.hip; world[LM.R_HIP] = legR.hip;
  world[LM.L_KNEE] = legL.knee; world[LM.R_KNEE] = legR.knee;
  world[LM.L_ANKLE] = legL.ankle; world[LM.R_ANKLE] = legR.ankle;
  // Face points 1-10 follow the nose, hand points 17-22 the wrists, foot points 29-32 the ankles.
  for (let i = 1; i <= 10; i++) world[i] = world[LM.NOSE];
  for (const i of [17, 19, 21]) world[i] = world[LM.L_WRIST];
  for (const i of [18, 20, 22]) world[i] = world[LM.R_WRIST];
  for (const i of [29, 31]) world[i] = world[LM.L_ANKLE];
  for (const i of [30, 32]) world[i] = world[LM.R_ANKLE];

  const hipY = p.hipY - p.jump * p.scale + p.hipDrop * p.scale;
  const hidden = new Set(p.hidden ?? []);
  const vis = (i: number) => (hidden.has(i) ? 0.1 : p.visibility);
  const image: Landmark[] = world.map((w, i) => ({
    x: p.hipX + w.x * p.scale,
    y: hipY + w.y * p.scale,
    z: w.z * p.scale,
    visibility: vis(i),
  }));
  return { frameId, t, image, world: world.map((w, i) => ({ ...w, visibility: vis(i) })) };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function lerpParams(a: SynthParams, b: SynthParams, k: number): SynthParams {
  const arm = (x: ArmPose, y: ArmPose): ArmPose => ({ ext: lerp(x.ext, y.ext, k), dir: x.dir });
  return {
    hipX: lerp(a.hipX, b.hipX, k),
    hipY: lerp(a.hipY, b.hipY, k),
    scale: lerp(a.scale, b.scale, k),
    lean: lerp(a.lean, b.lean, k),
    hipDrop: lerp(a.hipDrop, b.hipDrop, k),
    jump: lerp(a.jump, b.jump, k),
    armL: arm(a.armL, b.armL),
    armR: arm(a.armR, b.armR),
    liftL: lerp(a.liftL, b.liftL, k),
    liftR: lerp(a.liftR, b.liftR, k),
    visibility: lerp(a.visibility, b.visibility, k),
    hidden: a.hidden,
  };
}

/** Frames sampled at `fps` from the first to the last key; each key is DEFAULT_SYNTH overridden by its params. */
export function synthSequence(keys: { t: number; p: Partial<SynthParams> }[], fps = 30): PoseFrame[] {
  const full = keys.map((k) => ({ t: k.t, p: { ...DEFAULT_SYNTH, ...k.p } }));
  const t0 = full[0].t;
  const t1 = full[full.length - 1].t;
  const n = Math.floor(((t1 - t0) * fps) / 1000 + 1e-9) + 1;
  const frames: PoseFrame[] = [];
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + (i * 1000) / fps;
    while (seg < full.length - 2 && t > full[seg + 1].t) seg++;
    const a = full[seg];
    const b = full[Math.min(seg + 1, full.length - 1)];
    const k = b.t === a.t ? 0 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
    frames.push(synthFrame(lerpParams(a.p, b.p, k), t, i));
  }
  return frames;
}

/** Concatenate sequences, re-numbering frameIds; later sequences must start after earlier ones end. */
export function concatSequences(...seqs: PoseFrame[][]): PoseFrame[] {
  const out: PoseFrame[] = [];
  for (const s of seqs) for (const f of s) {
    if (out.length && f.t <= out[out.length - 1].t) continue;
    out.push({ ...f, frameId: out.length });
  }
  return out;
}
