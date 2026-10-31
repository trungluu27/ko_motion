import { NO_INPUT, type Match, type SimEvent, type TickInput } from '../../../src/game/sim/types';
import { stepMatch } from '../../../src/game/sim/match';

export const inp = (p: Partial<TickInput> = {}): TickInput => ({ ...NO_INPUT, ...p });

/** Steps the match n times with the same inputs; returns every event emitted, tagged with the tick (1-based). */
export function run(m: Match, n: number, p0: Partial<TickInput> = {}, p1: Partial<TickInput> = {}): (SimEvent & { tick: number })[] {
  const out: (SimEvent & { tick: number })[] = [];
  for (let i = 1; i <= n; i++) {
    stepMatch(m, [inp(p0), inp(p1)]);
    out.push(...m.events.map((e) => ({ ...e, tick: i })));
  }
  return out;
}

/** One tick with an attack request, then idle ticks. */
export function press(m: Match, who: 0 | 1, p: Partial<TickInput>, idleAfter = 0) {
  const first = run(m, 1, who === 0 ? p : {}, who === 1 ? p : {});
  return [...first, ...run(m, idleAfter).map((e) => ({ ...e, tick: e.tick + 1 }))];
}
