import type { ActionEvent, Side } from '../../shared/types';
import type { MotionConfig } from '../config';
import type { Features } from '../features';
import { eventConfidence } from './confidence';

/**
 * Fires once when the elbow straightens quickly (relative to its lowest angle in the last riseWindowMs)
 * with visible reach, either in the image (sideways stance) or in 3D; re-arms when the elbow bends back.
 */
export class PunchRecognizer {
  private fired = false;
  private lastFire = -Infinity;
  private recent: { t: number; elbow: number }[] = [];

  constructor(
    private readonly side: Side,
    private readonly cfg: MotionConfig,
  ) {}

  update(f: Features, frameId: number): ActionEvent | null {
    const c = this.cfg.punch;
    const s = this.side;
    const elbow = f.elbowAngle[s];
    if (f.dt === 0) this.recent = [];
    this.recent.push({ t: f.t, elbow });
    this.recent = this.recent.filter((r) => f.t - r.t <= c.riseWindowMs);
    if (this.fired) {
      if (elbow < c.elbowOffDeg) this.fired = false;
      return null;
    }
    const rise = elbow - Math.min(...this.recent.map((r) => r.elbow));
    const triggered =
      elbow > c.elbowOnDeg &&
      rise > c.elbowRiseDeg &&
      (f.reach2d[s] > c.reachOn || f.armExt[s] > c.extOn) &&
      f.wristInStrikeZone[s] &&
      f.t - this.lastFire >= c.refractoryMs;
    if (!triggered) return null;
    this.fired = true;
    this.lastFire = f.t;
    const vis = s === 'l' ? f.vis.armL : f.vis.armR;
    return {
      action: s === 'l' ? 'punch_l' : 'punch_r',
      confidence: eventConfidence(vis, rise, c.elbowRiseDeg, this.cfg.event),
      t: f.t,
      frameId,
    };
  }

  reset(): void {
    this.fired = false;
    this.lastFire = -Infinity;
    this.recent = [];
  }
}
