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
});
