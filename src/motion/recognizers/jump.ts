import type { ActionEvent } from '../../shared/types';
import type { Calibration } from '../calibration';
import type { MotionConfig } from '../config';
import type { Features } from '../features';
import { eventConfidence } from './confidence';

/** Fires when hips and both ankles rise quickly from a grounded stance; tracks airborne until landing. */
export class JumpRecognizer {
  private recent: { t: number; rise: number }[] = [];
  private airborne = false;
  private lastFire = -Infinity;
  private readonly ankleOn: number;

  constructor(cal: Calibration, private readonly cfg: MotionConfig) {
    this.ankleOn = (cfg.jump.riseOn * cal.torsoPx) / cal.legPx;
  }

  update(f: Features, frameId: number): ActionEvent | null {
    const c = this.cfg.jump;
    const rise = -f.hipDy;
    const fromGround = this.recent.some((s) => f.t - s.t <= c.windowMs && s.rise < c.startMax);
    this.recent.push({ t: f.t, rise });
    this.recent = this.recent.filter((s) => f.t - s.t <= c.windowMs);

    if (this.airborne) {
      if (rise < c.landOff) this.airborne = false;
      return null;
    }
    const triggered =
      rise > c.riseOn &&
      f.ankleLift.l > this.ankleOn &&
      f.ankleLift.r > this.ankleOn &&
      fromGround &&
      f.t - this.lastFire >= c.refractoryMs;
    if (!triggered) return null;
    this.airborne = true;
    this.lastFire = f.t;
    return {
      action: 'jump',
      confidence: eventConfidence((f.vis.legL + f.vis.legR) / 2, rise, c.riseOn, this.cfg.event),
      t: f.t,
      frameId,
    };
  }

  isAirborne(): boolean {
    return this.airborne;
  }

  reset(): void {
    this.recent = [];
    this.airborne = false;
    this.lastFire = -Infinity;
  }
}
