import type { PoseFrame, TrackingStatus } from '../shared/types';
import type { MotionConfig } from './config';
import { KEY_JOINTS } from './landmarks';

export function trackingStatusOf(f: PoseFrame | null, cfg: MotionConfig['tracking']): TrackingStatus {
  if (!f || f.image.length === 0) return 'no_person';
  if (KEY_JOINTS.some((i) => f.image[i].visibility < cfg.visibilityMin)) return 'partial';
  const lo = cfg.edgeMargin;
  const hi = 1 - cfg.edgeMargin;
  if (KEY_JOINTS.some((i) => {
    const { x, y } = f.image[i];
    return x < lo || x > hi || y < lo || y > hi;
  })) return 'out_of_frame';
  return 'ok';
}

/** Allows recognition only after tracking has been ok for resumeDebounceMs following a loss. */
export class TrackingGate {
  private everLost = false;
  private okSince: number | null = null;

  constructor(private readonly cfg: MotionConfig['tracking']) {}

  update(status: TrackingStatus, t: number): boolean {
    if (status !== 'ok') {
      this.everLost = true;
      this.okSince = null;
      return false;
    }
    if (this.okSince === null) this.okSince = t;
    return !this.everLost || t - this.okSince >= this.cfg.resumeDebounceMs;
  }

  reset(): void {
    this.everLost = false;
    this.okSince = null;
  }
}
