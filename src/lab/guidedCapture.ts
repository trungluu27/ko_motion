import type { Label, LabelAction } from '../motion/session/format';

export type CaptureStep = { action: LabelAction; prompt: string; durationMs: number; expectedCount?: number };

const reps = (action: LabelAction, name: string): CaptureStep => ({
  action, prompt: `Làm ${name} ×10`, durationMs: 25_000, expectedCount: 10,
});
const hold = (action: LabelAction, name: string): CaptureStep => ({
  action, prompt: `Giữ ${name} 3 giây`, durationMs: 6_000,
});

export const DEFAULT_SCRIPT: CaptureStep[] = [
  reps('punch_l', 'ĐẤM TRÁI'),
  reps('punch_r', 'ĐẤM PHẢI'),
  reps('kick_l', 'ĐÁ TRÁI'),
  reps('kick_r', 'ĐÁ PHẢI'),
  reps('jump', 'NHẢY'),
  hold('block', 'BLOCK (2 tay che mặt)'),
  hold('crouch', 'CÚI THẤP'),
  hold('dodge_l', 'NGHIÊNG TRÁI'),
  hold('dodge_r', 'NGHIÊNG PHẢI'),
  hold('move_l', 'BƯỚC SANG TRÁI'),
  hold('move_r', 'BƯỚC SANG PHẢI'),
  { action: 'idle', prompt: 'Di chuyển tự do, KHÔNG ra đòn', durationMs: 60_000 },
];

export type CaptureUpdate = {
  step: CaptureStep | null;
  phase: 'rest' | 'perform' | 'done';
  remainingMs: number;
  newLabel?: Label;
};

/** Timed script: a rest before each step, then the step's perform window, which becomes a ground-truth label. */
export class GuidedCapture {
  private index = 0;
  private phase: CaptureUpdate['phase'] = 'rest';
  private phaseStart = 0;

  constructor(private readonly script: CaptureStep[], private readonly restMs = 3000) {}

  start(t: number): void {
    this.index = 0;
    this.phase = this.script.length ? 'rest' : 'done';
    this.phaseStart = t;
  }

  private duration(): number {
    return this.phase === 'rest' ? this.restMs : this.script[this.index].durationMs;
  }

  /** Moves to the next phase at time `at`; returns the label when a perform window closes. */
  private advance(at: number): Label | undefined {
    if (this.phase === 'rest') {
      this.phase = 'perform';
      this.phaseStart = at;
      return undefined;
    }
    if (this.phase === 'done') return undefined;
    const step = this.script[this.index];
    const label: Label = { action: step.action, tStart: this.phaseStart, tEnd: at };
    if (step.expectedCount !== undefined) label.expectedCount = step.expectedCount;
    this.index++;
    this.phase = this.index < this.script.length ? 'rest' : 'done';
    this.phaseStart = at;
    return label;
  }

  private snapshot(t: number, newLabel?: Label): CaptureUpdate {
    if (this.phase === 'done') return { step: null, phase: 'done', remainingMs: 0, newLabel };
    return {
      step: this.script[this.index],
      phase: this.phase,
      remainingMs: Math.max(0, this.phaseStart + this.duration() - t),
      newLabel,
    };
  }

  update(t: number): CaptureUpdate {
    let newLabel: Label | undefined;
    while (this.phase !== 'done' && t >= this.phaseStart + this.duration()) {
      newLabel = this.advance(this.phaseStart + this.duration()) ?? newLabel;
    }
    return this.snapshot(t, newLabel);
  }

  /** Ends the current phase now (keyboard shortcut N). */
  skip(t: number): CaptureUpdate {
    return this.snapshot(t, this.advance(t));
  }
}
