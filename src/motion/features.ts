import type { LR, PoseFrame, Side } from '../shared/types';
import { angleDeg, dist, dist2d, mid } from '../shared/math';
import { type Calibration, squareImage } from './calibration';
import type { MotionConfig } from './config';
import { LM } from './landmarks';

export type Features = {
  /** ms */
  t: number;
  /** ms since the previous frame (0 after a reset) */
  dt: number;
  /** (cal.hipX - hipX) / shoulderPx; + = toward the player's right */
  hipDx: number;
  /** (hipY - cal.hipY) / torsoPx; + = lowered */
  hipDy: number;
  /** degrees; + = upper body tilted toward the player's right */
  lean: number;
  /** current torso length / calibrated torso length */
  torsoScale: number;
  armExt: LR<number>;
  /** 2D wrist-to-shoulder distance in the image / calibrated torso length (robust for the far arm when standing sideways) */
  reach2d: LR<number>;
  /** per second */
  armExtVel: LR<number>;
  elbowAngle: LR<number>;
  wristNose: LR<number>;
  wristAboveShoulder: LR<boolean>;
  wristInStrikeZone: LR<boolean>;
  /** (cal.ankleY - ankleY) / legPx */
  ankleLift: LR<number>;
  /** per second */
  ankleLiftVel: LR<number>;
  vis: { armL: number; armR: number; legL: number; legR: number; torso: number };
};

const ARM = { l: [LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST], r: [LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST] } as const;
const LEG = { l: [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE], r: [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE] } as const;
const TORSO = [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP] as const;

type Sample = { t: number; armExt: LR<number>; ankleLift: LR<number> };

const lr = <T>(fn: (s: Side) => T): LR<T> => ({ l: fn('l'), r: fn('r') });
const meanVis = (f: PoseFrame, idx: readonly number[]) => idx.reduce((a, i) => a + f.image[i].visibility, 0) / idx.length;

/** Turns pose frames into body-normalized features; velocities use real frame timing. */
export class FeatureExtractor {
  private history: Sample[] = [];

  constructor(
    private readonly cal: Calibration,
    private readonly cfg: MotionConfig,
  ) {}

  update(f: PoseFrame): Features {
    const { cal } = this;
    const im = squareImage(f);
    const w = f.world;
    const last = this.history[this.history.length - 1];
    if (last && f.t - last.t > this.cfg.tracking.gapResetMs) this.history = [];

    const hip = mid(im[LM.L_HIP], im[LM.R_HIP]);
    const shoulders = mid(im[LM.L_SHOULDER], im[LM.R_SHOULDER]);
    const nose = im[LM.NOSE];
    const zoneTop = nose.y - 0.5 * cal.torsoPx;
    const zoneBottom = hip.y - 0.5 * cal.torsoPx;

    const armExt = lr((s) => dist(w[ARM[s][0]], w[ARM[s][2]]) / (cal.upperArm[s] + cal.foreArm[s]));
    const ankleY = { l: cal.ankleYL, r: cal.ankleYR };
    const ankleLift = lr((s) => (ankleY[s] - im[LEG[s][2]].y) / cal.legPx);

    const ref = this.history.length >= 2 ? this.history[this.history.length - 2] : this.history[0];
    const dtRef = ref ? (f.t - ref.t) / 1000 : 0;
    const vel = (now: LR<number>, pick: (s: Sample) => LR<number>) =>
      lr((s) => (ref && dtRef > 0 ? (now[s] - pick(ref)[s]) / dtRef : 0));

    const features: Features = {
      t: f.t,
      dt: this.history.length ? f.t - this.history[this.history.length - 1].t : 0,
      hipDx: (cal.hipX - hip.x) / cal.shoulderPx,
      hipDy: (hip.y - cal.hipY) / cal.torsoPx,
      lean: (Math.atan2(hip.x - shoulders.x, hip.y - shoulders.y) * 180) / Math.PI,
      torsoScale: dist2d(shoulders, hip) / cal.torsoPx,
      armExt,
      reach2d: lr((s) => dist2d(im[ARM[s][2]], im[ARM[s][0]]) / cal.torsoPx),
      armExtVel: vel(armExt, (s) => s.armExt),
      elbowAngle: lr((s) => angleDeg(w[ARM[s][0]], w[ARM[s][1]], w[ARM[s][2]])),
      wristNose: lr((s) => dist2d(im[ARM[s][2]], nose) / cal.shoulderPx),
      wristAboveShoulder: lr((s) => im[ARM[s][2]].y < im[ARM[s][0]].y),
      wristInStrikeZone: lr((s) => im[ARM[s][2]].y < zoneBottom && im[ARM[s][2]].y > zoneTop),
      ankleLift,
      ankleLiftVel: vel(ankleLift, (s) => s.ankleLift),
      vis: {
        armL: meanVis(f, ARM.l),
        armR: meanVis(f, ARM.r),
        legL: meanVis(f, LEG.l),
        legR: meanVis(f, LEG.r),
        torso: meanVis(f, TORSO),
      },
    };

    this.history.push({ t: f.t, armExt, ankleLift });
    if (this.history.length > 3) this.history.shift();
    return features;
  }

  reset(): void {
    this.history = [];
  }
}

