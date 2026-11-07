/** Game deadlines advance by the same time that physics consumes. */
export class SimulationClock {
  elapsed = 0;
  private remainder = 0;
  readonly step: number;
  readonly maxCatchup: number;
  constructor(step = 1 / 120, maxCatchup = 0.25) {
    this.step = step;
    this.maxCatchup = maxCatchup;
  }
  advance(raw: number, update: (dt: number, time: number) => void) {
    this.remainder += Math.max(0, Math.min(raw, this.maxCatchup));
    while (this.remainder + 1e-9 >= this.step) {
      this.remainder -= this.step;
      this.elapsed += this.step;
      update(this.step, this.elapsed);
    }
    return this.elapsed;
  }
  clearRemainder() {
    this.remainder = 0;
  }
  reset() {
    this.elapsed = 0;
    this.remainder = 0;
  }
}
