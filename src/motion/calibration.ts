import type { Landmark, LR, PoseFrame, TrackingStatus } from '../shared/types';
import { dist, dist2d, median, mid } from '../shared/math';
import type { MotionConfig } from './config';
import { LM } from './landmarks';
import { trackingStatusOf } from './tracking';

export type Calibration = {
  hipX: number;
  hipY: number;
  ankleYL: number;
  ankleYR: number;
  torsoPx: number;
  shoulderPx: number;
  legPx: number;
  upperArm: LR<number>;
  foreArm: LR<number>;
};

export type CalibrationProgress = {
  status: TrackingStatus | 'calibrating' | 'ready';
  progress: number;
  calibration?: Calibration;
};

/**
 * Image landmarks in square units: x is rescaled by the frame aspect (width / height) so that x and y
 * share the image-height scale, making angles and distances independent of the camera's aspect ratio.
 */
export function squareImage(f: PoseFrame): Landmark[] {
  const a = f.aspect ?? 1;
  return a === 1 ? f.image : f.image.map((l) => ({ ...l, x: l.x * a }));
}

/** Instantaneous body measurements of one frame, in the same units as Calibration. */
export function measureBody(f: PoseFrame): Calibration {
  const im = squareImage(f);
  const w = f.world;
  const hip = mid(im[LM.L_HIP], im[LM.R_HIP]);
  const shoulders = mid(im[LM.L_SHOULDER], im[LM.R_SHOULDER]);
  return {
    hipX: hip.x,
    hipY: hip.y,
    ankleYL: im[LM.L_ANKLE].y,
    ankleYR: im[LM.R_ANKLE].y,
    torsoPx: dist2d(shoulders, hip),
    shoulderPx: dist2d(im[LM.L_SHOULDER], im[LM.R_SHOULDER]),
    legPx: (dist2d(im[LM.L_HIP], im[LM.L_ANKLE]) + dist2d(im[LM.R_HIP], im[LM.R_ANKLE])) / 2,
    upperArm: { l: dist(w[LM.L_SHOULDER], w[LM.L_ELBOW]), r: dist(w[LM.R_SHOULDER], w[LM.R_ELBOW]) },
    foreArm: { l: dist(w[LM.L_ELBOW], w[LM.L_WRIST]), r: dist(w[LM.R_ELBOW], w[LM.R_WRIST]) },
  };
}

function medianCalibration(samples: Calibration[]): Calibration {
  const m = (pick: (c: Calibration) => number) => median(samples.map(pick));
  return {
    hipX: m((c) => c.hipX),
    hipY: m((c) => c.hipY),
    ankleYL: m((c) => c.ankleYL),
    ankleYR: m((c) => c.ankleYR),
    torsoPx: m((c) => c.torsoPx),
    shoulderPx: m((c) => c.shoulderPx),
    legPx: m((c) => c.legPx),
    upperArm: { l: m((c) => c.upperArm.l), r: m((c) => c.upperArm.r) },
    foreArm: { l: m((c) => c.foreArm.l), r: m((c) => c.foreArm.r) },
  };
}

/** Collects consecutive stable, fully tracked frames of the neutral stance and returns their median measurements. */
export class Calibrator {
  private samples: Calibration[] = [];
  private result: Calibration | undefined;

  constructor(private readonly cfg: MotionConfig) {}

  push(f: PoseFrame | null): CalibrationProgress {
    const need = this.cfg.calibration.frames;
    if (this.result) return { status: 'ready', progress: 1, calibration: this.result };
    const status = trackingStatusOf(f, this.cfg.tracking);
    if (status !== 'ok' || !f) {
      this.samples = [];
      return { status, progress: 0 };
    }
    const sample = measureBody(f);
    if (this.samples.length && Math.abs(sample.hipX - this.samples[0].hipX) >= this.cfg.calibration.hipStableMax) {
      this.samples = [];
    }
    this.samples.push(sample);
    if (this.samples.length >= need) {
      this.result = medianCalibration(this.samples);
      return { status: 'ready', progress: 1, calibration: this.result };
    }
    return { status: 'calibrating', progress: this.samples.length / need };
  }

  reset(): void {
    this.samples = [];
    this.result = undefined;
  }
}
