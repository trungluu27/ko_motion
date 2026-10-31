import type { ActionEvent, Side } from '../../shared/types';
import type { MotionConfig } from '../config';
import type { Features } from '../features';
import { eventConfidence } from './confidence';

/** Fires once per fast arm extension; re-arms when the arm is pulled back. */
export class PunchRecognizer {
  private fired = false;
  private lastFire = -Infinity;

  constructor(
    private readonly side: Side,
    private readonly cfg: MotionConfig,
  ) {}

  update(f: Features, frameId: number): ActionEvent | null {
    const c = this.cfg.punch;
    const s = this.side;
    if (this.fired) {
      if (f.armExt[s] < c.extOff) this.fired = false;
      return null;
    }
    const triggered =
      f.armExt[s] > c.extOn &&
      f.armExtVel[s] > c.velOn &&
      f.elbowAngle[s] > c.elbowMinDeg &&
      f.wristInStrikeZone[s] &&
      f.t - this.lastFire >= c.refractoryMs;
    if (!triggered) return null;
    this.fired = true;
    this.lastFire = f.t;
    const vis = s === 'l' ? f.vis.armL : f.vis.armR;
    return {
      action: s === 'l' ? 'punch_l' : 'punch_r',
      confidence: eventConfidence(vis, f.armExtVel[s], c.velOn, this.cfg.event),
      t: f.t,
      frameId,
    };
  }

  reset(): void {
    this.fired = false;
    this.lastFire = -Infinity;
  }
}
