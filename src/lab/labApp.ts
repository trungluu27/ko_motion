import type { PoseFrame } from '../shared/types';
import { type Calibration, Calibrator, type CalibrationProgress } from '../motion/calibration';
import { CameraError, closeCamera, listCameras, openCamera } from '../motion/camera';
import { DEFAULT_CONFIG } from '../motion/config';
import { type EngineOutput, MotionEngine } from '../motion/motionEngine';
import { type PoseModel, PoseTracker } from '../motion/poseTracker';
import { ActionLabelTimer, drawWebcamPanel } from '../view/webcamPanel';
import { type DebugData, type FeatureSample, type LogEntry, drawDebugPanel, pruneHistory, sampleOf } from './debugPanel';
import { FpsCounter, LatencyStats } from './latencyStats';

export const LAB_W = 1280;
export const LAB_H = 720;
export const WEBCAM_W = 480;

const CAL_KEY = 'bf.calibration';
const MODEL_KEY = 'bf.model';

export type FrameListener = (frame: PoseFrame | null, out: EngineOutput) => void;

const CAL_TEXT: Record<CalibrationProgress['status'], string> = {
  no_person: 'Đang tìm người chơi…',
  partial: 'Chưa thấy toàn thân — lùi ra xa camera',
  out_of_frame: 'Ra ngoài khung hình — đứng vào giữa',
  ok: 'Đang hiệu chỉnh…',
  calibrating: 'Đang hiệu chỉnh — đứng yên thủ thế',
  ready: 'Sẵn sàng!',
};

/** Motion Lab: live camera → pose → engine, with calibration and a debug panel, drawn on one 1280×720 canvas. */
export class LabApp {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly toolbar: HTMLDivElement;
  private readonly message: HTMLDivElement;
  private readonly cameraSelect: HTMLSelectElement;
  private readonly modelSelect: HTMLSelectElement;

  readonly engine = new MotionEngine();
  video: HTMLVideoElement | null = null;
  private tracker: PoseTracker | null = null;
  private calibrator: Calibrator | null = null;
  private calibration: Calibration | null = null;
  private calStatus: CalibrationProgress | null = null;
  private readyUntil = 0;

  lastFrame: PoseFrame | null = null;
  lastOut: EngineOutput | null = null;
  private readonly labels = new ActionLabelTimer();
  private readonly latency = new LatencyStats();
  private readonly fps = new FpsCounter();
  private inferMs: number | null = null;
  private history: FeatureSample[] = [];
  private log: LogEntry[] = [];
  readonly frameListeners: FrameListener[] = [];
  /** extra overlay text for the webcam panel (guided capture) */
  prompt: (() => string | undefined) | null = null;
  /** extra lines under the event log (replay evaluation) */
  footer: string[] = [];
  /** when set, the panel draws this source size instead of the live video (replay) */
  replaySize: { w: number; h: number } | null = null;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <header class="bar">
        <strong>BODY FIGHTER · Motion Lab</strong>
        <label>Camera <select data-id="camera"></select></label>
        <label>Model <select data-id="model"><option value="full">full</option><option value="lite">lite</option></select></label>
        <button data-id="calibrate">🎯 Calibrate</button>
        <span class="tools" data-id="tools"></span>
      </header>
      <div class="message" data-id="message" hidden></div>
      <canvas width="${LAB_W}" height="${LAB_H}"></canvas>`;
    const q = <T extends Element>(id: string) => root.querySelector<T>(`[data-id="${id}"]`)!;
    this.canvas = root.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.toolbar = q<HTMLDivElement>('tools');
    this.message = q<HTMLDivElement>('message');
    this.cameraSelect = q<HTMLSelectElement>('camera');
    this.modelSelect = q<HTMLSelectElement>('model');
    this.modelSelect.value = (localStorage.getItem(MODEL_KEY) as PoseModel | null) ?? 'full';

    q<HTMLButtonElement>('calibrate').onclick = () => this.startCalibration();
    this.cameraSelect.onchange = () => void this.startCamera(this.cameraSelect.value);
    this.modelSelect.onchange = () => {
      localStorage.setItem(MODEL_KEY, this.modelSelect.value);
      void this.loadTracker();
    };

    this.loadCalibration();
    requestAnimationFrame(this.render);
  }

  async init(): Promise<void> {
    await this.startCamera();
    await this.loadTracker();
  }

  showMessage(html: string | null, retry?: () => void): void {
    this.message.hidden = html === null;
    this.message.innerHTML = html ?? '';
    if (retry) {
      const b = document.createElement('button');
      b.textContent = 'Thử lại';
      b.onclick = retry;
      this.message.append(' ', b);
    }
  }

  private async startCamera(deviceId?: string): Promise<void> {
    this.tracker?.stop();
    closeCamera(this.video);
    this.video = null;
    try {
      this.video = await openCamera(deviceId);
      this.showMessage(null);
      const cams = await listCameras();
      const current = (this.video.srcObject as MediaStream).getVideoTracks()[0]?.getSettings().deviceId;
      this.cameraSelect.innerHTML = cams
        .map((c, i) => `<option value="${c.deviceId}">${c.label || `Camera ${i + 1}`}</option>`)
        .join('');
      if (current) this.cameraSelect.value = current;
      if (this.tracker) this.tracker.start(this.video, this.onPose);
    } catch (e) {
      const msg = e instanceof CameraError ? e.message : `Lỗi camera: ${String(e)}`;
      this.showMessage(`📷 ${msg} Bạn vẫn có thể phát lại phiên đã ghi.`, () => void this.init());
    }
  }

  private async loadTracker(): Promise<void> {
    this.tracker?.close();
    this.tracker = null;
    try {
      this.tracker = await PoseTracker.create(this.modelSelect.value as PoseModel);
      if (this.video) this.tracker.start(this.video, this.onPose);
    } catch (e) {
      this.showMessage(`Không tải được model nhận diện tư thế: ${String(e)}`, () => void this.loadTracker());
    }
  }

  get modelName(): PoseModel {
    return this.modelSelect.value as PoseModel;
  }

  get currentCalibration(): Calibration | null {
    return this.calibration;
  }

  /** Pauses live tracking (used while replaying a session). */
  setLivePaused(paused: boolean): void {
    if (paused) this.tracker?.stop();
    else if (this.tracker && this.video) this.tracker.start(this.video, this.onPose);
  }

  private loadCalibration(): void {
    const raw = localStorage.getItem(CAL_KEY);
    if (!raw) return;
    try {
      this.setCalibration(JSON.parse(raw) as Calibration);
    } catch {
      localStorage.removeItem(CAL_KEY);
    }
  }

  setCalibration(cal: Calibration | null): void {
    this.calibration = cal;
    this.engine.setCalibration(cal);
  }

  startCalibration(): void {
    this.calibrator = new Calibrator(DEFAULT_CONFIG);
    this.calStatus = { status: 'no_person', progress: 0 };
  }

  /** Feeds one pose frame through calibration and the engine; also used by session replay. */
  readonly onPose = (frame: PoseFrame | null, inferMs: number): void => {
    const now = performance.now();
    this.inferMs = inferMs;
    this.fps.tick(now);
    if (this.calibrator) {
      this.calStatus = this.calibrator.push(frame);
      if (this.calStatus.calibration) {
        this.setCalibration(this.calStatus.calibration);
        localStorage.setItem(CAL_KEY, JSON.stringify(this.calStatus.calibration));
        this.calibrator = null;
        this.readyUntil = now + 1500;
      }
    }
    const out = this.engine.feed(frame, frame ? Math.max(now, frame.t) : now);
    this.process(frame, out, now);
  };

  /** Records an engine output into the UI state (label, log, latency, history). */
  process(frame: PoseFrame | null, out: EngineOutput, now: number): void {
    this.lastFrame = frame;
    this.lastOut = out;
    for (const e of out.events) {
      this.labels.push(e, now);
      this.log.push({ event: e, latencyMs: out.latencyMs });
      if (out.latencyMs !== null) this.latency.add(out.latencyMs);
    }
    if (this.log.length > 100) this.log.splice(0, this.log.length - 100);
    if (out.features) {
      this.history.push(sampleOf(out.features));
      this.history = pruneHistory(this.history, out.features.t, 6000);
    }
    for (const l of this.frameListeners) l(frame, out);
  }

  resetView(): void {
    this.history = [];
    this.log = [];
  }

  private calibrationPrompt(now: number): string | undefined {
    if (this.calibrator && this.calStatus) {
      const pct = Math.round(this.calStatus.progress * 100);
      return this.calStatus.status === 'calibrating' ? `${CAL_TEXT.calibrating} ${pct}%` : CAL_TEXT[this.calStatus.status];
    }
    if (now < this.readyUntil) return CAL_TEXT.ready;
    if (!this.calibration) return 'Bấm 🎯 Calibrate để bắt đầu';
    return undefined;
  }

  private readonly render = (): void => {
    const now = performance.now();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, LAB_W, LAB_H);
    drawWebcamPanel(
      ctx,
      { x: 0, y: 0, w: WEBCAM_W, h: LAB_H },
      this.replaySize ? null : this.video,
      this.lastFrame,
      this.lastOut,
      this.labels.current(now),
      { prompt: this.prompt?.() ?? this.calibrationPrompt(now), sourceSize: this.replaySize ?? undefined },
    );
    const data: DebugData = {
      history: this.history,
      log: this.log,
      trackingFps: this.fps.fps(),
      inferMs: this.inferMs,
      p50: this.latency.p50(),
      p95: this.latency.p95(),
      delegate: this.tracker?.delegate ?? '…',
      model: this.modelSelect.value,
      calibrated: this.calibration !== null,
      footer: this.footer,
    };
    drawDebugPanel(ctx, { x: WEBCAM_W, y: 0, w: LAB_W - WEBCAM_W, h: LAB_H }, data);
    this.afterRender?.(ctx, now);
    requestAnimationFrame(this.render);
  };

  /** hook for overlays drawn on top of the canvas (recording indicator) */
  afterRender: ((ctx: CanvasRenderingContext2D, now: number) => void) | null = null;
}
