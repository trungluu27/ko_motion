import { Calibrator } from '../calibration';
import { DEFAULT_CONFIG } from '../config';
import { type EngineOutput, MotionEngine } from '../motionEngine';
import type { Session } from './format';

/** Runs a recorded session through the engine; calibrates from the first stable frames if the session has none. */
export function replaySession(s: Session, engine: MotionEngine = new MotionEngine()): EngineOutput[] {
  const calibrator = s.calibration ? null : new Calibrator(DEFAULT_CONFIG);
  engine.setCalibration(s.calibration);
  let calibrated = s.calibration !== null;
  return s.frames.map((f) => {
    if (!calibrated && calibrator) {
      const cal = calibrator.push(f).calibration;
      if (cal) {
        engine.setCalibration(cal);
        calibrated = true;
      }
    }
    return engine.feed(f, f.t);
  });
}
