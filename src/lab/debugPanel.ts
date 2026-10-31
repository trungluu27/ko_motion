import type { ActionEvent } from '../shared/types';
import type { Features } from '../motion/features';
import { DEFAULT_CONFIG } from '../motion/config';
import { ACTION_TEXT, type Rect } from '../view/webcamPanel';

export type SeriesKey = 'armExt_l' | 'armExt_r' | 'ankleLift_l' | 'ankleLift_r' | 'lean' | 'hipDx' | 'hipDy';
export type FeatureSample = { t: number } & Record<SeriesKey, number>;

export function sampleOf(f: Features): FeatureSample {
  return {
    t: f.t,
    armExt_l: f.armExt.l,
    armExt_r: f.armExt.r,
    ankleLift_l: f.ankleLift.l,
    ankleLift_r: f.ankleLift.r,
    lean: f.lean,
    hipDx: f.hipDx,
    hipDy: f.hipDy,
  };
}

const c = DEFAULT_CONFIG;
const SERIES: { key: SeriesKey; min: number; max: number; thresholds: number[] }[] = [
  { key: 'armExt_l', min: 0.2, max: 1.05, thresholds: [c.punch.extOn, c.punch.extOff] },
  { key: 'armExt_r', min: 0.2, max: 1.05, thresholds: [c.punch.extOn, c.punch.extOff] },
  { key: 'ankleLift_l', min: -0.1, max: 0.8, thresholds: [c.kick.liftOn] },
  { key: 'ankleLift_r', min: -0.1, max: 0.8, thresholds: [c.kick.liftOn] },
  { key: 'lean', min: -40, max: 40, thresholds: [c.dodge.leanOnDeg, -c.dodge.leanOnDeg] },
  { key: 'hipDx', min: -1.5, max: 1.5, thresholds: [c.move.on, -c.move.on] },
  { key: 'hipDy', min: -0.5, max: 0.6, thresholds: [c.crouch.dropOn, -c.jump.riseOn] },
];

export type LogEntry = { event: ActionEvent; latencyMs: number | null };

export type DebugData = {
  history: FeatureSample[];
  log: LogEntry[];
  trackingFps: number;
  inferMs: number | null;
  p50: number | null;
  p95: number | null;
  delegate: string;
  model: string;
  calibrated: boolean;
  footer?: string[];
};

const fmt = (x: number | null, unit = '') => (x === null ? '–' : `${x.toFixed(0)}${unit}`);

/** Right-hand debug panel: stats header, feature sparklines with thresholds, recent event log. */
export function drawDebugPanel(ctx: CanvasRenderingContext2D, rect: Rect, d: DebugData): void {
  ctx.save();
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.font = '14px ui-monospace, monospace';
  ctx.fillStyle = '#e2e8f0';
  const stats = [
    `Tracking ${d.trackingFps} FPS`,
    `Infer ${fmt(d.inferMs, ' ms')}`,
    `Latency p50 ${fmt(d.p50, ' ms')} · p95 ${fmt(d.p95, ' ms')}`,
    `${d.delegate} · ${d.model} · ${d.calibrated ? 'calibrated' : 'chưa calibrate'}`,
  ];
  stats.forEach((s, i) => ctx.fillText(s, rect.x + 16, rect.y + 24 + i * 20));

  const top = rect.y + 110;
  const graphW = 500;
  const rowH = 76;
  const now = d.history.length ? d.history[d.history.length - 1].t : 0;
  const span = 5000;
  SERIES.forEach((s, i) => {
    const gx = rect.x + 16;
    const gy = top + i * rowH;
    const gh = rowH - 22;
    ctx.fillStyle = '#111827';
    ctx.fillRect(gx, gy, graphW, gh);
    const yOf = (v: number) => gy + gh - ((Math.min(s.max, Math.max(s.min, v)) - s.min) / (s.max - s.min)) * gh;
    ctx.strokeStyle = 'rgba(248,113,113,0.7)';
    ctx.setLineDash([4, 4]);
    for (const th of s.thresholds) {
      ctx.beginPath();
      ctx.moveTo(gx, yOf(th));
      ctx.lineTo(gx + graphW, yOf(th));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (const h of d.history) {
      if (now - h.t > span) continue;
      const x = gx + graphW - ((now - h.t) / span) * graphW;
      const y = yOf(h[s.key]);
      if (started) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      started = true;
    }
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px ui-monospace, monospace';
    const last = d.history[d.history.length - 1];
    ctx.fillText(`${s.key} ${last ? last[s.key].toFixed(2) : ''}`, gx, gy + gh + 14);
  });

  const lx = rect.x + 540;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('Sự kiện gần nhất', lx, top - 8);
  ctx.font = '13px ui-monospace, monospace';
  d.log.slice(-20).reverse().forEach((entry, i) => {
    const e = entry.event;
    ctx.fillStyle = i === 0 ? '#facc15' : '#cbd5e1';
    ctx.fillText(
      `${(e.t / 1000).toFixed(1).padStart(6)}s ${ACTION_TEXT[e.action].padEnd(11)} ${e.confidence.toFixed(2)} ${fmt(entry.latencyMs, 'ms')}`,
      lx,
      top + 14 + i * 20,
    );
  });

  if (d.footer?.length) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px ui-monospace, monospace';
    const fy = top + 14 + 20 * 20 + 10;
    d.footer.forEach((line, i) => ctx.fillText(line, lx, fy + i * 18));
  }
  ctx.restore();
}
