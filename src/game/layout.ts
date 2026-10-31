import { ARENA_W } from './sim/constants';

export type ViewMode = 'split' | 'pip' | 'game';

/** Order of the V key. */
export const VIEW_MODES: readonly ViewMode[] = ['split', 'pip', 'game'];

export type Region = { x: number; y: number; w: number; h: number };
export type Layout = { arena: Region; webcam: Region | null };

export const CANVAS_W = 1280;
export const CANVAS_H = 720;
const SPLIT_WEBCAM_W = 480;
const PIP = { w: 320, h: 180, margin: 16, top: 90 };
const GROUND_Y = 620;
const SIDE_MARGIN = 40;

export function layoutFor(mode: ViewMode): Layout {
  const full: Region = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
  switch (mode) {
    case 'split':
      return {
        arena: { x: SPLIT_WEBCAM_W, y: 0, w: CANVAS_W - SPLIT_WEBCAM_W, h: CANVAS_H },
        webcam: { x: 0, y: 0, w: SPLIT_WEBCAM_W, h: CANVAS_H },
      };
    case 'pip':
      return { arena: full, webcam: { x: CANVAS_W - PIP.margin - PIP.w, y: PIP.top, w: PIP.w, h: PIP.h } };
    default:
      return { arena: full, webcam: null };
  }
}

/** Screen mapping for the fight inside an arena region. */
export type ArenaView = {
  region: Region;
  /** arena x (0..1000) → screen x */
  toScreen: (x: number) => number;
  groundY: number;
  /** size of bodies, jumps and offsets relative to the full-width arena */
  bodyScale: number;
};

export function arenaView(arena: Region): ArenaView {
  const s = arena.w / CANVAS_W;
  const margin = SIDE_MARGIN * s;
  return {
    region: arena,
    toScreen: (x) => arena.x + margin + (x / ARENA_W) * (arena.w - 2 * margin),
    groundY: GROUND_Y,
    bodyScale: s,
  };
}
