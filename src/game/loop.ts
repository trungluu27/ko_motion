/** Fixed-timestep accumulator: converts frame deltas into a bounded number of sim ticks. */
export class FixedStep {
  private acc = 0;

  constructor(
    private readonly stepMs = 1000 / 60,
    private readonly maxSteps = 5,
  ) {}

  advance(dtMs: number): number {
    this.acc += dtMs;
    const steps = Math.floor(this.acc / this.stepMs);
    if (steps > this.maxSteps) {
      this.acc = 0;
      return this.maxSteps;
    }
    this.acc -= steps * this.stepMs;
    return steps;
  }
}
