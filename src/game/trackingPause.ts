import type { TrackingStatus } from '../shared/types';

export const LOSS_TO_PAUSE_MS = 500;
export const OK_TO_RESUME_MS = 1000;
export const COUNTDOWN_MS = 3000;

export type PauseView = { paused: boolean; countdown: number | null };

/** Pauses the fight when the player leaves the camera and resumes with a 3-2-1 countdown (spec 7). */
export class TrackingPause {
  private mode: 'running' | 'paused' | 'countdown' = 'running';
  private lostSince: number | null = null;
  private okSince: number | null = null;
  private countdownStart = 0;

  update(tracking: TrackingStatus, now: number, matchOver: boolean): PauseView {
    if (matchOver) {
      this.reset();
      return { paused: false, countdown: null };
    }
    const ok = tracking === 'ok';
    if (ok) {
      this.lostSince = null;
      this.okSince ??= now;
    } else {
      this.okSince = null;
      this.lostSince ??= now;
    }

    if (this.mode === 'running' && !ok && now - (this.lostSince ?? now) >= LOSS_TO_PAUSE_MS) this.mode = 'paused';
    if (this.mode === 'countdown' && !ok) this.mode = 'paused';
    if (this.mode === 'paused' && ok && now - (this.okSince ?? now) >= OK_TO_RESUME_MS) {
      this.mode = 'countdown';
      this.countdownStart = now;
    }
    if (this.mode === 'countdown') {
      const left = COUNTDOWN_MS - (now - this.countdownStart);
      if (left <= 0) this.mode = 'running';
      else return { paused: true, countdown: Math.ceil(left / 1000) };
    }
    return { paused: this.mode === 'paused', countdown: null };
  }

  reset(): void {
    this.mode = 'running';
    this.lostSince = null;
    this.okSince = null;
  }
}
