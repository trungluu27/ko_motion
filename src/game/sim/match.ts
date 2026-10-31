import {
  ARENA_W, BLOCK_REDUCTION, BLOCK_STAMINA, BLOCKSTUN, DODGE_INVULN, DODGE_RECOVERY, EDGE, GUARD_BREAK_STUN,
  HITSTOP, HITSTUN, JUMP_AIR_END, JUMP_AIR_START, JUMP_FRAMES, KNOCKBACK, MATCH_FRAMES, MAX_HP, MAX_SPECIAL, MAX_STAMINA, MIN_GAP,
  REGEN_DELAY, REGEN_PER_FRAME, SPECIAL_CANCEL_FRAMES, SPECIAL_ON_HIT, SPECIAL_ON_HURT, START_X, WALK_SPEED,
} from './constants';
import { HISTORY_LIMIT, comboByName, matchCombo } from './combo';
import { MOVES } from './moves';
import type { Fighter, HistoryToken, Match, MoveId, TickInput } from './types';

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
const isFree = (f: Fighter) =>
  f.action.kind === 'idle' || f.action.kind === 'walk' || f.action.kind === 'crouch' || f.action.kind === 'block';

function regenStamina(f: Fighter): void {
  if (f.sinceSpend >= REGEN_DELAY) f.stamina = Math.min(MAX_STAMINA, f.stamina + REGEN_PER_FRAME);
  f.sinceSpend++;
}

/** Frames until the move's active window opens, including the fighter's telegraph. */
const startupOf = (f: Fighter, move: MoveId) => MOVES[move].startup + f.extraStartup;

/** Advances timed actions; returns to idle when they finish. */
function advanceAction(f: Fighter): void {
  const a = f.action;
  if (a.kind === 'jump') {
    a.frame++;
    if (a.frame >= JUMP_FRAMES) f.action = { kind: 'idle' };
  } else if (a.kind === 'attack') {
    a.frame++;
    const d = MOVES[a.move];
    if (a.frame >= startupOf(f, a.move) + d.active + d.recovery) f.action = { kind: 'idle' };
  } else if (a.kind === 'dodge') {
    a.frame++;
    if (a.frame >= DODGE_INVULN + DODGE_RECOVERY) f.action = { kind: 'idle' };
  } else if (a.kind === 'hitstun' || a.kind === 'blockstun') {
    a.frames--;
    if (a.frames <= 0) f.action = { kind: 'idle' };
  }
}

function remember(m: Match, f: Fighter, token: HistoryToken): void {
  f.history.push({ token, frame: m.frame });
  if (f.history.length > HISTORY_LIMIT) f.history.shift();
}

const otherPunch = (move: MoveId): MoveId | null => (move === 'punch_l' ? 'punch_r' : move === 'punch_r' ? 'punch_l' : null);

/** Both punches within SPECIAL_CANCEL_FRAMES on a full meter turn the first punch into the special. */
function trySpecialCancel(m: Match, i: 0 | 1, inp: TickInput): void {
  const f = m.fighters[i];
  const a = f.action;
  if (a.kind !== 'attack' || !inp.attack || a.frame > SPECIAL_CANCEL_FRAMES) return;
  if (otherPunch(a.move) !== inp.attack || f.special < MOVES.special.specialCost) return;
  f.special -= MOVES.special.specialCost;
  f.action = { kind: 'attack', move: 'special', frame: 0, hasHit: false, evaded: false, combo: null };
  remember(m, f, 'special');
  m.events.push({ type: 'attack', fighter: i, move: 'special' });
}

function startAttack(m: Match, i: 0 | 1, move: MoveId): void {
  const f = m.fighters[i];
  const d = MOVES[move];
  if (f.stamina < d.stamina) {
    m.events.push({ type: 'tired', fighter: i, move });
    f.action = { kind: 'idle' };
    return;
  }
  f.stamina -= d.stamina;
  if (d.stamina > 0) f.sinceSpend = 0;
  remember(m, f, move);
  f.action = { kind: 'attack', move, frame: 0, hasHit: false, evaded: false, combo: matchCombo(f.history)?.name ?? null };
  m.events.push({ type: 'attack', fighter: i, move });
}

function applyInput(m: Match, i: 0 | 1, inp: TickInput): void {
  const f = m.fighters[i];
  if (!isFree(f)) return trySpecialCancel(m, i, inp);
  if (inp.attack) {
    startAttack(m, i, inp.attack);
  } else if (inp.dodge) {
    f.action = { kind: 'dodge', frame: 0 };
    remember(m, f, 'dodge');
  } else if (inp.block) {
    if (f.action.kind !== 'block') remember(m, f, 'block');
    f.action = { kind: 'block' };
  } else if (inp.jump && f.action.kind !== 'crouch') {
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

type Hit = { attacker: 0 | 1; move: MoveId };

/** Active attacks that connect this tick, judged from the same state for both fighters (fair trades). */
function collectHits(m: Match): Hit[] {
  const hits: Hit[] = [];
  m.fighters.forEach((atk, i) => {
    const a = atk.action;
    if (a.kind !== 'attack' || a.hasHit) return;
    const d = MOVES[a.move];
    const start = startupOf(atk, a.move);
    if (a.frame < start || a.frame >= start + d.active) return;
    const def = m.fighters[1 - i];
    const reach = (def.x - atk.x) * atk.facing;
    if (reach < 0 || reach > d.range) return;
    if (evades(def, d.height)) {
      if (!a.evaded) m.events.push({ type: 'evaded', fighter: (1 - i) as 0 | 1, move: a.move });
      a.evaded = true;
      return;
    }
    hits.push({ attacker: i as 0 | 1, move: a.move });
  });
  return hits;
}

/** Dodge invulnerability, crouching under high attacks, jumping over mid attacks. */
function evades(def: Fighter, height: 'high' | 'mid'): boolean {
  const a = def.action;
  if (a.kind === 'dodge') return a.frame < DODGE_INVULN;
  if (a.kind === 'crouch') return height === 'high';
  if (a.kind === 'jump') return height === 'mid' && a.frame >= JUMP_AIR_START && a.frame <= JUMP_AIR_END;
  return false;
}

/** Damage values are kept to hundredths so multipliers do not leave float noise in HP. */
const roundDamage = (x: number) => Math.round(x * 100) / 100;

function applyHit(m: Match, hit: Hit): void {
  const atk = m.fighters[hit.attacker];
  const def = m.fighters[1 - hit.attacker];
  const combo = atk.action.kind === 'attack' && atk.action.combo ? comboByName(atk.action.combo) : null;
  const full = roundDamage(MOVES[hit.move].damage * (combo?.damageMult ?? 1));
  if (atk.action.kind === 'attack') atk.action.hasHit = true;
  m.hitstop = HITSTOP;
  if (def.action.kind === 'block' && def.stamina >= BLOCK_STAMINA) {
    const damage = roundDamage(full * (1 - BLOCK_REDUCTION));
    def.hp = Math.max(0, roundDamage(def.hp - damage));
    def.stamina -= BLOCK_STAMINA;
    def.sinceSpend = 0;
    def.action = { kind: 'blockstun', frames: BLOCKSTUN };
    m.events.push({ type: 'blocked', fighter: hit.attacker, move: hit.move, damage });
    return;
  }
  const guardBroken = def.action.kind === 'block';
  def.hp = Math.max(0, roundDamage(def.hp - full));
  def.action = { kind: 'hitstun', frames: guardBroken ? GUARD_BREAK_STUN : HITSTUN };
  def.x += atk.facing * KNOCKBACK;
  atk.special = Math.min(MAX_SPECIAL, atk.special + SPECIAL_ON_HIT);
  def.special = Math.min(MAX_SPECIAL, def.special + SPECIAL_ON_HURT);
  m.events.push({ type: guardBroken ? 'guard_break' : 'hit', fighter: hit.attacker, move: hit.move, damage: full });
  if (combo) {
    atk.special = Math.min(MAX_SPECIAL, atk.special + combo.specialBonus);
    m.events.push({ type: 'combo', fighter: hit.attacker, combo: combo.name });
  }
}

function checkKo(m: Match): void {
  const down = m.fighters.map((f) => f.hp <= 0);
  if (!down[0] && !down[1]) return;
  m.fighters.forEach((f, i) => {
    if (down[i]) f.action = { kind: 'ko' };
    else m.events.push({ type: 'ko', fighter: i as 0 | 1 });
  });
  m.result = { winner: down[0] && down[1] ? null : down[0] ? 1 : 0, reason: 'ko' };
}

/** Advances the match by one 60 Hz tick. */
export function stepMatch(m: Match, inputs: [TickInput, TickInput]): void {
  m.events = [];
  if (m.result) return;
  if (m.hitstop > 0) {
    m.hitstop--;
    return;
  }
  m.fighters.forEach((f, i) => {
    regenStamina(f);
    advanceAction(f);
    applyInput(m, i as 0 | 1, inputs[i]);
  });
  for (const hit of collectHits(m)) applyHit(m, hit);
  resolveSpacing(m);
  checkKo(m);
  m.framesLeft--;
  m.frame++;
}
