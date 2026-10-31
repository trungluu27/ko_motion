import type { ActionEvent, ControlFrame, DiscreteAction } from '../../shared/types';

/** KeyboardEvent.code values held down, and those newly pressed since the last read. */
export type KeyState = { down: ReadonlySet<string>; pressed: ReadonlySet<string> };

const EVENT_KEYS: readonly [string, DiscreteAction][] = [
  ['KeyJ', 'punch_l'],
  ['KeyK', 'punch_r'],
  ['KeyU', 'kick_l'],
  ['KeyI', 'kick_r'],
  ['KeyW', 'jump'],
];

/** Spec 6.4 keyboard layout, expressed as the same ControlFrame the motion engine produces. */
export function keyboardControl(k: KeyState, t: number): ControlFrame {
  const events: ActionEvent[] = EVENT_KEYS.filter(([code]) => k.pressed.has(code)).map(([, action]) => ({
    action, confidence: 1, t, frameId: 0,
  }));
  const axis = (neg: string, pos: string) => ((k.down.has(pos) ? 1 : 0) - (k.down.has(neg) ? 1 : 0)) as -1 | 0 | 1;
  return {
    t,
    events,
    tracking: 'ok',
    state: {
      block: k.down.has('Space'),
      crouch: k.down.has('KeyS'),
      dodge: axis('KeyQ', 'KeyE'),
      move: axis('KeyA', 'KeyD'),
    },
  };
}
