import { describe, expect, test } from 'vitest';
import { TrackingGate, trackingStatusOf } from '../../src/motion/tracking';
import { DEFAULT_CONFIG } from '../../src/motion/config';
import { LM } from '../../src/motion/landmarks';
import { synthFrame } from '../helpers/synthPose';

const cfg = DEFAULT_CONFIG.tracking;

describe('trackingStatusOf', () => {
  test('null or empty frame is no_person', () => {
    expect(trackingStatusOf(null, cfg)).toBe('no_person');
    expect(trackingStatusOf({ frameId: 0, t: 0, image: [], world: [] }, cfg)).toBe('no_person');
  });
  test('low visibility key joint is partial', () => {
    expect(trackingStatusOf(synthFrame({ hidden: [LM.L_KNEE] }, 0), cfg)).toBe('partial');
  });
  test('low visibility non-key landmark is still ok', () => {
    expect(trackingStatusOf(synthFrame({ hidden: [LM.L_WRIST] }, 0), cfg)).toBe('ok');
  });
  test('key joint near the image edge is out_of_frame', () => {
    expect(trackingStatusOf(synthFrame({ hipX: 0.01 }, 0), cfg)).toBe('out_of_frame');
  });
  test('full body in view is ok', () => {
    expect(trackingStatusOf(synthFrame({}, 0), cfg)).toBe('ok');
  });
});

describe('TrackingGate', () => {
  test('opens immediately on first ok, then requires 300 ms of ok after a loss', () => {
    const g = new TrackingGate(cfg);
    expect(g.update('ok', 0)).toBe(true);
    expect(g.update('partial', 100)).toBe(false);
    expect(g.update('ok', 200)).toBe(false);
    expect(g.update('ok', 450)).toBe(false);
    expect(g.update('ok', 500)).toBe(true);
  });
  test('a loss during the debounce restarts it', () => {
    const g = new TrackingGate(cfg);
    g.update('no_person', 0);
    g.update('ok', 100);
    g.update('out_of_frame', 300);
    expect(g.update('ok', 450)).toBe(false);
    expect(g.update('ok', 750)).toBe(true);
  });
});
