// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { IntentBuilder } from '../../src/game/input/intent';
import { keyboardControl } from '../../src/game/input/keyboardMap';
import { MotionInput } from '../../src/game/input/motionInput';
import { MotionSession, type SessionDeps } from '../../src/game/motion/motionSession';
import { STALE_OUTPUT_MS, effectiveTracking } from '../../src/game/trackingPause';
import type { EngineOutput } from '../../src/motion/motionEngine';
import { DEFAULT_STATE } from '../../src/shared/types';

const okOut = (state = {}): EngineOutput => ({
  t: 0, events: [], state: { ...DEFAULT_STATE, ...state }, tracking: 'ok', latencyMs: null, needsRecalibration: false, features: null,
});

describe('keyboard presses during a pause', () => {
  test('IntentBuilder.clear drops queued presses', () => {
    const b = new IntentBuilder();
    b.push(keyboardControl({ down: new Set(['KeyJ']), pressed: new Set(['KeyJ', 'KeyK']) }, 0));
    b.clear();
    expect(b.next().attack).toBeNull();
  });
});

describe('camera output stopping', () => {
  test('output older than the stale limit counts as lost tracking', () => {
    expect(effectiveTracking('ok', 1000, 1000 + STALE_OUTPUT_MS - 1)).toBe('ok');
    expect(effectiveTracking('ok', 1000, 1000 + STALE_OUTPUT_MS + 1)).toBe('no_person');
    expect(effectiveTracking(undefined, null, 5000)).toBe('no_person');
  });

  test('MotionInput releases held states once output goes stale', () => {
    const mi = new MotionInput();
    mi.push(okOut({ move: 1, block: true }), 1000);
    expect(mi.next(1100)).toMatchObject({ move: 1, block: true });
    expect(mi.next(1000 + STALE_OUTPUT_MS + 1)).toMatchObject({ move: 0, block: false });
  });
});

describe('MotionSession lifecycle', () => {
  function fakes() {
    const tracker = { start: vi.fn(), stop: vi.fn(), close: vi.fn() };
    let resolveTracker!: () => void;
    const deps: SessionDeps = {
      openCamera: vi.fn(async () => ({}) as HTMLVideoElement),
      closeCamera: vi.fn(),
      createTracker: vi.fn(() => new Promise<typeof tracker>((r) => (resolveTracker = () => r(tracker)))),
    };
    return { tracker, deps, resolve: () => resolveTracker() };
  }

  test('pause stops inference and releases the camera; start resumes', async () => {
    const f = fakes();
    const s = new MotionSession(f.deps);
    const p = s.start();
    await vi.waitFor(() => expect(f.deps.createTracker).toHaveBeenCalled());
    f.resolve();
    await p;
    expect(f.tracker.start).toHaveBeenCalledTimes(1);
    s.pause();
    expect(f.tracker.stop).toHaveBeenCalled();
    expect(f.deps.closeCamera).toHaveBeenCalled();
    expect(s.running).toBe(false);
    await s.start();
    expect(f.tracker.start).toHaveBeenCalledTimes(2);
  });

  test('pausing while start is still pending leaves nothing running', async () => {
    const f = fakes();
    const s = new MotionSession(f.deps);
    const p = s.start();
    await vi.waitFor(() => expect(f.deps.createTracker).toHaveBeenCalled());
    s.pause();
    f.resolve();
    await p;
    expect(s.running).toBe(false);
    expect(f.tracker.start).not.toHaveBeenCalled();
  });
});
