// Replays every recorded session in fixtures/sessions and prints precision/recall per discrete action.
// Usage: npm run eval [-- --dump <dir>]   (--dump writes <name>.features.csv and <name>.labels.json per session)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseSession } from '../src/motion/session/format';
import { replaySession } from '../src/motion/session/replay';
import { type ActionScore, evaluate } from '../src/motion/eval';
import type { EngineOutput } from '../src/motion/motionEngine';
import { DISCRETE_ACTIONS, type DiscreteAction } from '../src/shared/types';

const DIR = join('fixtures', 'sessions');

function flatten(prefix: string, v: unknown, row: Record<string, number>): void {
  if (typeof v === 'number') row[prefix] = v;
  else if (typeof v === 'boolean') row[prefix] = v ? 1 : 0;
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) flatten(prefix ? `${prefix}_${k}` : k, x, row);
}

function toCsv(outputs: EngineOutput[]): string {
  const rows = outputs.flatMap((o) => {
    if (!o.features) return [];
    const row: Record<string, number> = {};
    flatten('', o.features, row);
    row.block = o.state.block ? 1 : 0;
    row.crouch = o.state.crouch ? 1 : 0;
    row.dodge = o.state.dodge;
    row.move = o.state.move;
    return [{ row, events: o.events.map((e) => e.action).join('|') }];
  });
  if (!rows.length) return '';
  const cols = Object.keys(rows[0].row);
  return [[...cols, 'events'].join(','), ...rows.map((r) => [...cols.map((c) => r.row[c]), r.events].join(','))].join('\n');
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(7);

function printTable(name: string, scores: Record<DiscreteAction, ActionScore>): void {
  console.log(`\n${name}`);
  console.log('action      tp   fp   fn  precision  recall');
  for (const a of DISCRETE_ACTIONS) {
    const s = scores[a];
    console.log(`${a.padEnd(10)} ${String(s.tp).padStart(3)}  ${String(s.fp).padStart(3)}  ${String(s.fn).padStart(3)}    ${pct(s.precision)}  ${pct(s.recall)}`);
  }
}

const args = process.argv.slice(2);
const dumpIdx = args.indexOf('--dump');
const dumpDir = dumpIdx >= 0 ? args[dumpIdx + 1] : null;

const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json') || f.endsWith('.json.gz')) : [];
if (!files.length) {
  console.log(`No sessions found in ${DIR}`);
  process.exit(0);
}

const total = new Map<DiscreteAction, ActionScore>();
for (const file of files) {
  const raw = readFileSync(join(DIR, file));
  const session = parseSession((file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'));
  const outputs = replaySession(session);
  const scores = evaluate(outputs, session.labels);
  printTable(file, scores);
  for (const a of DISCRETE_ACTIONS) {
    const t = total.get(a) ?? { tp: 0, fp: 0, fn: 0, precision: 1, recall: 1 };
    const s = scores[a];
    const tp = t.tp + s.tp;
    const fp = t.fp + s.fp;
    const fn = t.fn + s.fn;
    total.set(a, { tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 1 });
  }
  if (dumpDir) {
    mkdirSync(dumpDir, { recursive: true });
    const stem = basename(file).replace(/\.json(\.gz)?$/, '');
    writeFileSync(join(dumpDir, `${stem}.features.csv`), toCsv(outputs));
    writeFileSync(join(dumpDir, `${stem}.labels.json`), JSON.stringify(session.labels, null, 2));
  }
}
if (files.length > 1) printTable('TOTAL', Object.fromEntries(total) as Record<DiscreteAction, ActionScore>);
