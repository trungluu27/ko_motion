import type { PoseFrame } from '../../src/shared/types';
import { FeatureExtractor, type Features } from '../../src/motion/features';
import { DEFAULT_CONFIG } from '../../src/motion/config';
import { defaultCalibration } from './synthPose';

/** Features for a synthetic sequence, using the default synthetic calibration. */
export function featuresOf(frames: PoseFrame[]): { f: Features; frameId: number }[] {
  const fx = new FeatureExtractor(defaultCalibration(), DEFAULT_CONFIG);
  return frames.map((fr) => ({ f: fx.update(fr), frameId: fr.frameId }));
}
