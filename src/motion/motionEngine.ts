import { type ActionEvent, type ControlFrame, DEFAULT_STATE, type PoseFrame } from '../shared/types';
import type { Calibration } from './calibration';
import { DEFAULT_CONFIG, type MotionConfig } from './config';
import { FeatureExtractor, type Features } from './features';
import { PoseSmoother } from './oneEuro';
import { JumpRecognizer } from './recognizers/jump';
import { KickRecognizer } from './recognizers/kick';
import { PunchRecognizer } from './recognizers/punch';
import { StateRecognizer } from './recognizers/states';
import { TrackingGate, trackingStatusOf } from './tracking';

export type EngineOutput = ControlFrame & {
  /** now - frame capture time, only when this frame produced events */
  latencyMs: number | null;
  needsRecalibration: boolean;
  features: Features | null;
};

type Recognizers = {
  extractor: FeatureExtractor;
  punches: PunchRecognizer[];
  kicks: KickRecognizer[];
  jump: JumpRecognizer;
  states: StateRecognizer;
};

/** PoseFrame stream in, ControlFrame stream out: smoothing, tracking gate, features, recognizers, conflict rules. */
export class MotionEngine {
  private smoother: PoseSmoother;
  private gate: TrackingGate;
  private rec: Recognizers | null = null;

  constructor(private readonly cfg: MotionConfig = DEFAULT_CONFIG) {
    this.smoother = new PoseSmoother(cfg.oneEuro);
    this.gate = new TrackingGate(cfg.tracking);
  }

  setCalibration(cal: Calibration | null): void {
    this.rec = cal
      ? {
          extractor: new FeatureExtractor(cal, this.cfg),
          punches: [new PunchRecognizer('l', this.cfg), new PunchRecognizer('r', this.cfg)],
          kicks: [new KickRecognizer('l', this.cfg), new KickRecognizer('r', this.cfg)],
          jump: new JumpRecognizer(cal, this.cfg),
          states: new StateRecognizer(this.cfg),
        }
      : null;
  }

  feed(f: PoseFrame | null, now: number): EngineOutput {
    const tracking = trackingStatusOf(f, this.cfg.tracking);
    const t = f ? f.t : now;
    const open = this.gate.update(tracking, t);
    const idle: EngineOutput = {
      t, events: [], state: { ...DEFAULT_STATE }, tracking, latencyMs: null, needsRecalibration: false, features: null,
    };
    if (!f || tracking !== 'ok') {
      this.smoother.reset();
      this.resetRecognizers();
      return idle;
    }
    const smoothed = this.smoother.smooth(f);
    if (!this.rec) return idle;
    const features = this.rec.extractor.update(smoothed);
    const needsRecalibration = Math.abs(features.torsoScale - 1) > this.cfg.calibration.recalibrateRatio;
    if (!open) {
      this.resetRecognizers();
      return { ...idle, needsRecalibration, features };
    }

    const { rec } = this;
    const state = rec.states.update(features);
    const candidates: (ActionEvent | null)[] = [
      ...rec.punches.map((p) => p.update(features, f.frameId)),
      ...rec.kicks.map((k) => k.update(features, f.frameId)),
      rec.jump.update(features, f.frameId),
    ];
    const events = candidates.filter((e): e is ActionEvent => {
      if (!e || e.confidence < this.cfg.event.minConfidence) return false;
      if (state.crouch && e.action === 'jump') return false;
      return true;
    });
    return {
      t,
      events,
      state,
      tracking,
      latencyMs: events.length ? now - f.t : null,
      needsRecalibration,
      features,
    };
  }

  private resetRecognizers(): void {
    if (!this.rec) return;
    this.rec.extractor.reset();
    for (const r of [...this.rec.punches, ...this.rec.kicks, this.rec.jump, this.rec.states]) r.reset();
  }

  reset(): void {
    this.smoother.reset();
    this.gate.reset();
    this.resetRecognizers();
  }
}
