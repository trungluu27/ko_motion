import { describe, expect, test } from 'vitest';
import { MotionEngine, type EngineOutput } from '../../src/motion/motionEngine';
import { Calibrator } from '../../src/motion/calibration';
import { DEFAULT_CONFIG } from '../../src/motion/config';
import { LM } from '../../src/motion/landmarks';
import type { PoseFrame } from '../../src/shared/types';
import { type ArmPose, type SynthParams, synthFrame, synthSequence } from '../helpers/synthPose';

const fwd = (ext: number): ArmPose => ({ ext, dir: 'forward' });
const cover = { armL: { ext: 0, dir: 'cover' as const }, armR: { ext: 0, dir: 'cover' as const } };
const T0 = 2000;

/** Engine calibrated on the default stance, with tracking already open, at time T0. */
function calibratedEngine(): MotionEngine {
  const engine = new MotionEngine();
  const cal = new Calibrator(DEFAULT_CONFIG);
  let ready;
  for (let i = 0; !ready; i++) ready = cal.push(synthFrame({}, i * 33.3)).calibration;
  engine.setCalibration(ready);
  for (let t = T0 - 300; t < T0 - 10; t += 33.3) engine.feed(synthFrame({}, t), t);
  return engine;
}

const feedAll = (engine: MotionEngine, frames: PoseFrame[], lag = 40): EngineOutput[] =>
  frames.map((f) => engine.feed(f, f.t + lag));
const seq = (keys: { t: number; p: Partial<SynthParams> }[]) =>
  synthSequence(keys.map((k) => ({ ...k, t: T0 + k.t })));
const events = (outs: EngineOutput[]) => outs.flatMap((o) => o.events);
const jab = (t0: number) => [
  { t: t0, p: { armL: fwd(0.45) } },
  { t: t0 + 100, p: { armL: fwd(0.95) } },
  { t: t0 + 250, p: { armL: fwd(0.45) } },
];

describe('MotionEngine', () => {
  test('emits nothing before calibration', () => {
    const engine = new MotionEngine();
    const outs = feedAll(engine, seq([...jab(0), { t: 500, p: { armL: fwd(0.45) } }]));
    expect(events(outs)).toHaveLength(0);
  });

  test('a calibrated jab yields punch_l with latency', () => {
    const outs = feedAll(calibratedEngine(), seq([...jab(0), { t: 500, p: { armL: fwd(0.45) } }]));
    const ev = events(outs);
    expect(ev.map((e) => e.action)).toEqual(['punch_l']);
    const out = outs.find((o) => o.events.length)!;
    expect(out.latencyMs).toBeCloseTo(40, 6);
    expect(out.tracking).toBe('ok');
  });

  test('punches are suppressed while blocking', () => {
    const outs = feedAll(calibratedEngine(), [
      ...seq([{ t: 0, p: cover }, { t: 300, p: cover }]),
      ...seq([{ t: 333, p: { ...cover, armL: fwd(0.45) } }, { t: 433, p: { ...cover, armL: fwd(0.95) } }, { t: 700, p: { ...cover, armL: fwd(0.95) } }]),
    ]);
    expect(outs.some((o) => o.state.block)).toBe(true);
    expect(events(outs)).toHaveLength(0);
  });

  test('standing up quickly from a crouch is not a jump', () => {
    const outs = feedAll(calibratedEngine(), seq([
      { t: 0, p: { hipDrop: 0.15 } },
      { t: 300, p: { hipDrop: 0.15 } },
      { t: 400, p: {} },
      { t: 700, p: {} },
    ]));
    expect(outs.some((o) => o.state.crouch)).toBe(true);
    expect(events(outs)).toHaveLength(0);
  });

  test('losing a key joint mid-motion suppresses output until tracking is stable for 300 ms', () => {
    const engine = calibratedEngine();
    const lost = engine.feed(synthFrame({ liftR: 0.3, hidden: [LM.R_ANKLE, LM.R_KNEE] }, T0), T0);
    expect(lost.tracking).toBe('partial');
    expect(lost.events).toHaveLength(0);
    expect(lost.state).toEqual({ block: false, crouch: false, dodge: 0, move: 0 });
    const early = feedAll(engine, seq([{ t: 33, p: {} }, ...jab(66), { t: 340, p: { armL: fwd(0.45) } }]));
    expect(events(early)).toHaveLength(0);
    const later = feedAll(engine, seq([{ t: 373, p: {} }, ...jab(400), { t: 800, p: { armL: fwd(0.45) } }]));
    expect(events(later).map((e) => e.action)).toEqual(['punch_l']);
  });

  test('flags recalibration when the player moves much closer to the camera', () => {
    const near = feedAll(calibratedEngine(), seq([{ t: 0, p: { scale: 0.33 } }, { t: 500, p: { scale: 0.33 } }]));
    expect(near[near.length - 1].needsRecalibration).toBe(true);
    const slight = feedAll(calibratedEngine(), seq([{ t: 0, p: { scale: 0.27 } }, { t: 500, p: { scale: 0.27 } }]));
    expect(slight[slight.length - 1].needsRecalibration).toBe(false);
  });
});
