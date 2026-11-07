/** Whole-frame playback; hidden time never becomes animation catch-up. */
export class SpriteClock {
  frame = 0;
  private elapsed = 0;
  private playing = false;
  private frames: number;
  private fps: number;

  constructor(frames: number, fps: number) {
    this.frames = frames;
    this.fps = fps;
  }

  advance(seconds: number, playing: boolean) {
    if (!playing || !this.playing || this.frames < 2 || this.fps <= 0) {
      this.playing = playing;
      return this.frame;
    }
    this.elapsed += Math.min(0.1, Math.max(0, seconds));
    const steps = Math.floor(this.elapsed * this.fps + 1e-9);
    if (steps) {
      this.elapsed = Math.max(0, this.elapsed - steps / this.fps);
      this.frame = (this.frame + steps) % this.frames;
    }
    return this.frame;
  }

  reset() {
    this.frame = 0;
    this.elapsed = 0;
    this.playing = false;
  }
}
