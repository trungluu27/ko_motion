import { loadSettings } from '../settings';
import type { SimEvent } from '../sim/types';

/** Tiny WebAudio synth for combat sounds; the AudioContext is created on the first user gesture. */
export class Sfx {
  private static instance: Sfx | null = null;

  /** One shared synth, so every scene's sounds (and the music) reach the same recording stream. */
  static get(): Sfx {
    Sfx.instance ??= new Sfx();
    return Sfx.instance;
  }

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  private volume = loadSettings().sfxVolume;

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Master volume 0..1 (settings). */
  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  /** Menu cursor tick. */
  ui(): void {
    this.tone('triangle', 900, 700, 40, 0.12);
  }

  /** Audio of every sound effect, for recording alongside the canvas. */
  recordingStream(): MediaStream | null {
    this.unlock();
    if (!this.ctx || !this.master) return null;
    if (!this.recordDest) {
      this.recordDest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.recordDest);
    }
    return this.recordDest.stream;
  }

  private noise(durMs: number, filterHz: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const len = Math.floor((ctx.sampleRate * durMs) / 1000);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterHz;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master ?? ctx.destination);
    src.start();
  }

  private tone(type: OscillatorType, from: number, to: number, durMs: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + durMs / 1000);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + durMs / 1000);
    o.connect(g).connect(this.master ?? ctx.destination);
    o.start(t);
    o.stop(t + durMs / 1000);
  }

  play(e: SimEvent): void {
    switch (e.type) {
      case 'attack':
        this.noise(120, 1800, 0.25);
        break;
      case 'hit':
      case 'guard_break':
        this.tone('sine', 120, 60, 100, 0.6);
        this.noise(80, 600, 0.4);
        break;
      case 'blocked':
        this.tone('square', 600, 500, 60, 0.15);
        break;
      case 'ko':
        this.tone('sawtooth', 400, 80, 600, 0.3);
        break;
      default:
        break;
    }
  }
}
