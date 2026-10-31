import type { ActionEvent, DiscreteAction, PoseFrame, TrackingStatus } from '../shared/types';
import type { EngineOutput } from '../motion/motionEngine';
import { BODY_CONNECTIONS, LM } from '../motion/landmarks';

export type Rect = { x: number; y: number; w: number; h: number };

/** Keeps the most recent action visible for a fixed time after it arrives. */
export class ActionLabelTimer {
  private event: ActionEvent | null = null;
  private shownAt = 0;

  constructor(private readonly durationMs = 600) {}

  push(e: ActionEvent, now: number): void {
    this.event = e;
    this.shownAt = now;
  }

  current(now: number): ActionEvent | null {
    return this.event && now - this.shownAt < this.durationMs ? this.event : null;
  }
}

export const ACTION_TEXT: Record<DiscreteAction, string> = {
  punch_l: 'LEFT PUNCH',
  punch_r: 'RIGHT PUNCH',
  kick_l: 'LEFT KICK',
  kick_r: 'RIGHT KICK',
  jump: 'JUMP',
};

const STATUS_TEXT: Record<TrackingStatus, string> = {
  no_person: 'Không thấy người chơi',
  partial: 'Chưa thấy toàn thân',
  out_of_frame: 'Ra ngoài khung hình',
  ok: 'OK',
};

export type PanelOptions = {
  /** size of the source frame when there is no video (session replay) */
  sourceSize?: { w: number; h: number };
  /** large instruction text, e.g. guided capture prompts */
  prompt?: string;
};

/** Maps normalized image coordinates to the panel, mirrored, matching an object-fit: cover crop. */
function makeProjector(rect: Rect, srcW: number, srcH: number) {
  const scale = Math.max(rect.w / srcW, rect.h / srcH);
  const offX = (srcW * scale - rect.w) / 2;
  const offY = (srcH * scale - rect.h) / 2;
  return {
    scale,
    offX,
    offY,
    point: (nx: number, ny: number) => ({
      x: rect.x + rect.w - (nx * srcW * scale - offX),
      y: rect.y + (ny * srcH * scale - offY),
    }),
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, active: boolean): number {
  ctx.font = 'bold 15px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 20;
  roundRect(ctx, x, y, w, 28, 14);
  ctx.fillStyle = active ? '#22d3ee' : 'rgba(15,23,42,0.6)';
  ctx.fill();
  ctx.fillStyle = active ? '#0f172a' : 'rgba(226,232,240,0.6)';
  ctx.fillText(text, x + 10, y + 19);
  return w + 8;
}

/** Draws the mirrored webcam, skeleton, tracking badge, recognized action and control-state chips. */
export function drawWebcamPanel(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  video: HTMLVideoElement | null,
  frame: PoseFrame | null,
  out: EngineOutput | null,
  label: ActionEvent | null,
  opts: PanelOptions = {},
): void {
  const srcW = video?.videoWidth || opts.sourceSize?.w || rect.w;
  const srcH = video?.videoHeight || opts.sourceSize?.h || rect.h;
  const proj = makeProjector(rect, srcW, srcH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = '#020617';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (video && video.videoWidth) {
    ctx.save();
    ctx.translate(rect.x + rect.w, rect.y);
    ctx.scale(-1, 1);
    ctx.drawImage(video, -proj.offX, -proj.offY, srcW * proj.scale, srcH * proj.scale);
    ctx.restore();
  }

  if (frame) {
    const pts = frame.image.map((l) => ({ ...proj.point(l.x, l.y), v: l.visibility }));
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const [a, b] of BODY_CONNECTIONS) {
      const ok = pts[a].v >= 0.5 && pts[b].v >= 0.5;
      ctx.strokeStyle = ok ? 'rgba(34,211,238,0.9)' : 'rgba(248,113,113,0.7)';
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }
    for (const i of [LM.NOSE, ...BODY_CONNECTIONS.flat()]) {
      const p = pts[i];
      ctx.fillStyle = p.v >= 0.5 ? '#a5f3fc' : '#f87171';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const status = out?.tracking ?? (frame ? 'ok' : 'no_person');
  ctx.font = 'bold 15px system-ui, sans-serif';
  const badge = STATUS_TEXT[status];
  const bw = ctx.measureText(badge).width + 24;
  roundRect(ctx, rect.x + 12, rect.y + 12, bw, 30, 15);
  ctx.fillStyle = status === 'ok' ? 'rgba(22,163,74,0.85)' : 'rgba(220,38,38,0.85)';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(badge, rect.x + 24, rect.y + 32);

  if (out?.needsRecalibration) {
    const text = '⚠ Cần hiệu chỉnh lại';
    const w = ctx.measureText(text).width + 24;
    roundRect(ctx, rect.x + rect.w - w - 12, rect.y + 12, w, 30, 15);
    ctx.fillStyle = 'rgba(234,179,8,0.9)';
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillText(text, rect.x + rect.w - w, rect.y + 32);
  }

  if (label) {
    const text = ACTION_TEXT[label.action];
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(2,6,23,0.85)';
    ctx.strokeText(text, rect.x + rect.w / 2, rect.y + rect.h * 0.62);
    ctx.fillStyle = '#facc15';
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h * 0.62);
    ctx.textAlign = 'left';
  }

  if (opts.prompt) {
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(2,6,23,0.75)';
    ctx.fillRect(rect.x, rect.y + 54, rect.w, 46);
    ctx.fillStyle = '#fff';
    ctx.fillText(opts.prompt, rect.x + rect.w / 2, rect.y + 86);
    ctx.textAlign = 'left';
  }

  const s = out?.state;
  let cx = rect.x + 12;
  const cy = rect.y + rect.h - 40;
  cx += chip(ctx, cx, cy, 'BLOCK', !!s?.block);
  cx += chip(ctx, cx, cy, 'CROUCH', !!s?.crouch);
  cx += chip(ctx, cx, cy, s?.dodge === -1 ? 'DODGE ◄' : s?.dodge === 1 ? 'DODGE ►' : 'DODGE', !!s?.dodge);
  chip(ctx, cx, cy, s?.move === -1 ? 'MOVE ◄' : s?.move === 1 ? 'MOVE ►' : 'MOVE', !!s?.move);
  ctx.restore();
}
