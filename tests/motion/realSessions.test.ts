import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { parseSession } from '../../src/motion/session/format';
import { replaySession } from '../../src/motion/session/replay';
import { evaluate } from '../../src/motion/eval';

const load = (name: string) =>
  parseSession(gunzipSync(readFileSync(new URL(`../../fixtures/sessions/${name}`, import.meta.url))).toString('utf8'));

describe('recorded side-stance session (left shoulder toward camera, ~16 FPS)', () => {
  const session = load('2026-10-31-side-quick.json.gz');
  const outputs = replaySession(session);
  const t0 = session.frames[0].t;
  const blockFramesBetween = (a: number, b: number) =>
    outputs.filter((o) => o.state.block && o.t - t0 >= a * 1000 && o.t - t0 <= b * 1000).length;

  test('left and right punches reach the spec targets', () => {
    const s = evaluate(outputs, session.labels);
    for (const a of ['punch_l', 'punch_r'] as const) {
      expect(s[a].precision, `${a} precision`).toBeGreaterThanOrEqual(0.9);
      expect(s[a].recall, `${a} recall`).toBeGreaterThanOrEqual(0.85);
    }
  });

  test('block is held while covering the face but not while in a normal guard', () => {
    expect(blockFramesBetween(39, 45)).toBeGreaterThanOrEqual(70);
    expect(blockFramesBetween(48, 63)).toBeLessThanOrEqual(10);
  });
});
