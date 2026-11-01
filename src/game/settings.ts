import type { ViewMode } from './layout';

/** What replaces the room behind the player on the webcam panels (spec webcam-background 2). */
export type WebcamBg = 'off' | 'blur' | 'neon' | 'studio';
export const WEBCAM_BGS: readonly WebcamBg[] = ['off', 'blur', 'neon', 'studio'];
export const nextBg = (bg: WebcamBg): WebcamBg => WEBCAM_BGS[(WEBCAM_BGS.indexOf(bg) + 1) % WEBCAM_BGS.length];

export type Settings = {
  control: 'keyboard' | 'body';
  view: ViewMode;
  model: 'full' | 'lite';
  cameraId: string | null;
  /** 0..1 */
  sfxVolume: number;
  music: boolean;
  /** the safety screen was acknowledged once */
  safetyAck: boolean;
  webcamBg: WebcamBg;
};

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  control: 'keyboard', view: 'split', model: 'full', cameraId: null, sfxVolume: 0.8, music: true, safetyAck: false, webcamBg: 'off',
});

const KEY = 'bf.settings';
/** the Motion Lab reads the pose model from its own key */
const MODEL_KEY = 'bf.model';

/** localStorage, or null where the browser blocks site data (reading the property itself can throw). */
function defaultStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

const oneOf = <T extends string>(v: unknown, xs: readonly T[], fallback: T): T => (xs.includes(v as T) ? (v as T) : fallback);

/** Settings from storage; each missing or malformed field falls back to its default (spec phase5 3). */
export function loadSettings(storage: Storage | null = defaultStorage()): Settings {
  let raw: Record<string, unknown> = {};
  let sharedModel: string | null = null;
  try {
    sharedModel = storage?.getItem(MODEL_KEY) ?? null;
    const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? '{}');
    if (parsed && typeof parsed === 'object') raw = parsed as Record<string, unknown>;
  } catch {
    // broken JSON: defaults
  }
  const d = DEFAULT_SETTINGS;
  return {
    control: oneOf(raw.control, ['keyboard', 'body'], d.control),
    view: oneOf(raw.view, ['split', 'pip', 'game'], d.view),
    // bf.model is shared with the Motion Lab, so a model picked there wins
    model: oneOf(sharedModel ?? raw.model, ['full', 'lite'], d.model),
    cameraId: typeof raw.cameraId === 'string' ? raw.cameraId : d.cameraId,
    sfxVolume: typeof raw.sfxVolume === 'number' && Number.isFinite(raw.sfxVolume) ? Math.max(0, Math.min(1, raw.sfxVolume)) : d.sfxVolume,
    music: typeof raw.music === 'boolean' ? raw.music : d.music,
    safetyAck: typeof raw.safetyAck === 'boolean' ? raw.safetyAck : d.safetyAck,
    webcamBg: oneOf(raw.webcamBg, WEBCAM_BGS, d.webcamBg),
  };
}

export function saveSettings(s: Settings, storage: Storage | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
    storage?.setItem(MODEL_KEY, s.model);
  } catch {
    // quota exceeded or site data blocked: the settings just do not persist
  }
}
