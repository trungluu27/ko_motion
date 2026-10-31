import type { SimEvent } from '../sim/types';

/** Tiny WebAudio synth for combat sounds; the AudioContext is created on the first user gesture. */
export class Sfx {
  private ctx: AudioContext | null = null;

  unlock(): void {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
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
    src.connect(filter).connect(g).connect(ctx.destination);
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
    o.connect(g).connect(ctx.destination);
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
