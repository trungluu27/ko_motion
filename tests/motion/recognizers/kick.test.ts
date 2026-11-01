import { describe, expect, test } from 'vitest';
import { synthSequence } from '../../helpers/synthPose';
import { kickEvents } from '../../helpers/pipeline';

describe('KickRecognizer', () => {
  test('a fast right kick emits one kick_r', () => {
    const ev = kickEvents(synthSequence([
      { t: 0, p: {} },
      { t: 200, p: { liftR: 0.45 } },
      { t: 400, p: {} },
      { t: 700, p: {} },
    ]));
    expect(ev.map((e) => e.action)).toEqual(['kick_r']);
    expect(ev[0].confidence).toBeGreaterThanOrEqual(0.5);
  });

  test('slowly raising the leg is not a kick', () => {
    expect(kickEvents(synthSequence([{ t: 0, p: {} }, { t: 2000, p: { liftL: 0.45 } }]))).toHaveLength(0);
  });

  test('holding the leg up does not repeat the kick', () => {
    const ev = kickEvents(synthSequence([
      { t: 0, p: {} },
      { t: 200, p: { liftL: 0.45 } },
      { t: 1200, p: { liftL: 0.45 } },
    ]));
    expect(ev.map((e) => e.action)).toEqual(['kick_l']);
  });

  test('still kicks when standing farther or nearer than at calibration (drift)', () => {
    // calibrated at scale 0.25 / hipY 0.55; the player now appears 6% smaller and a little higher, or 6% bigger
    for (const at of [{ scale: 0.235, hipY: 0.5 }, { scale: 0.265, hipY: 0.58 }]) {
      const ev = kickEvents(synthSequence([
        { t: 0, p: at },
        { t: 200, p: { ...at, liftL: 0.45 } },
        { t: 400, p: at },
        { t: 700, p: at },
      ]));
      expect(ev.map((e) => e.action)).toEqual(['kick_l']);
    }
  });

  test('a jump (both feet up together) is not a kick', () => {
    const ev = kickEvents(synthSequence([
      { t: 0, p: {} },
      { t: 150, p: { jump: 0.4, liftL: 0.1, liftR: 0.1 } },
      { t: 300, p: {} },
      { t: 600, p: {} },
    ]));
    expect(ev).toHaveLength(0);
  });
});
