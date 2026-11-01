import type { Rng } from '../../shared/rng';
import type { ActionEvent } from '../../shared/types';

export type DrillMove = 'punch_l' | 'punch_r' | 'kick_l' | 'kick_r' | 'block';
export const DRILL_MOVES: readonly DrillMove[] = ['punch_l', 'punch_r', 'kick_l', 'kick_r', 'block'];

/** Time to perform a called move. */
export const PROMPT_MS = 2500;
const GAP_MIN_MS = 1000;
const GAP_MAX_MS = 1800;

export type RoundResult = { move: DrillMove; outcome: 'hit' | 'wrong' | 'miss'; reactionMs: number | null };
export type DrillView = { phase: 'wait' | 'prompt' | 'done'; prompt: DrillMove | null; last: RoundResult | null; round: number; rounds: number };
export type DrillSummary = { accuracy: number; meanReactionMs: number | null; perMove: Record<DrillMove, { hit: number; total: number }> };

/** Calls random moves and scores the reaction to each (spec phase5 5). Times are performance.now() ms. */
export class Drill {
  readonly sequence: DrillMove[] = [];
  private readonly gaps: number[] = [];
  private readonly results: RoundResult[] = [];
  private phase: DrillView['phase'] = 'wait';
  private waitUntil: number | null = null;
  private promptAt = 0;
  private prevBlock = false;

  constructor(rng: Rng, opts: { rounds?: number } = {}) {
    const rounds = opts.rounds ?? 12;
    while (this.sequence.length < rounds) {
      const m = DRILL_MOVES[Math.floor(rng() * DRILL_MOVES.length)];
      const n = this.sequence.length;
      // no move three times in a row
      if (n >= 2 && this.sequence[n - 1] === m && this.sequence[n - 2] === m) continue;
      this.sequence.push(m);
      this.gaps.push(GAP_MIN_MS + rng() * (GAP_MAX_MS - GAP_MIN_MS));
    }
  }

  private get round(): number {
    return this.results.length;
  }

  update(now: number, frame: { events: ActionEvent[]; block: boolean }): DrillView {
    const blockEdge = frame.block && !this.prevBlock;
    this.prevBlock = frame.block;
    if (this.phase === 'wait') {
      this.waitUntil ??= now + this.gaps[this.round];
      if (now >= this.waitUntil) {
        this.phase = 'prompt';
        this.promptAt = now;
      }
    } else if (this.phase === 'prompt') {
      const move = this.sequence[this.round];
      // only answers given after the call count; jumps are not part of the drill
      const e = frame.events.find((x) => x.t >= this.promptAt && x.action !== 'jump');
      if (move === 'block' ? blockEdge : e?.action === move) {
        this.finish({ move, outcome: 'hit', reactionMs: (move === 'block' ? now : e!.t) - this.promptAt }, now);
      } else if (e) {
        this.finish({ move, outcome: 'wrong', reactionMs: null }, now);
      } else if (now - this.promptAt > PROMPT_MS) {
        this.finish({ move, outcome: 'miss', reactionMs: null }, now);
      }
    }
    return this.view();
  }

  private finish(r: RoundResult, now: number): void {
    this.results.push(r);
    if (this.round >= this.sequence.length) {
      this.phase = 'done';
    } else {
      this.phase = 'wait';
      this.waitUntil = now + this.gaps[this.round];
    }
  }

  view(): DrillView {
    return {
      phase: this.phase,
      prompt: this.phase === 'prompt' ? this.sequence[this.round] : null,
      last: this.results.at(-1) ?? null,
      round: this.round,
      rounds: this.sequence.length,
    };
  }

  summary(): DrillSummary {
    const perMove = Object.fromEntries(DRILL_MOVES.map((m) => [m, { hit: 0, total: 0 }])) as DrillSummary['perMove'];
    const times: number[] = [];
    for (const r of this.results) {
      perMove[r.move].total++;
      if (r.outcome === 'hit') {
        perMove[r.move].hit++;
        times.push(r.reactionMs ?? 0);
      }
    }
    return {
      accuracy: this.results.length ? times.length / this.results.length : 0,
      meanReactionMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
      perMove,
    };
  }
}
