export type MotionConfig = {
  /** beta applies to world coordinates (m); imageBeta to normalized image coordinates, which move ~4x less */
  oneEuro: { minCutoff: number; beta: number; imageBeta: number; dCutoff: number };
  tracking: { visibilityMin: number; edgeMargin: number; resumeDebounceMs: number; gapResetMs: number };
  calibration: { frames: number; hipStableMax: number; recalibrateRatio: number };
  punch: { extOn: number; velOn: number; elbowMinDeg: number; extOff: number; refractoryMs: number };
  kick: { liftOn: number; otherFootMax: number; velOn: number; liftOff: number; hipRiseMax: number; refractoryMs: number };
  jump: { riseOn: number; startMax: number; windowMs: number; landOff: number; refractoryMs: number };
  block: { wristNoseMax: number; holdMs: number; releaseMs: number };
  crouch: { dropOn: number; holdMs: number; dropOff: number };
  dodge: { leanOnDeg: number; hipDxMax: number; leanOffDeg: number };
  move: { on: number; off: number };
  event: { minConfidence: number; baseConfidence: number };
};

export const DEFAULT_CONFIG: MotionConfig = {
  oneEuro: { minCutoff: 1.0, beta: 3, imageBeta: 15, dCutoff: 1.0 },
  tracking: { visibilityMin: 0.5, edgeMargin: 0.02, resumeDebounceMs: 300, gapResetMs: 250 },
  calibration: { frames: 45, hipStableMax: 0.03, recalibrateRatio: 0.25 },
  punch: { extOn: 0.8, velOn: 2.5, elbowMinDeg: 100, extOff: 0.55, refractoryMs: 180 },
  kick: { liftOn: 0.35, otherFootMax: 0.1, velOn: 1.5, liftOff: 0.15, hipRiseMax: 0.06, refractoryMs: 350 },
  jump: { riseOn: 0.12, startMax: 0.03, windowMs: 300, landOff: 0.05, refractoryMs: 500 },
  block: { wristNoseMax: 0.7, holdMs: 100, releaseMs: 120 },
  crouch: { dropOn: 0.25, holdMs: 120, dropOff: 0.15 },
  dodge: { leanOnDeg: 15, hipDxMax: 0.3, leanOffDeg: 8 },
  move: { on: 0.45, off: 0.3 },
  event: { minConfidence: 0.5, baseConfidence: 0.6 },
};
