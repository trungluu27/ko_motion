import { describe, expect, test } from 'vitest';
import { FeatureExtractor, type Features } from '../../src/motion/features';
import { DEFAULT_CONFIG } from '../../src/motion/config';
import type { PoseFrame } from '../../src/shared/types';
import { defaultCalibration, synthFrame, synthSequence } from '../helpers/synthPose';

const run = (frames: PoseFrame[]): Features[] => {
  const fx = new FeatureExtractor(defaultCalibration(), DEFAULT_CONFIG);
  return frames.map((f) => fx.update(f));
};
const one = (p: Parameters<typeof synthFrame>[0]) => run([synthFrame(p, 0)])[0];

describe('FeatureExtractor', () => {
  test('neutral stance is centered with no motion', () => {
    const fs = run(synthSequence([{ t: 0, p: {} }, { t: 300, p: {} }]));
    const f = fs[fs.length - 1];
    expect(Math.abs(f.hipDx)).toBeLessThan(0.01);
    expect(Math.abs(f.hipDy)).toBeLessThan(0.01);
    expect(Math.abs(f.lean)).toBeLessThan(0.01);
    expect(f.armExt.l).toBeCloseTo(0.45, 2);
    expect(Math.abs(f.armExtVel.l)).toBeLessThan(0.01);
    expect(f.torsoScale).toBeCloseTo(1, 6);
    expect(f.wristInStrikeZone.l).toBe(true);
    expect(f.wristAboveShoulder.l).toBe(false);
  });

  test('forward punch extension is measured in 3D', () => {
    const f = one({ armL: { ext: 0.9, dir: 'forward' } });
    expect(f.armExt.l).toBeCloseTo(0.9, 1);
    expect(Math.abs(f.armExt.l - 0.9)).toBeLessThan(0.02);
    // law of cosines for upper arm 0.28, forearm 0.26, wrist distance 0.9*0.54
    expect(f.elbowAngle.l).toBeCloseTo(128.3, 0);
  });

  test('2D reach grows for a sideways punch but not for one aimed at the camera', () => {
    expect(one({ armL: { ext: 0.9, dir: 'side' } }).reach2d.l).toBeCloseTo((0.9 * 0.54) / 0.5, 1);
    expect(one({ armL: { ext: 0.9, dir: 'forward' } }).reach2d.l).toBeLessThan(0.05);
  });

  test('fast extension produces high extension velocity', () => {
    const fs = run(synthSequence([
      { t: 0, p: {} },
      { t: 100, p: { armL: { ext: 0.95, dir: 'forward' } } },
    ]));
    expect(Math.max(...fs.map((f) => f.armExtVel.l))).toBeGreaterThan(2.5);
  });

  test('lean, lateral shift and crouch are normalized to the body', () => {
    expect(one({ lean: 20 }).lean).toBeCloseTo(20, 0);
    expect(one({ lean: -20 }).lean).toBeCloseTo(-20, 0);
    expect(one({ hipX: 0.5 - 0.5 * 0.38 * 0.25 }).hipDx).toBeCloseTo(0.5, 1);
    expect(one({ hipDrop: 0.15 }).hipDy).toBeCloseTo(0.3, 1);
  });

  test('raised ankle is measured in leg lengths', () => {
    const f = one({ liftR: 0.44 });
    expect(f.ankleLift.r).toBeCloseTo(0.5, 2);
    expect(f.ankleLift.l).toBeCloseTo(0, 6);
  });

  test('covering the face puts wrists above shoulders and near the nose', () => {
    const f = one({ armL: { ext: 0, dir: 'cover' }, armR: { ext: 0, dir: 'cover' } });
    expect(f.wristAboveShoulder.l && f.wristAboveShoulder.r).toBe(true);
    expect(f.wristNose.l).toBeLessThan(0.7);
  });

  test('a gap longer than 250 ms resets history so velocity is zero', () => {
    const fs = run([
      synthFrame({}, 0, 0),
      synthFrame({ armL: { ext: 0.95, dir: 'forward' } }, 500, 1),
    ]);
    expect(fs[1].armExtVel.l).toBe(0);
  });
});

describe('FeatureExtractor on a 16:9 camera (x normalized by width, y by height)', () => {
  const aspect = 16 / 9;
  const runWide = (p: Parameters<typeof synthFrame>[0]) => {
    const fx = new FeatureExtractor(defaultCalibration({ aspect }), DEFAULT_CONFIG);
    return fx.update(synthFrame({ ...p, aspect }, 0));
  };

  test('lean angle is measured in real degrees', () => {
    expect(runWide({ lean: 20 }).lean).toBeCloseTo(20, 0);
  });

  test('wrist-to-nose distance matches the square-pixel measurement', () => {
    const cover = { armL: { ext: 0, dir: 'cover' as const }, armR: { ext: 0, dir: 'cover' as const } };
    expect(runWide(cover).wristNose.l).toBeCloseTo(one(cover).wristNose.l, 6);
  });

  test('lateral shift and torso scale are aspect independent', () => {
    const f = runWide({ hipX: 0.5 - (0.5 * 0.38 * 0.25) / aspect });
    expect(f.hipDx).toBeCloseTo(0.5, 2);
    expect(f.torsoScale).toBeCloseTo(1, 6);
  });
});
