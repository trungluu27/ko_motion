import { describe, expect, test } from 'vitest';
import { JumpRecognizer } from '../../../src/motion/recognizers/jump';
import { DEFAULT_CONFIG } from '../../../src/motion/config';
import { synthSequence, defaultCalibration } from '../../helpers/synthPose';
import { featuresOf, kickEvents } from '../../helpers/pipeline';

const jumpSeq = () => synthSequence([
  { t: 0, p: {} },
  { t: 150, p: { jump: 0.1 } },
  { t: 300, p: {} },
  { t: 600, p: {} },
]);

describe('JumpRecognizer', () => {
  test('a quick hop emits one jump and tracks airborne state', () => {
    const rec = new JumpRecognizer(defaultCalibration(), DEFAULT_CONFIG);
    const ev = [];
    let airborneAtPeak = false;
    for (const { f, frameId } of featuresOf(jumpSeq())) {
      const e = rec.update(f, frameId);
      if (e) ev.push(e);
      if (f.t >= 130 && f.t <= 170) airborneAtPeak = rec.isAirborne();
    }
    expect(ev.map((e) => e.action)).toEqual(['jump']);
    expect(ev[0].confidence).toBeGreaterThanOrEqual(0.5);
    expect(airborneAtPeak).toBe(true);
    expect(rec.isAirborne()).toBe(false);
  });

  test('a jump does not register as a kick', () => {
    expect(kickEvents(jumpSeq())).toHaveLength(0);
  });

  test('slowly rising onto the toes is not a jump', () => {
    const rec = new JumpRecognizer(defaultCalibration(), DEFAULT_CONFIG);
    const frames = synthSequence([{ t: 0, p: {} }, { t: 1000, p: { jump: 0.1 } }]);
    const ev = featuresOf(frames).map(({ f, frameId }) => rec.update(f, frameId)).filter(Boolean);
    expect(ev).toHaveLength(0);
  });
});
