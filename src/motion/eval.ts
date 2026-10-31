import { type ActionEvent, DISCRETE_ACTIONS, type DiscreteAction } from '../shared/types';
import type { Label } from './session/format';

export type ActionScore = { tp: number; fp: number; fn: number; precision: number; recall: number };

/**
 * Matches recognized events to ground-truth labels: an event counts as a hit if it falls in
 * [tStart, tEnd + toleranceMs] of a label of the same action, up to expectedCount (default 1) hits per label.
 */
export function evaluate(
  outputs: { events: ActionEvent[] }[],
  labels: Label[],
  toleranceMs = 300,
): Record<DiscreteAction, ActionScore> {
  const events = outputs.flatMap((o) => o.events).sort((a, b) => a.t - b.t);
  const result = {} as Record<DiscreteAction, ActionScore>;
  for (const action of DISCRETE_ACTIONS) {
    const own = labels.filter((l) => l.action === action).map((l) => ({ ...l, left: l.expectedCount ?? 1 }));
    let tp = 0;
    let fp = 0;
    for (const e of events.filter((ev) => ev.action === action)) {
      const slot = own.find((l) => l.left > 0 && e.t >= l.tStart && e.t <= l.tEnd + toleranceMs);
      if (slot) {
        slot.left--;
        tp++;
      } else {
        fp++;
      }
    }
    const fn = own.reduce((a, l) => a + l.left, 0);
    result[action] = {
      tp,
      fp,
      fn,
      precision: tp + fp === 0 ? 1 : tp / (tp + fp),
      recall: tp + fn === 0 ? 1 : tp / (tp + fn),
    };
  }
  return result;
}
