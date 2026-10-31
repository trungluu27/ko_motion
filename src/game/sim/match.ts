import {
  ARENA_W, EDGE, JUMP_FRAMES, MATCH_FRAMES, MAX_HP, MAX_STAMINA, MIN_GAP, REGEN_DELAY, REGEN_PER_FRAME,
  START_X, WALK_SPEED,
} from './constants';
import type { Fighter, Match, TickInput } from './types';

function newFighter(x: number, facing: 1 | -1, extraStartup: number): Fighter {
  return {
    x, facing, hp: MAX_HP, stamina: MAX_STAMINA, special: 0, action: { kind: 'idle' },
    sinceSpend: REGEN_DELAY, extraStartup, history: [],
  };
}

export function createMatch(opts: { extraStartup?: [number, number] } = {}): Match {
  const extra = opts.extraStartup ?? [0, 0];
  return {
    frame: 0,
    fighters: [newFighter(START_X[0], 1, extra[0]), newFighter(START_X[1], -1, extra[1])],
    hitstop: 0,
    framesLeft: MATCH_FRAMES,
    result: null,
    events: [],
  };
}

/** True when the fighter can take a new action this tick. */
const isFree = (f: Fighter) => f.action.kind === 'idle' || f.action.kind === 'walk' || f.action.kind === 'crouch';

function regenStamina(f: Fighter): void {
  if (f.sinceSpend >= REGEN_DELAY) f.stamina = Math.min(MAX_STAMINA, f.stamina + REGEN_PER_FRAME);
  f.sinceSpend++;
}

/** Advances timed actions; returns to idle when they finish. */
function advanceAction(f: Fighter): void {
  const a = f.action;
  if (a.kind === 'jump') {
    a.frame++;
    if (a.frame >= JUMP_FRAMES) f.action = { kind: 'idle' };
  }
}

function applyInput(f: Fighter, inp: TickInput): void {
  if (!isFree(f)) return;
  if (inp.jump && f.action.kind !== 'crouch') {
    f.action = { kind: 'jump', frame: 0 };
  } else if (inp.crouch) {
    f.action = { kind: 'crouch' };
  } else if (inp.move !== 0) {
    f.x += inp.move * WALK_SPEED;
    f.action = { kind: 'walk' };
  } else {
    f.action = { kind: 'idle' };
  }
}

/** Keeps fighters apart, inside the arena, and facing each other. */
function resolveSpacing(m: Match): void {
  const [a, b] = m.fighters;
  const gap = Math.abs(b.x - a.x);
  if (gap < MIN_GAP) {
    const dir = b.x >= a.x ? 1 : -1;
    const push = (MIN_GAP - gap) / 2;
    a.x -= dir * push;
    b.x += dir * push;
  }
  for (const f of m.fighters) f.x = Math.min(ARENA_W - EDGE, Math.max(EDGE, f.x));
  // a fighter pinned at the edge pushes the other one away instead
  if (Math.abs(b.x - a.x) < MIN_GAP) {
    const dir = b.x >= a.x ? 1 : -1;
    if (a.x === EDGE || a.x === ARENA_W - EDGE) b.x = a.x + dir * MIN_GAP;
    else a.x = b.x - dir * MIN_GAP;
  }
  a.facing = b.x >= a.x ? 1 : -1;
  b.facing = a.x > b.x ? 1 : -1;
}

/** Advances the match by one 60 Hz tick. */
export function stepMatch(m: Match, inputs: [TickInput, TickInput]): void {
  m.events = [];
  m.fighters.forEach((f, i) => {
    regenStamina(f);
    advanceAction(f);
    applyInput(f, inputs[i]);
  });
  resolveSpacing(m);
  m.frame++;
}
