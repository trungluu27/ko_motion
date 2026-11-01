import { describe, expect, test } from 'vitest';
import { StateRecognizer } from '../../../src/motion/recognizers/states';
import { DEFAULT_CONFIG } from '../../../src/motion/config';
import type { ControlState } from '../../../src/shared/types';
import { type SynthParams, synthFrame } from '../../helpers/synthPose';
import { featuresOf } from '../../helpers/pipeline';

const FPS_MS = 1000 / 30;
const cover = { armL: { ext: 0, dir: 'cover' as const }, armR: { ext: 0, dir: 'cover' as const } };
const shiftRight = (hipDx: number) => ({ hipX: 0.5 - hipDx * 0.38 * 0.25 });

/** Runs frames every 33 ms where params depend on time; returns [t, state] pairs. */
function run(durationMs: number, at: (t: number) => Partial<SynthParams>): [number, ControlState][] {
  const frames = [];
  for (let i = 0; i * FPS_MS <= durationMs; i++) frames.push(synthFrame(at(i * FPS_MS), i * FPS_MS, i));
  const rec = new StateRecognizer(DEFAULT_CONFIG);
  return featuresOf(frames).map(({ f }) => [f.t, rec.update(f)]);
}
const stateAt = (rows: [number, ControlState][], t: number) => rows.filter(([rt]) => rt <= t + 1e-6).pop()![1];

describe('StateRecognizer', () => {
  test('block engages after a 150 ms hold and releases 120 ms after hands drop', () => {
    const rows = run(600, (t) => (t < 300 ? cover : {}));
    expect(stateAt(rows, 133.3).block).toBe(false);
    expect(stateAt(rows, 166.7).block).toBe(true);
    expect(stateAt(rows, 366.7).block).toBe(true);
    expect(stateAt(rows, 466.7).block).toBe(false);
  });

  test('block releases immediately when one arm extends out of the guard', () => {
    const rows = run(500, (t) => (t < 300 ? cover : { ...cover, armR: { ext: 0.95, dir: 'forward' } }));
    expect(stateAt(rows, 266.7).block).toBe(true);
    expect(stateAt(rows, 300).block).toBe(false);
  });

  test('a normal guard with fists below the shoulders is not a block', () => {
    const rows = run(500, () => ({}));
    expect(rows.some(([, s]) => s.block)).toBe(false);
  });

  test('crouch engages after holding a lowered hip for 120 ms', () => {
    const rows = run(400, () => ({ hipDrop: 0.15 }));
    expect(stateAt(rows, 66.7).crouch).toBe(false);
    expect(stateAt(rows, 166.7).crouch).toBe(true);
  });

  test('crouch releases when the hip comes back up', () => {
    const rows = run(600, (t) => ({ hipDrop: t < 300 ? 0.15 : 0.05 }));
    expect(stateAt(rows, 266.7).crouch).toBe(true);
    expect(stateAt(rows, 333.3).crouch).toBe(false);
  });

  test('leaning with planted hips dodges to that side', () => {
    expect(stateAt(run(100, () => ({ lean: 20 })), 100).dodge).toBe(1);
    expect(stateAt(run(100, () => ({ lean: -20 })), 100).dodge).toBe(-1);
  });

  test('leaning back during a kick is not a dodge, during or right after it', () => {
    // the torso tips back as the leg rises (both reach their peak at 200 ms), stays tipped while the leg comes
    // down (400 ms) and for 200 ms after the foot is back
    const rows = run(900, (t) => ({ lean: t < 200 ? (25 * t) / 200 : t < 600 ? 25 : 0, liftR: t < 200 ? (0.45 * t) / 200 : t < 400 ? 0.45 * (1 - (t - 200) / 200) : 0 }));
    expect(rows.filter(([t]) => t <= 600).some(([, st]) => st.dodge !== 0)).toBe(false);
  });

  test('a lean long after a kick dodges again', () => {
    const rows = run(1300, (t) => ({ lean: t > 900 ? 20 : 0, liftR: t < 200 ? 0.45 : 0 }));
    expect(stateAt(rows, 1300).dodge).toBe(1);
  });

  test('leaning while the hips shift is movement, not a dodge', () => {
    const s = stateAt(run(100, () => ({ lean: 20, ...shiftRight(0.6) })), 100);
    expect(s.dodge).toBe(0);
    expect(s.move).toBe(1);
  });

  test('move uses hysteresis between 0.45 and 0.30', () => {
    const rows = run(600, (t) => shiftRight(t < 200 ? 0.5 : t < 400 ? 0.35 : 0.25));
    expect(stateAt(rows, 166.7).move).toBe(1);
    expect(stateAt(rows, 366.7).move).toBe(1);
    expect(stateAt(rows, 566.7).move).toBe(0);
    expect(stateAt(run(100, () => shiftRight(-0.5)), 100).move).toBe(-1);
  });
});
