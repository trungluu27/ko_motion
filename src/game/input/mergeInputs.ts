import type { TickInput } from '../sim/types';

/** Combines two input sources for one fighter (body + keyboard): first attack wins, held states are OR-ed. */
export function mergeInputs(a: TickInput, b: TickInput): TickInput {
  return {
    attack: a.attack ?? b.attack,
    block: a.block || b.block,
    crouch: a.crouch || b.crouch,
    dodge: a.dodge || b.dodge,
    move: a.move !== 0 ? a.move : b.move,
    jump: a.jump || b.jump,
  };
}
