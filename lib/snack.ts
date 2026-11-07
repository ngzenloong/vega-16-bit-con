/** A short scene action advances only with visible, unpaused world time. */
export class SnackSequence {
  active = false;
  elapsed = 0;
  start() {
    if (this.active) return false;
    this.active = true;
    this.elapsed = 0;
    return true;
  }
  get step() {
    if (this.elapsed < 0.55) return 0;
    if (this.elapsed < 1.1) return 1;
    if (this.elapsed < 1.65) return 2;
    if (this.elapsed < 2.2) return 3;
    return 4;
  }
  get frame() {
    return [0.3, 0.55, 0.8, 1.1, 1.35, 1.65, 1.9, 2.2, 2.5].filter(
      (at) => this.elapsed >= at,
    ).length;
  }
  advance(dt: number) {
    if (!this.active) return false;
    this.elapsed += Math.max(0, Math.min(dt, 0.15));
    if (this.elapsed < 3) return false;
    this.active = false;
    return true;
  }
  cancel() {
    this.active = false;
    this.elapsed = 0;
  }
}
