import { FpsCounter, LatencyStats } from '../../lab/latencyStats';
import type { Calibration } from '../../motion/calibration';
import { loadCalibration, saveCalibration } from '../../motion/calibrationStore';
import { closeCamera, openCamera } from '../../motion/camera';
import { type EngineOutput, MotionEngine } from '../../motion/motionEngine';
import { type PoseModel, PoseTracker } from '../../motion/poseTracker';
import type { PoseFrame } from '../../shared/types';

const MODEL_KEY = 'bf.model';

export type OutputListener = (out: EngineOutput, frame: PoseFrame | null) => void;

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
  calibration: Calibration | null = loadCalibration();
  private tracker: PoseTracker | null = null;
  private starting: Promise<void> | null = null;
  private listeners = new Set<OutputListener>();

  private constructor() {
    this.engine.setCalibration(this.calibration);
  }

  get running(): boolean {
    return this.tracker !== null && this.video !== null;
  }

  /** Opens the camera and pose model once; later calls reuse them. Throws CameraError when access fails. */
  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    this.starting ??= (async () => {
      try {
        this.video ??= await openCamera();
        const model = (localStorage.getItem(MODEL_KEY) as PoseModel | null) ?? 'full';
        this.tracker = await PoseTracker.create(model);
        this.tracker.start(this.video, this.onPose);
      } catch (e) {
        closeCamera(this.video);
        this.video = null;
        this.tracker = null;
        throw e;
      } finally {
        this.starting = null;
      }
    })();
    return this.starting;
  }

  private readonly onPose = (frame: PoseFrame | null): void => {
    const now = performance.now();
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
