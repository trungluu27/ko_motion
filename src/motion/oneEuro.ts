import type { Landmark, PoseFrame } from '../shared/types';
import type { MotionConfig } from './config';

const alpha = (cutoffHz: number, dtSec: number): number => {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
};

/** One Euro filter (Casiez et al., 2012). Time in milliseconds. */
export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private tPrev = 0;

  constructor(
    private readonly minCutoff: number,
    private readonly beta: number,
    private readonly dCutoff: number,
  ) {}

  filter(x: number, tMs: number): number {
    if (this.x === null || tMs <= this.tPrev) {
      if (this.x === null) this.x = x;
      this.tPrev = tMs;
      return this.x;
    }
    const dt = (tMs - this.tPrev) / 1000;
    this.tPrev = tMs;
    const rawDx = (x - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (x - this.x);
    return this.x;
  }

  reset(): void {
    this.x = null;
    this.dx = 0;
  }
}

/** Applies a One Euro filter to x, y, z of every image and world landmark. */
export class PoseSmoother {
  private filters = new Map<string, OneEuroFilter>();

  constructor(private readonly cfg: MotionConfig['oneEuro']) {}

  private f(key: string): OneEuroFilter {
    let f = this.filters.get(key);
    if (!f) {
      f = new OneEuroFilter(this.cfg.minCutoff, this.cfg.beta, this.cfg.dCutoff);
      this.filters.set(key, f);
    }
    return f;
  }

  private smoothList(prefix: string, list: Landmark[], t: number): Landmark[] {
    return list.map((l, i) => ({
      x: this.f(`${prefix}${i}x`).filter(l.x, t),
      y: this.f(`${prefix}${i}y`).filter(l.y, t),
      z: this.f(`${prefix}${i}z`).filter(l.z, t),
      visibility: l.visibility,
    }));
  }

  smooth(frame: PoseFrame): PoseFrame {
    return {
      ...frame,
      image: this.smoothList('i', frame.image, frame.t),
      world: this.smoothList('w', frame.world, frame.t),
    };
  }

  reset(): void {
    this.filters.clear();
  }
}
