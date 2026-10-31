import { FpsCounter, LatencyStats } from '../../lab/latencyStats';
import type { Calibration } from '../../motion/calibration';
import { loadCalibration, saveCalibration } from '../../motion/calibrationStore';
import { closeCamera, openCamera } from '../../motion/camera';
import { type EngineOutput, MotionEngine } from '../../motion/motionEngine';
import { type PoseModel, PoseTracker } from '../../motion/poseTracker';
import type { PoseFrame } from '../../shared/types';

const MODEL_KEY = 'bf.model';

export type OutputListener = (out: EngineOutput, frame: PoseFrame | null) => void;

type TrackerLike = Pick<PoseTracker, 'start' | 'stop' | 'close'>;

/** Camera and tracker factories, injectable for tests. */
export type SessionDeps = {
  openCamera: () => Promise<HTMLVideoElement>;
  closeCamera: (video: HTMLVideoElement | null) => void;
  createTracker: (model: PoseModel) => Promise<TrackerLike>;
};

const DEFAULT_DEPS: SessionDeps = {
  openCamera: () => openCamera(),
  closeCamera,
  createTracker: (model) => PoseTracker.create(model),
};

/** Camera, pose tracker, motion engine and calibration shared by the calibration and fight scenes. */
export class MotionSession {
  private static instance: MotionSession | null = null;

  static get(): MotionSession {
    MotionSession.instance ??= new MotionSession();
    return MotionSession.instance;
  }

  readonly engine = new MotionEngine();
  readonly trackingFps = new FpsCounter();
  readonly latency = new LatencyStats();
  video: HTMLVideoElement | null = null;
  lastFrame: PoseFrame | null = null;
  lastOut: EngineOutput | null = null;
  /** performance.now() of the last engine output (to detect a camera that stopped delivering frames) */
  lastOutAt: number | null = null;
  calibration: Calibration | null = loadCalibration();
  private tracker: TrackerLike | null = null;
  private active = false;
  private wanted = false;
  private starting: Promise<void> | null = null;
  private listeners = new Set<OutputListener>();

  constructor(private readonly deps: SessionDeps = DEFAULT_DEPS) {
    this.engine.setCalibration(this.calibration);
  }

  get running(): boolean {
    return this.active;
  }

  /** Opens the camera and starts pose tracking (the model is loaded once). Throws CameraError when access fails. */
  start(): Promise<void> {
    this.wanted = true;
    if (this.active) return Promise.resolve();
    this.starting ??= (async () => {
      try {
        this.video ??= await this.deps.openCamera();
        if (!this.tracker) {
          const model = (localStorage.getItem(MODEL_KEY) as PoseModel | null) ?? 'full';
          this.tracker = await this.deps.createTracker(model);
        }
        if (!this.wanted) {
          this.releaseCamera();
          return;
        }
        this.tracker.start(this.video, this.onPose);
        this.active = true;
      } catch (e) {
        this.releaseCamera();
        throw e;
      } finally {
        this.starting = null;
      }
    })();
    return this.starting;
  }

  /** Stops inference and releases the camera (the loaded model is kept for the next start). */
  pause(): void {
    this.wanted = false;
    this.tracker?.stop();
    this.active = false;
    this.releaseCamera();
  }

  private releaseCamera(): void {
    this.deps.closeCamera(this.video);
    this.video = null;
    this.lastOut = null;
    this.lastOutAt = null;
  }

  private readonly onPose = (frame: PoseFrame | null): void => {
    const now = performance.now();
    this.lastOutAt = now;
    this.trackingFps.tick(now);
    const out = this.engine.feed(frame, frame ? Math.max(now, frame.t) : now);
    if (out.latencyMs !== null) this.latency.add(out.latencyMs);
    this.lastFrame = frame;
    this.lastOut = out;
    for (const l of this.listeners) l(out, frame);
  };

  onOutput(fn: OutputListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setCalibration(cal: Calibration): void {
    this.calibration = cal;
    saveCalibration(cal);
    this.engine.setCalibration(cal);
  }
}
