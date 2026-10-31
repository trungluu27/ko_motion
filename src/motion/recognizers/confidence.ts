import { clamp01 } from '../../shared/math';
import type { MotionConfig } from '../config';

/** Visibility times how far the primary signal overshoots its trigger threshold. */
export function eventConfidence(vis: number, primary: number, on: number, cfg: MotionConfig['event']): number {
  return vis * clamp01(cfg.baseConfidence + (0.4 * (primary - on)) / on);
}
