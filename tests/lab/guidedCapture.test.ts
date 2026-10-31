import { describe, expect, test } from 'vitest';
import { type CaptureStep, DEFAULT_SCRIPT, GuidedCapture, QUICK_SCRIPT } from '../../src/lab/guidedCapture';

const script: CaptureStep[] = [
  { action: 'punch_l', prompt: 'A', durationMs: 1000, expectedCount: 3 },
  { action: 'idle', prompt: 'B', durationMs: 1000 },
];

describe('GuidedCapture', () => {
  test('alternates rest and perform phases and emits each label exactly once', () => {
    const g = new GuidedCapture(script, 500);
    g.start(0);
    expect(g.update(200)).toMatchObject({ phase: 'rest', step: script[0], remainingMs: 300 });
    expect(g.update(600)).toMatchObject({ phase: 'perform', step: script[0] });
    const end = g.update(1500);
    expect(end.newLabel).toEqual({ action: 'punch_l', tStart: 500, tEnd: 1500, expectedCount: 3 });
    expect(end.phase).toBe('rest');
    expect(g.update(1501).newLabel).toBeUndefined();
    const last = g.update(3000);
    expect(last.newLabel).toEqual({ action: 'idle', tStart: 2000, tEnd: 3000 });
    expect(last.phase).toBe('done');
    expect(g.update(4000)).toMatchObject({ phase: 'done', step: null });
  });

  test('skip ends the current phase early, labeling the shortened window', () => {
    const g = new GuidedCapture(script, 500);
    g.start(0);
    g.skip(100);
    expect(g.update(150)).toMatchObject({ phase: 'perform', step: script[0] });
    expect(g.skip(400).newLabel).toEqual({ action: 'punch_l', tStart: 100, tEnd: 400, expectedCount: 3 });
  });

  test('default script covers every action with an idle segment last', () => {
    const actions = DEFAULT_SCRIPT.map((s) => s.action);
    for (const a of ['punch_l', 'punch_r', 'kick_l', 'kick_r', 'jump', 'block', 'crouch', 'dodge_l', 'dodge_r', 'move_l', 'move_r']) {
      expect(actions).toContain(a);
    }
    expect(DEFAULT_SCRIPT[DEFAULT_SCRIPT.length - 1]).toMatchObject({ action: 'idle', durationMs: 60_000 });
    expect(DEFAULT_SCRIPT.find((s) => s.action === 'kick_r')).toMatchObject({ durationMs: 25_000, expectedCount: 10 });
    expect(DEFAULT_SCRIPT.find((s) => s.action === 'crouch')).toMatchObject({ durationMs: 6_000 });
  });
});

test('quick script covers punches, block and a no-punch guard segment in about a minute', () => {
  expect(QUICK_SCRIPT.map((s) => s.action)).toEqual(['punch_l', 'punch_r', 'block', 'idle']);
  expect(QUICK_SCRIPT[0]).toMatchObject({ expectedCount: 10, durationMs: 15_000 });
  const totalMs = QUICK_SCRIPT.reduce((a, s) => a + s.durationMs + 3000, 0);
  expect(totalMs).toBeLessThanOrEqual(75_000);
});
