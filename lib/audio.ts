import type { GameId } from "./types";
export type Track = "hall" | GameId;
const REVISION = "life-sim-scores-20261107";
const tones: Record<string, number[]> = {
  click: [520],
  near: [660, 780],
  jump: [220, 440],
  hit: [740],
  collect: [784, 1047],
  hurt: [165, 110],
  win: [523, 659, 784, 1047],
  lose: [262, 196, 147],
  talk: [185],
  start: [392, 523, 784],
  steer: [294],
  accelerate: [165, 247],
  brake: [196, 130],
  boost: [523, 784, 1047],
  pass: [659, 880],
};
const cooldown: Record<string, number> = {
  talk: 0.08,
  hit: 0.035,
  steer: 0.07,
  near: 0.12,
};
class AudioBus {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: BiquadFilterNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffers = new Map<Track, Promise<AudioBuffer>>();
  private track: Track = "hall";
  private started = 0;
  private seek = 0;
  private duration = 0;
  private offsets: Record<Track, number> = {
    hall: 0, breaker: 0, runner: 0, kart: 0, beat: 0,
  };
  private engine: { oscillator: OscillatorNode; gain: GainNode } | null = null;
  private playback = 0;
  private cancelPending: (() => void) | null = null;
  private intent = 0;
  private ducking = 1;
  private lastEffect = new Map<string, number>();
  enabled = false;
  lastError: string | null = null;
  private async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.context.destination);
      this.music = this.context.createGain();
      this.music.gain.value = 0.72 * this.ducking;
      this.music.connect(this.master);
      this.effects = this.context.createBiquadFilter();
      this.effects.type = "lowpass";
      this.effects.frequency.value = 2800;
      this.effects.Q.value = 0.4;
      this.effects.connect(this.master);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }
  async setEnabled(enabled: boolean) {
    const ticket = ++this.intent;
    this.enabled = enabled;
    this.lastError = null;
    if (!enabled) {
      this.pause();
      this.master?.gain.setTargetAtTime(0, this.context!.currentTime, 0.015);
      return false;
    }
    try {
      await this.unlock();
      if (ticket !== this.intent || !this.enabled) return this.enabled;
      this.master!.gain.setTargetAtTime(0.8, this.context!.currentTime, 0.02);
      return true;
    } catch {
      if (ticket === this.intent) {
        this.enabled = false;
        this.lastError = "Sound is unavailable. Try again.";
      }
      return false;
    }
  }
  private buffer(track: Track) {
    let pending = this.buffers.get(track);
    if (!pending) {
      const load = async (extension: string) => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new DOMException("Audio load timed out", "TimeoutError"));
            controller.abort();
          }, 8000);
        });
        try {
          return await Promise.race([
            (async () => {
              const response = await fetch(`/audio/${track}.${extension}?v=${REVISION}`, { signal: controller.signal });
              if (!response.ok) throw Error("Audio unavailable");
              return this.context!.decodeAudioData(await response.arrayBuffer());
            })(),
            timeout,
          ]);
        } finally {
          clearTimeout(timer!);
        }
      };
      pending = load("ogg").catch((error) => {
        if (error.name === "TimeoutError") throw error;
        return load("wav");
      });
      this.buffers.set(track, pending);
      pending.catch(() => {
        if (this.buffers.get(track) === pending) this.buffers.delete(track);
      });
    }
    // Keep only the active score and the previous room decoded.
    this.buffers.delete(track);
    this.buffers.set(track, pending);
    while (this.buffers.size > 2) {
      const oldest = this.buffers.keys().next().value!;
      this.buffers.delete(oldest);
    }
    return pending;
  }
  async prepare(track: Track) {
    await this.unlock();
    await this.buffer(track);
  }
  async play(track: Track, offset?: number) {
    if (this.source && this.track === track && offset === undefined)
      return true;
    this.pause();
    const ticket = this.playback;
    this.track = track;
    if (offset !== undefined) this.offsets[track] = Math.max(0, offset);
    if (!this.enabled || document.hidden) return false;
    let cancel: () => void;
    const cancelled = new Promise<null>((resolve) => {
      cancel = () => resolve(null);
      this.cancelPending = cancel;
    });
    try {
      const buffer = await Promise.race([
        (async () => {
          await this.unlock();
          return this.buffer(track);
        })(),
        cancelled,
      ]);
      if (
        !buffer ||
        !this.enabled ||
        document.hidden ||
        this.track !== track ||
        ticket !== this.playback
      )
        return false;
      const source = this.context!.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;
      source.connect(this.music!);
      this.duration = buffer.duration;
      const seek = (offset ?? this.offsets[track]) % buffer.duration,
        when = this.context!.currentTime + 0.04;
      source.start(when, seek);
      this.seek = seek;
      this.started = when - seek;
      this.source = source;
      this.lastError = null;
      return true;
    } catch (error) {
      if (ticket !== this.playback || this.track !== track || !this.enabled)
        return false;
      this.lastError = "Music could not load. Turn sound on to try again.";
      throw error;
    } finally {
      if (this.cancelPending === cancel!) this.cancelPending = null;
    }
  }
  /** Unwrapped song time mapped to audible output, when the browser supplies it. */
  position(track: Track, performanceTime = performance.now()) {
    if (!this.source || !this.context || this.track !== track || !this.enabled)
      return null;
    const stamp = performanceTime > 1e12 ? performance.now() : performanceTime;
    const output = this.context.getOutputTimestamp?.();
    const audible =
      output &&
      typeof output.performanceTime === "number" &&
      output.performanceTime > 0 &&
      typeof output.contextTime === "number"
        ? output.contextTime + (stamp - output.performanceTime) / 1000
        : this.context.currentTime +
          (stamp - performance.now()) / 1000 -
          (this.context.outputLatency || 0);
    return Math.max(this.seek, audible - this.started);
  }
  pause() {
    this.playback++;
    this.cancelPending?.();
    this.cancelPending = null;
    this.motor(0);
    if (this.source) {
      this.offsets[this.track] =
        Math.max(0, this.context!.currentTime - this.started) %
        (this.duration || 1);
      try {
        this.source.stop();
      } catch {}
      this.source.disconnect();
      this.source = null;
    }
  }
  motor(ratio: number) {
    const ctx = this.context;
    if (!ctx || !this.enabled || ratio <= 0) {
      if (this.engine) {
        this.engine.oscillator.stop();
        this.engine.oscillator.disconnect();
        this.engine.gain.disconnect();
        this.engine = null;
      }
      return;
    }
    if (!this.engine) {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.type = "triangle";
      gain.gain.value = 0.012;
      oscillator.connect(gain);
      gain.connect(this.effects!);
      oscillator.start();
      this.engine = { oscillator, gain };
    }
    this.engine.oscillator.frequency.setTargetAtTime(
      65 + Math.min(1.2, ratio) * 150,
      ctx.currentTime,
      0.07,
    );
  }
  duck(value: number) {
    this.ducking = value;
    if (this.music && this.context)
      this.music.gain.setTargetAtTime(
        value * 0.72,
        this.context.currentTime,
        0.1,
      );
  }
  effect(kind: string) {
    const ctx = this.context;
    if (!this.enabled || !ctx || !this.effects || document.hidden) return;
    if (
      ctx.currentTime - (this.lastEffect.get(kind) ?? -Infinity) <
      (cooldown[kind] || 0)
    )
      return;
    this.lastEffect.set(kind, ctx.currentTime);
    (tones[kind] || tones.click).forEach((frequency, index) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain(),
        start = ctx.currentTime + index * 0.055;
      oscillator.type = ["win", "collect", "near"].includes(kind)
        ? "sine"
        : "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(55, frequency * (kind === "jump" ? 1.65 : 0.9)),
        start + 0.065,
      );
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        kind === "talk" ? 0.018 : 0.065,
        start + 0.006,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      oscillator.connect(gain);
      gain.connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.1);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
}
export const audio = new AudioBus();
