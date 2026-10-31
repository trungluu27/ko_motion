import { describe, expect, test } from 'vitest';
import { dist } from '../../src/shared/math';
import { LM } from '../../src/motion/landmarks';
import { DEFAULT_SYNTH, synthFrame, synthSequence } from './synthPose';

describe('synthFrame', () => {
  test('forward arm extension matches requested ext and points toward camera', () => {
    const f = synthFrame({ armL: { ext: 0.9, dir: 'forward' } }, 0);
    expect(dist(f.world[LM.L_SHOULDER], f.world[LM.L_WRIST]) / 0.54).toBeCloseTo(0.9, 2);
    expect(f.world[LM.L_WRIST].z).toBeLessThan(f.world[LM.L_SHOULDER].z);
  });

  test('upper arm and forearm keep their lengths when bent', () => {
    const f = synthFrame({ armR: { ext: 0.5, dir: 'forward' } }, 0);
    expect(dist(f.world[LM.R_SHOULDER], f.world[LM.R_ELBOW])).toBeCloseTo(0.28, 6);
    expect(dist(f.world[LM.R_ELBOW], f.world[LM.R_WRIST])).toBeCloseTo(0.26, 6);
  });

  test('player left landmarks appear at larger image x (unmirrored camera)', () => {
    const f = synthFrame({}, 0);
    expect(f.image[LM.L_SHOULDER].x).toBeGreaterThan(f.image[LM.R_SHOULDER].x);
  });

  test('jump lifts ankles in the image by jump*scale', () => {
    const base = synthFrame({}, 0);
    const up = synthFrame({ jump: 0.2 }, 0);
    expect(base.image[LM.L_ANKLE].y - up.image[LM.L_ANKLE].y).toBeCloseTo(0.2 * DEFAULT_SYNTH.scale, 6);
  });

  test('hipDrop keeps ankles on the floor and lowers the hip', () => {
    const base = synthFrame({}, 0);
    const low = synthFrame({ hipDrop: 0.15 }, 0);
    expect(low.image[LM.L_ANKLE].y).toBeCloseTo(base.image[LM.L_ANKLE].y, 6);
    expect(low.image[LM.L_HIP].y - base.image[LM.L_HIP].y).toBeCloseTo(0.15 * DEFAULT_SYNTH.scale, 6);
  });

  test('hidden landmarks get low visibility', () => {
    const f = synthFrame({ hidden: [LM.R_ANKLE] }, 0);
    expect(f.image[LM.R_ANKLE].visibility).toBeLessThan(0.5);
    expect(f.image[LM.L_ANKLE].visibility).toBeGreaterThan(0.9);
    expect(f.image).toHaveLength(33);
    expect(f.world).toHaveLength(33);
  });
});

describe('synthSequence', () => {
  test('two keys 1000 ms apart at 30 fps give 31 evenly spaced frames', () => {
    const frames = synthSequence([
      { t: 0, p: {} },
      { t: 1000, p: { jump: 0.1 } },
    ]);
    expect(frames).toHaveLength(31);
    expect(frames[1].t - frames[0].t).toBeCloseTo(1000 / 30, 6);
    expect(frames[30].t).toBeCloseTo(1000, 6);
    expect(frames.map((f) => f.frameId)).toEqual(frames.map((_, i) => i));
  });

  test('interpolates numeric params between keys', () => {
    const frames = synthSequence([
      { t: 0, p: { armL: { ext: 0.4, dir: 'forward' } } },
      { t: 1000, p: { armL: { ext: 0.8, dir: 'forward' } } },
    ], 2);
    const midExt = dist(frames[1].world[LM.L_SHOULDER], frames[1].world[LM.L_WRIST]) / 0.54;
    expect(midExt).toBeCloseTo(0.6, 2);
  });
});
