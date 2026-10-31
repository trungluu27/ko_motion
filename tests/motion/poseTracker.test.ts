import { describe, expect, test } from 'vitest';
import { toPoseFrame } from '../../src/motion/poseTracker';

const lm = (k: number) => Array.from({ length: 33 }, (_, i) => ({ x: i / 100 + k, y: 0.5, z: 0, visibility: 0.9 }));

describe('toPoseFrame', () => {
  test('returns null when no person is detected', () => {
    expect(toPoseFrame({ landmarks: [], worldLandmarks: [] }, 3, 100)).toBeNull();
  });

  test('takes the first person with its capture time and frame id', () => {
    const f = toPoseFrame({ landmarks: [lm(0), lm(1)], worldLandmarks: [lm(0.5), lm(2)] }, 7, 1234.5)!;
    expect(f.frameId).toBe(7);
    expect(f.t).toBe(1234.5);
    expect(f.image).toHaveLength(33);
    expect(f.world).toHaveLength(33);
    expect(f.image[2].x).toBeCloseTo(0.02, 9);
    expect(f.world[0].x).toBeCloseTo(0.5, 9);
  });

  test('copies landmark data so later mutation of the result does not leak', () => {
    const result = { landmarks: [lm(0)], worldLandmarks: [lm(0)] };
    const f = toPoseFrame(result, 0, 0)!;
    result.landmarks[0][0].x = 99;
    expect(f.image[0].x).toBe(0);
  });
});
