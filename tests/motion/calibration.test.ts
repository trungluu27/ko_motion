import { describe, expect, test } from 'vitest';
import { Calibrator } from '../../src/motion/calibration';
import { DEFAULT_CONFIG } from '../../src/motion/config';
import { synthFrame } from '../helpers/synthPose';

const frameAt = (i: number, p = {}) => synthFrame(p, i * 33.3, i);

describe('Calibrator', () => {
  test('45 stable frames yield a ready calibration with body measurements', () => {
    const c = new Calibrator(DEFAULT_CONFIG);
    let last = c.push(frameAt(0));
    expect(last.status).toBe('calibrating');
    for (let i = 1; i < 45; i++) last = c.push(frameAt(i));
    expect(last.status).toBe('ready');
    expect(last.progress).toBe(1);
    const cal = last.calibration!;
    expect(cal.torsoPx).toBeCloseTo(0.5 * 0.25, 3);
    expect(cal.shoulderPx).toBeCloseTo(0.38 * 0.25, 3);
    expect(cal.legPx).toBeCloseTo(0.88 * 0.25, 3);
    expect(cal.upperArm.l).toBeCloseTo(0.28, 3);
    expect(cal.foreArm.r).toBeCloseTo(0.26, 3);
    expect(cal.hipX).toBeCloseTo(0.5, 6);
  });

  test('a large hip shift restarts progress', () => {
    const c = new Calibrator(DEFAULT_CONFIG);
    for (let i = 0; i < 30; i++) c.push(frameAt(i));
    const r = c.push(frameAt(30, { hipX: 0.6 }));
    expect(r.progress).toBeLessThan(0.05);
    expect(r.status).toBe('calibrating');
  });

  test('missing person reports no_person and resets progress', () => {
    const c = new Calibrator(DEFAULT_CONFIG);
    for (let i = 0; i < 10; i++) c.push(frameAt(i));
    const r = c.push(null);
    expect(r.status).toBe('no_person');
    expect(r.progress).toBe(0);
  });
});
