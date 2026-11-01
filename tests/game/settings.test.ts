// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { MotionSession, type SessionDeps } from '../../src/game/motion/motionSession';
import { CameraError } from '../../src/motion/camera';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../src/game/settings';

const memory = (init: Record<string, string> = {}): Storage => {
  const m = new Map(Object.entries(init));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
};

describe('settings (spec phase5 3)', () => {
  test('missing or broken JSON gives the defaults', () => {
    expect(loadSettings(memory())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memory({ 'bf.settings': '{oops' }))).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      control: 'keyboard', view: 'split', model: 'full', cameraId: null, sfxVolume: 0.8, music: true, safetyAck: false,
    });
  });

  test('a field of the wrong type falls back to its default, the others are kept', () => {
    const s = loadSettings(memory({ 'bf.settings': JSON.stringify({ control: 'body', view: 'tv', music: 'yes', model: 'lite' }) }));
    expect(s).toEqual({ ...DEFAULT_SETTINGS, control: 'body', model: 'lite' });
  });

  test('volume is clamped to 0..1', () => {
    expect(loadSettings(memory({ 'bf.settings': JSON.stringify({ sfxVolume: 3 }) })).sfxVolume).toBe(1);
    expect(loadSettings(memory({ 'bf.settings': JSON.stringify({ sfxVolume: -1 }) })).sfxVolume).toBe(0);
  });

  test('save then load round-trips and mirrors the model for the Motion Lab', () => {
    const st = memory();
    const s = { ...DEFAULT_SETTINGS, cameraId: 'cam-2', model: 'lite' as const, sfxVolume: 0.3, safetyAck: true };
    saveSettings(s, st);
    expect(loadSettings(st)).toEqual(s);
    expect(st.getItem('bf.model')).toBe('lite');
  });

  test('storage that throws (site data blocked) gives defaults and does not crash on save', () => {
    const broken = { ...memory(), getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceededError'); } } as Storage;
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, broken)).not.toThrow();
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  test('an older bf.model key is honored when no settings exist yet', () => {
    expect(loadSettings(memory({ 'bf.model': 'lite' })).model).toBe('lite');
  });
});

describe('MotionSession uses the settings', () => {
  const fakes = () => {
    const tracker = { start: vi.fn(), stop: vi.fn(), close: vi.fn() };
    const deps: SessionDeps = {
      openCamera: vi.fn(async () => ({}) as HTMLVideoElement),
      closeCamera: vi.fn(),
      createTracker: vi.fn(async () => tracker),
    };
    return { tracker, deps };
  };

  test('opens the chosen camera', async () => {
    const st = memory();
    saveSettings({ ...DEFAULT_SETTINGS, cameraId: 'cam-2' }, st);
    const f = fakes();
    await new MotionSession(f.deps, st).start();
    expect(f.deps.openCamera).toHaveBeenCalledWith('cam-2');
  });

  test('a changed model reloads the tracker on the next start', async () => {
    const st = memory();
    const f = fakes();
    const s = new MotionSession(f.deps, st);
    await s.start();
    expect(f.deps.createTracker).toHaveBeenLastCalledWith('full');
    s.pause();
    saveSettings({ ...DEFAULT_SETTINGS, model: 'lite' }, st);
    await s.start();
    expect(f.tracker.close).toHaveBeenCalled();
    expect(f.deps.createTracker).toHaveBeenLastCalledWith('lite');
    s.pause();
    await s.start();
    expect(f.deps.createTracker).toHaveBeenCalledTimes(2);
  });
});

describe('review fixes: session restarts and missing cameras', () => {
  test('pause then start again while the model is still loading still starts with a live camera', async () => {
    const tracker = { start: vi.fn(), stop: vi.fn(), close: vi.fn() };
    let resolveTracker!: () => void;
    const video = {} as HTMLVideoElement;
    const deps: SessionDeps = {
      openCamera: vi.fn(async () => video),
      closeCamera: vi.fn(),
      createTracker: vi.fn(() => new Promise<typeof tracker>((r) => (resolveTracker = () => r(tracker)))),
    };
    const s = new MotionSession(deps, memory());
    const first = s.start();
    await vi.waitFor(() => expect(deps.createTracker).toHaveBeenCalled());
    s.pause();
    const second = s.start();
    resolveTracker();
    await first;
    await second;
    expect(tracker.start).toHaveBeenCalledWith(video, expect.any(Function));
    expect(s.running).toBe(true);
  });

  test('a saved camera that is gone falls back to the default camera', async () => {
    const st = memory();
    saveSettings({ ...DEFAULT_SETTINGS, cameraId: 'unplugged' }, st);
    const video = {} as HTMLVideoElement;
    const deps: SessionDeps = {
      openCamera: vi.fn(async (id?: string) => {
        if (id) throw new CameraError('not_found', 'gone');
        return video;
      }),
      closeCamera: vi.fn(),
      createTracker: vi.fn(async () => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() })),
    };
    const s = new MotionSession(deps, st);
    await s.start();
    expect(vi.mocked(deps.openCamera).mock.lastCall?.[0]).toBeUndefined();
    expect(s.running).toBe(true);
  });
});
