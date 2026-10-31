import type { Calibration } from './calibration';

export const CALIBRATION_KEY = 'bf.calibration';

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const positive = (x: unknown) => num(x) && x > 0;
const lr = (x: unknown) => typeof x === 'object' && x !== null && positive((x as { l: unknown }).l) && positive((x as { r: unknown }).r);

/** Shape check for a stored calibration (it may come from an older build or be hand-edited). */
export function isCalibration(x: unknown): x is Calibration {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    num(c.hipX) && num(c.hipY) && num(c.ankleYL) && num(c.ankleYR) &&
    positive(c.torsoPx) && positive(c.shoulderPx) && positive(c.legPx) &&
    lr(c.upperArm) && lr(c.foreArm)
  );
}

/** The stored calibration, or null (an invalid entry is removed so it is not re-read every time). */
export function loadCalibration(storage: Storage = localStorage): Calibration | null {
  const raw = storage.getItem(CALIBRATION_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isCalibration(parsed)) return parsed;
  } catch {
    // fall through
  }
  storage.removeItem(CALIBRATION_KEY);
  return null;
}

export function saveCalibration(cal: Calibration, storage: Storage = localStorage): void {
  storage.setItem(CALIBRATION_KEY, JSON.stringify(cal));
}
