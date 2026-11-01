export type MenuAction = 'none' | 'select' | 'back' | 'left' | 'right';

const ACTIONS: Record<string, MenuAction> = {
  Enter: 'select', Space: 'select', NumpadEnter: 'select', Escape: 'back',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
const MOVES: Record<string, -1 | 1> = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 };

/** Keyboard navigation of a vertical menu: up/down wrap, the rest are actions on the current item. */
export function menuNav(index: number, count: number, code: string): { index: number; action: MenuAction } {
  const step = MOVES[code];
  if (step) return { index: (index + step + count) % count, action: 'none' };
  return { index, action: ACTIONS[code] ?? 'none' };
}
