import { percentile } from '../shared/math';

/** Rolling window of latency samples (ms). */
export class LatencyStats {
  private samples: number[] = [];

  constructor(private readonly capacity = 200) {}

  add(ms: number): void {
    this.samples.push(ms);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  p50(): number | null {
    return this.samples.length ? percentile(this.samples, 50) : null;
  }

  p95(): number | null {
    return this.samples.length ? percentile(this.samples, 95) : null;
  }
}

/** Ticks per second over the last 1000 ms. */
export class FpsCounter {
  private ticks: number[] = [];

  tick(t: number): void {
    this.ticks.push(t);
    while (this.ticks.length && this.ticks[0] <= t - 1000) this.ticks.shift();
  }

  fps(): number {
    return this.ticks.length;
  }
}
