import type { ActionEvent, Side } from '../../shared/types';
import type { MotionConfig } from '../config';
import type { Features } from '../features';
import { eventConfidence } from './confidence';

/** Fires when one ankle rises fast while the other foot stays planted and the hips are not rising. */
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
    const other: Side = s === 'l' ? 'r' : 'l';
    if (this.fired) {
      if (f.ankleLift[s] < c.liftOff) this.fired = false;
      return null;
    }
    const triggered =
      f.ankleLift[s] > c.liftOn &&
      f.ankleLift[other] < c.otherFootMax &&
      f.ankleLiftVel[s] > c.velOn &&
      f.hipDy > -c.hipRiseMax &&
      f.t - this.lastFire >= c.refractoryMs;
    if (!triggered) return null;
    this.fired = true;
    this.lastFire = f.t;
    const vis = s === 'l' ? f.vis.legL : f.vis.legR;
    return {
      action: s === 'l' ? 'kick_l' : 'kick_r',
      confidence: eventConfidence(vis, f.ankleLiftVel[s], c.velOn, this.cfg.event),
      t: f.t,
      frameId,
    };
  }

  reset(): void {
    this.fired = false;
    this.lastFire = -Infinity;
  }
}
