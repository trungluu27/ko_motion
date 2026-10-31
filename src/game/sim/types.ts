export type MoveId = 'punch_l' | 'punch_r' | 'kick_l' | 'kick_r' | 'special';
export type Height = 'high' | 'mid';

export type MoveData = {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  stamina: number;
  specialCost: number;
  /** reach in arena units, measured forward from the attacker's x */
  range: number;
  height: Height;
};

export type ComboName = 'double_jab' | 'triple_attack' | 'counter' | 'power_combo';

export type Action =
  | { kind: 'idle' }
  | { kind: 'walk' }
  | { kind: 'block' }
  | { kind: 'crouch' }
  | { kind: 'ko' }
  | { kind: 'attack'; move: MoveId; frame: number; hasHit: boolean; evaded: boolean; combo: ComboName | null }
  | { kind: 'dodge'; frame: number }
  | { kind: 'jump'; frame: number }
  | { kind: 'hitstun'; frames: number }
  | { kind: 'blockstun'; frames: number };

export type HistoryToken = MoveId | 'block' | 'dodge';

export type Fighter = {
  x: number;
  facing: 1 | -1;
  hp: number;
  stamina: number;
  special: number;
  action: Action;
  /** frames since stamina was last spent */
  sinceSpend: number;
  /** telegraph frames added to every attack's startup (NPC) */
  extraStartup: number;
  history: { token: HistoryToken; frame: number }[];
};

/** One fighter's intent for one 60 Hz tick. `move` is a screen direction (+1 = right). */
export type TickInput = {
  attack: MoveId | null;
  block: boolean;
  crouch: boolean;
  dodge: boolean;
  move: -1 | 0 | 1;
  jump: boolean;
};

export const NO_INPUT: Readonly<TickInput> = Object.freeze({
  attack: null, block: false, crouch: false, dodge: false, move: 0, jump: false,
});

export type SimEvent = {
  type: 'attack' | 'hit' | 'blocked' | 'guard_break' | 'evaded' | 'tired' | 'combo' | 'ko';
  fighter: 0 | 1;
  move?: MoveId;
  damage?: number;
  combo?: ComboName;
};

export type MatchResult = { winner: 0 | 1 | null; reason: 'ko' | 'timeout' };

export type Match = {
  frame: number;
  fighters: [Fighter, Fighter];
  hitstop: number;
  framesLeft: number;
  result: MatchResult | null;
  events: SimEvent[];
  /** attack presses made during hitstop, applied on the first tick after it */
  buffered: [MoveId | null, MoveId | null];
};
