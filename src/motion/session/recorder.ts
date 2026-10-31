import type { PoseFrame } from '../../shared/types';
import type { Label, Session } from './format';

export type SessionMeta = Omit<Session, 'frames' | 'labels' | 'version'>;

/** Accumulates pose frames and labels between start() and stop(). */
export class SessionRecorder {
  private meta: SessionMeta | null = null;
  private frames: PoseFrame[] = [];
  private labels: Label[] = [];

  get recording(): boolean {
    return this.meta !== null;
  }

  start(meta: SessionMeta): void {
    this.meta = meta;
    this.frames = [];
    this.labels = [];
  }

  addFrame(f: PoseFrame): void {
    if (this.meta) this.frames.push(f);
  }

  addLabel(l: Label): void {
    if (this.meta) this.labels.push(l);
  }

  stop(): Session {
    const meta = this.meta ?? { createdAt: new Date().toISOString(), width: 0, height: 0, model: 'full', calibration: null };
    this.meta = null;
    return { version: 1, ...meta, labels: this.labels, frames: this.frames };
  }
}
