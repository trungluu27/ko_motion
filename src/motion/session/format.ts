import type { DiscreteAction, PoseFrame } from '../../shared/types';
import type { Calibration } from '../calibration';

export type LabelAction = DiscreteAction | 'block' | 'crouch' | 'dodge_l' | 'dodge_r' | 'move_l' | 'move_r' | 'idle';
export type Label = { action: LabelAction; tStart: number; tEnd: number; expectedCount?: number };

export type Session = {
  version: 1;
  createdAt: string;
  width: number;
  height: number;
  model: 'full' | 'lite';
  calibration: Calibration | null;
  labels: Label[];
  frames: PoseFrame[];
};

export class SessionFormatError extends Error {
  override name = 'SessionFormatError';
}

const round4 = (_key: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);

export function serializeSession(s: Session): string {
  return JSON.stringify(s, round4);
}

export function parseSession(text: string): Session {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SessionFormatError('File phiên không phải JSON hợp lệ.');
  }
  if (typeof data !== 'object' || data === null) throw new SessionFormatError('File phiên rỗng hoặc sai cấu trúc.');
  const s = data as Partial<Session>;
  if (s.version !== 1) throw new SessionFormatError(`Phiên bản file không hỗ trợ: ${String(s.version)} (cần 1).`);
  if (!Array.isArray(s.frames)) throw new SessionFormatError('File phiên thiếu danh sách frames.');
  return { labels: [], calibration: null, ...s } as Session;
}
