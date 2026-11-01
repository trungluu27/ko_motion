import type { Sfx } from './sfx';

export type Note = { step: number; voice: 'bass' | 'kick' | 'hat'; freq?: number };

export const BARS = 4;
const BPM = 112;
const STEPS = 16;
const LOOKAHEAD_S = 0.1;
const TICK_MS = 25;
const GAIN = 0.32;

/** Am – F – C – G roots (Hz) */
const ROOTS = [55, 87.31, 65.41, 49];
const BASS_STEPS = [0, 3, 6, 8, 10, 11, 14];
const OCTAVE_UP = new Set([6, 14]);

/** One bar of the procedural fight loop (spec phase5 6): four-on-the-floor kick, offbeat hats, a driving bass line. */
export function musicPattern(bar: number): Note[] {
  const root = ROOTS[((bar % BARS) + BARS) % BARS];
  const notes: Note[] = [];
  for (let step = 0; step < STEPS; step++) {
    if (step % 4 === 0) notes.push({ step, voice: 'kick' });
    if (step % 4 === 2 || step === 15) notes.push({ step, voice: 'hat' });
    if (BASS_STEPS.includes(step)) notes.push({ step, voice: 'bass', freq: OCTAVE_UP.has(step) ? root * 2 : root });
  }
  return notes;
}

/** Schedules musicPattern on the shared AudioContext with a short lookahead, so it also reaches recordings. */
export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private out: GainNode | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private enabled = true;

  constructor(private readonly sfx: Sfx) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) this.start();
    else this.stop();
  }

  start(): void {
    const audio = this.enabled ? this.sfx.audio() : null;
    if (!audio || this.timer) return;
    const { ctx, master } = audio;
    this.out = ctx.createGain();
    this.out.gain.value = GAIN;
    this.out.connect(master);
    this.nextTime = ctx.currentTime + 0.05;
    this.step = 0;
    this.bar = 0;
    this.timer = setInterval(() => this.schedule(ctx), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.out?.disconnect();
    this.out = null;
  }

  private schedule(ctx: AudioContext): void {
    const stepS = 60 / BPM / 4;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      for (const n of musicPattern(this.bar)) if (n.step === this.step) this.play(ctx, n, this.nextTime, stepS);
      this.nextTime += stepS;
      this.step = (this.step + 1) % STEPS;
      if (this.step === 0) this.bar = (this.bar + 1) % BARS;
    }
  }

  private play(ctx: AudioContext, n: Note, t: number, stepS: number): void {
    const out = this.out;
    if (!out) return;
    const g = ctx.createGain();
    g.connect(out);
    if (n.voice === 'kick') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.2);
    } else if (n.voice === 'hat') {
      const len = Math.floor(ctx.sampleRate * 0.04);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      g.gain.value = 0.25;
      src.connect(hp).connect(g);
      src.start(t);
    } else {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(n.freq ?? 55, t);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepS * 1.8);
      o.connect(lp).connect(g);
      o.start(t);
      o.stop(t + stepS * 2);
    }
  }
}
