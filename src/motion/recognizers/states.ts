import type { ControlState } from '../../shared/types';
import type { MotionConfig } from '../config';
import type { Features } from '../features';

/** Boolean that turns on after `on` holds for holdMs and off after `off` holds for releaseMs. */
class HeldSwitch {
  private value = false;
  private since: number | null = null;

  constructor(private readonly holdMs: number, private readonly releaseMs: number) {}

  update(on: boolean, off: boolean, t: number): boolean {
    const wantsChange = this.value ? off : on;
    if (!wantsChange) {
      this.since = null;
      return this.value;
    }
    if (this.since === null) this.since = t;
    if (t - this.since >= (this.value ? this.releaseMs : this.holdMs)) {
      this.value = !this.value;
      this.since = null;
    }
    return this.value;
  }

  reset(): void {
    this.value = false;
    this.since = null;
  }
}

const sign = (x: number): -1 | 1 => (x < 0 ? -1 : 1);

/** Continuous control state (block, crouch, dodge, move) with hold times and hysteresis. */
export class StateRecognizer {
  private block: HeldSwitch;
  private crouch: HeldSwitch;
  private dodge: -1 | 0 | 1 = 0;
  private move: -1 | 0 | 1 = 0;
  private lastFootUp = -Infinity;

  constructor(private readonly cfg: MotionConfig) {
    this.block = new HeldSwitch(cfg.block.holdMs, cfg.block.releaseMs);
    this.crouch = new HeldSwitch(cfg.crouch.holdMs, 0);
  }

  update(f: Features): ControlState {
    const { block: b, crouch: c, dodge: d, move: m } = this.cfg;
    // Punching wins over blocking: an arm extending out of the guard releases the block at once.
    const armOut = f.elbowAngle.l > b.armOutElbowDeg || f.elbowAngle.r > b.armOutElbowDeg;
    if (armOut) this.block.reset();
    const guarding =
      !armOut &&
      f.wristAboveShoulder.l && f.wristAboveShoulder.r &&
      f.wristNose.l < b.wristNoseMax && f.wristNose.r < b.wristNoseMax &&
      f.wristNose.l + f.wristNose.r < b.wristNoseSumMax;
    const block = this.block.update(guarding, !guarding, f.t);
    const crouch = this.crouch.update(f.hipDy > c.dropOn, f.hipDy < c.dropOff, f.t);

    if (this.move === 0) {
      if (Math.abs(f.hipDx) > m.on) this.move = sign(f.hipDx);
    } else if (Math.abs(f.hipDx) < m.off) {
      this.move = 0;
    }

    // kicking tips the torso: no dodge while a foot is up or shortly after
    if (Math.max(f.footRaise.l, f.footRaise.r) > this.cfg.kick.liftOff) this.lastFootUp = f.t;
    const kicking = f.t - this.lastFootUp < d.kickGuardMs;
    if (kicking) {
      this.dodge = 0;
    } else if (this.dodge === 0) {
      if (Math.abs(f.lean) > d.leanOnDeg && Math.abs(f.hipDx) < d.hipDxMax) this.dodge = sign(f.lean);
    } else if (Math.abs(f.lean) < d.leanOffDeg || Math.abs(f.hipDx) >= d.hipDxMax) {
      this.dodge = 0;
    }

    return { block, crouch, dodge: this.dodge, move: this.move };
  }

  reset(): void {
    this.block.reset();
    this.crouch.reset();
    this.dodge = 0;
    this.move = 0;
    this.lastFootUp = -Infinity;
  }
}
