import type { ActionEvent, Side } from '../../shared/types';
import type { MotionConfig } from '../config';
import type { Features } from '../features';
import { eventConfidence } from './confidence';

/** Fires when one foot rises fast above the other (relative, so standing farther/nearer than at calibration does not matter; a jump lifts both). */
export class KickRecognizer {
  private fired = false;
  private lastFire = -Infinity;

  constructor(
    private readonly side: Side,
    private readonly cfg: MotionConfig,
  ) {}

  update(f: Features, frameId: number): ActionEvent | null {
    const c = this.cfg.kick;
    const s = this.side;
    if (this.fired) {
      if (f.footRaise[s] < c.liftOff) this.fired = false;
      return null;
    }
    const triggered = f.footRaise[s] > c.liftOn && f.footRaiseVel[s] > c.velOn && f.t - this.lastFire >= c.refractoryMs;
    if (!triggered) return null;
    this.fired = true;
    this.lastFire = f.t;
    const vis = s === 'l' ? f.vis.legL : f.vis.legR;
    return {
      action: s === 'l' ? 'kick_l' : 'kick_r',
      confidence: eventConfidence(vis, f.footRaiseVel[s], c.velOn, this.cfg.event),
      t: f.t,
      frameId,
    };
  }

  reset(): void {
    this.fired = false;
    this.lastFire = -Infinity;
  }
}
