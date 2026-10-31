import { describe, expect, test } from 'vitest';
import { PunchRecognizer } from '../../../src/motion/recognizers/punch';
import { DEFAULT_CONFIG } from '../../../src/motion/config';
import type { ActionEvent, PoseFrame } from '../../../src/shared/types';
import { type ArmPose, synthSequence } from '../../helpers/synthPose';
import { featuresOf } from '../../helpers/pipeline';

const fwd = (ext: number): ArmPose => ({ ext, dir: 'forward' });

function events(frames: PoseFrame[]): ActionEvent[] {
  const l = new PunchRecognizer('l', DEFAULT_CONFIG);
  const r = new PunchRecognizer('r', DEFAULT_CONFIG);
  const out: ActionEvent[] = [];
  for (const { f, frameId } of featuresOf(frames)) {
    for (const rec of [l, r]) {
      const e = rec.update(f, frameId);
      if (e) out.push(e);
    }
  }
  return out;
}

function jab(t0: number) {
  return [
    { t: t0, p: { armL: fwd(0.45) } },
    { t: t0 + 100, p: { armL: fwd(0.95) } },
    { t: t0 + 250, p: { armL: fwd(0.45) } },
  ];
}

describe('PunchRecognizer', () => {
  test('a fast left jab emits exactly one confident punch_l', () => {
    const ev = events(synthSequence([...jab(0), { t: 600, p: { armL: fwd(0.45) } }]));
    expect(ev).toHaveLength(1);
    expect(ev[0].action).toBe('punch_l');
    expect(ev[0].confidence).toBeGreaterThanOrEqual(0.5);
    expect(ev[0].t).toBeGreaterThan(0);
    expect(ev[0].t).toBeLessThanOrEqual(150);
  });

  test('a slow extension is not a punch', () => {
    const ev = events(synthSequence([{ t: 0, p: { armL: fwd(0.45) } }, { t: 1500, p: { armL: fwd(0.95) } }]));
    expect(ev).toHaveLength(0);
  });

  test('holding the arm extended does not repeat the punch', () => {
    const ev = events(synthSequence([
      { t: 0, p: { armL: fwd(0.45) } },
      { t: 100, p: { armL: fwd(0.95) } },
      { t: 2100, p: { armL: fwd(0.95) } },
    ]));
    expect(ev).toHaveLength(1);
  });

  test('three jabs 400 ms apart give three events', () => {
    const ev = events(synthSequence([...jab(0), ...jab(400), ...jab(800), { t: 1300, p: { armL: fwd(0.45) } }]));
    expect(ev.map((e) => e.action)).toEqual(['punch_l', 'punch_l', 'punch_l']);
  });

  test('an arm swung downward outside the strike zone is ignored', () => {
    const down = (ext: number): ArmPose => ({ ext, dir: 'down' });
    const ev = events(synthSequence([
      { t: 0, p: { armL: down(0.45) } },
      { t: 100, p: { armL: down(0.98) } },
      { t: 300, p: { armL: down(0.45) } },
    ]));
    expect(ev).toHaveLength(0);
  });
});
