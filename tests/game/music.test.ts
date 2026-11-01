import { describe, expect, test } from 'vitest';
import { BARS, musicPattern } from '../../src/game/render/music';

describe('musicPattern (spec phase5 6)', () => {
  test('four-on-the-floor kick in every bar', () => {
    for (let bar = 0; bar < BARS; bar++) {
      const kicks = musicPattern(bar).filter((n) => n.voice === 'kick').map((n) => n.step);
      expect(kicks).toEqual(expect.arrayContaining([0, 4, 8, 12]));
    }
  });

  test('steps stay in 0..15 and bass stays low', () => {
    for (let bar = 0; bar < BARS; bar++) {
      for (const n of musicPattern(bar)) {
        expect(n.step).toBeGreaterThanOrEqual(0);
        expect(n.step).toBeLessThanOrEqual(15);
        if (n.voice === 'bass') {
          expect(n.freq).toBeGreaterThanOrEqual(40);
          expect(n.freq).toBeLessThanOrEqual(200);
        }
      }
    }
  });

  test('the loop repeats every BARS bars and has bass and hats', () => {
    expect(BARS).toBe(4);
    expect(musicPattern(5)).toEqual(musicPattern(1));
    expect(musicPattern(0).some((n) => n.voice === 'bass')).toBe(true);
    expect(musicPattern(0).some((n) => n.voice === 'hat')).toBe(true);
  });
});
