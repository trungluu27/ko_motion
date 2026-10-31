import type { ActionEvent, PoseFrame } from '../../src/shared/types';
import { KickRecognizer } from '../../src/motion/recognizers/kick';
import { FeatureExtractor, type Features } from '../../src/motion/features';
import { DEFAULT_CONFIG } from '../../src/motion/config';
import { defaultCalibration } from './synthPose';

/** Features for a synthetic sequence, using the default synthetic calibration. */
export function featuresOf(frames: PoseFrame[]): { f: Features; frameId: number }[] {
  const fx = new FeatureExtractor(defaultCalibration(), DEFAULT_CONFIG);
  return frames.map((fr) => ({ f: fx.update(fr), frameId: fr.frameId }));
}

/** All kick events (both sides) recognized in a synthetic sequence. */
export function kickEvents(frames: PoseFrame[]): ActionEvent[] {
  const recs = [new KickRecognizer('l', DEFAULT_CONFIG), new KickRecognizer('r', DEFAULT_CONFIG)];
  const out: ActionEvent[] = [];
  for (const { f, frameId } of featuresOf(frames)) for (const r of recs) {
    const e = r.update(f, frameId);
    if (e) out.push(e);
  }
  return out;
}
