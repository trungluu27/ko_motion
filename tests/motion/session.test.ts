import { describe, expect, test } from 'vitest';
import { type Session, SessionFormatError, parseSession, serializeSession } from '../../src/motion/session/format';
import { SessionRecorder } from '../../src/motion/session/recorder';
import { replaySession } from '../../src/motion/session/replay';
import { evaluate } from '../../src/motion/eval';
import { type ArmPose, synthSequence } from '../helpers/synthPose';

const fwd = (ext: number): ArmPose => ({ ext, dir: 'forward' });
const jab = (t0: number) => [
  { t: t0, p: { armL: fwd(0.45) } },
  { t: t0 + 100, p: { armL: fwd(0.95) } },
  { t: t0 + 250, p: { armL: fwd(0.45) } },
];

function threeJabSession(): Session {
  const rec = new SessionRecorder();
  rec.start({ createdAt: '2026-10-31T00:00:00Z', width: 1280, height: 720, model: 'full', calibration: null });
  const frames = synthSequence([
    { t: 0, p: {} },
    { t: 2000, p: {} },
    ...jab(2200), ...jab(2700), ...jab(3200),
    { t: 3800, p: { armL: fwd(0.45) } },
  ]);
  for (const f of frames) rec.addFrame(f);
  rec.addLabel({ action: 'punch_l', tStart: 2100, tEnd: 3600, expectedCount: 3 });
  return rec.stop();
}

describe('session format', () => {
  test('serialize then parse keeps data within 1e-4', () => {
    const s = threeJabSession();
    const back = parseSession(serializeSession(s));
    expect(back.frames).toHaveLength(s.frames.length);
    expect(back.labels).toEqual(s.labels);
    expect(Math.abs(back.frames[10].image[15].x - s.frames[10].image[15].x)).toBeLessThanOrEqual(1e-4);
    expect(Math.abs(back.frames[10].world[15].z - s.frames[10].world[15].z)).toBeLessThanOrEqual(1e-4);
  });

  test('malformed or wrong-version files raise SessionFormatError', () => {
    expect(() => parseSession('{')).toThrow(SessionFormatError);
    expect(() => parseSession('{"version":2,"frames":[]}')).toThrow(SessionFormatError);
    expect(() => parseSession('{"version":1}')).toThrow(SessionFormatError);
  });

  test('recorder ignores frames when not recording', () => {
    const rec = new SessionRecorder();
    expect(rec.recording).toBe(false);
    rec.addFrame(synthSequence([{ t: 0, p: {} }, { t: 100, p: {} }])[0]);
    rec.start({ createdAt: 'x', width: 1, height: 1, model: 'lite', calibration: null });
    expect(rec.recording).toBe(true);
    expect(rec.stop().frames).toHaveLength(0);
  });
});

describe('replay and evaluate', () => {
  test('replaying three labeled jabs scores perfect precision and recall', () => {
    const s = threeJabSession();
    const scores = evaluate(replaySession(s), s.labels);
    expect(scores.punch_l).toMatchObject({ tp: 3, fp: 0, fn: 0, precision: 1, recall: 1 });
    expect(scores.kick_r).toMatchObject({ tp: 0, fp: 0, fn: 0, precision: 1, recall: 1 });
  });

  test('events inside an idle window are false positives and idle adds no misses', () => {
    const outs = [{ events: [{ action: 'punch_r' as const, confidence: 1, t: 500, frameId: 1 }] }];
    const scores = evaluate(outs, [{ action: 'idle', tStart: 0, tEnd: 1000 }]);
    expect(scores.punch_r).toMatchObject({ tp: 0, fp: 1, fn: 0, precision: 0, recall: 1 });
  });

  test('extra events beyond expectedCount are false positives; missing ones are misses', () => {
    const ev = (t: number) => ({ action: 'kick_l' as const, confidence: 1, t, frameId: 0 });
    const scores = evaluate([{ events: [ev(100), ev(200), ev(1400)] }], [
      { action: 'kick_l', tStart: 0, tEnd: 300, expectedCount: 1 },
      { action: 'kick_l', tStart: 1000, tEnd: 1050, expectedCount: 2 },
    ]);
    // ev(1400) is outside [1000, 1050 + 300]
    expect(scores.kick_l).toMatchObject({ tp: 1, fp: 2, fn: 2 });
  });
});
