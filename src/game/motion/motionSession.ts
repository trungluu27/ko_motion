import { FpsCounter, LatencyStats } from '../../lab/latencyStats';
import type { Calibration } from '../../motion/calibration';
import { loadCalibration, saveCalibration } from '../../motion/calibrationStore';
import { CameraError, closeCamera, openCamera } from '../../motion/camera';
import { type EngineOutput, MotionEngine } from '../../motion/motionEngine';
import { type PoseModel, PoseTracker } from '../../motion/poseTracker';
import type { PoseFrame } from '../../shared/types';
import { type WebcamBg, loadSettings } from '../settings';
import { type Alpha, PersonMatte } from '../../view/personMatte';

export type OutputListener = (out: EngineOutput, frame: PoseFrame | null) => void;

type TrackerLike = Pick<PoseTracker, 'start' | 'stop' | 'close'> & Partial<Pick<PoseTracker, 'setMasks'>>;

/** Camera and tracker factories, injectable for tests. */
export type SessionDeps = {
  openCamera: (deviceId?: string) => Promise<HTMLVideoElement>;
  closeCamera: (video: HTMLVideoElement | null) => void;
  createTracker: (model: PoseModel) => Promise<TrackerLike>;
};

const DEFAULT_DEPS: SessionDeps = {
  openCamera: (deviceId) => openCamera(deviceId),
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
  /** the player cut out of the latest tracked frame (only while a webcam background is chosen) */
  readonly matte = new PersonMatte();
  private background: WebcamBg = 'off';
  /** set when the chosen background could not be applied; the scene shows it once and clears it */
  backgroundError: string | null = null;
  video: HTMLVideoElement | null = null;
  lastFrame: PoseFrame | null = null;
  lastOut: EngineOutput | null = null;
  /** performance.now() of the last engine output (to detect a camera that stopped delivering frames) */
  lastOutAt: number | null = null;
  calibration: Calibration | null = loadCalibration();
  private tracker: TrackerLike | null = null;
  private trackerModel: PoseModel | null = null;
  private active = false;
  private wanted = false;
  private starting: Promise<void> | null = null;
  private listeners = new Set<OutputListener>();

  constructor(
    private readonly deps: SessionDeps = DEFAULT_DEPS,
    private readonly storage?: Storage,
  ) {
    this.engine.setCalibration(this.calibration);
  }

  get running(): boolean {
    return this.active;
  }

  /** Opens the chosen camera and starts pose tracking; the model is (re)loaded only when the setting changed. Throws CameraError when access fails. */
  start(): Promise<void> {
    this.wanted = true;
    if (this.active) return Promise.resolve();
    this.starting ??= (async () => {
      try {
        const settings = loadSettings(this.storage);
        this.video ??= await this.openChosenCamera(settings.cameraId);
        if (this.tracker && this.trackerModel !== settings.model) {
          this.tracker.close();
          this.tracker = null;
        }
        if (!this.tracker) {
          this.tracker = await this.deps.createTracker(settings.model);
          this.trackerModel = settings.model;
        }
        // a pause during the model load released the camera; a start since then wants it back
        if (this.wanted) this.video ??= await this.openChosenCamera(settings.cameraId);
        if (!this.wanted || !this.video) {
          this.releaseCamera();
          return;
        }
        // a missing mask only costs the background, never body control
        await this.applyBackground(settings.webcamBg).catch((e: unknown) => {
          this.backgroundError = `Không thay được nền webcam (${e instanceof Error ? e.message : String(e)}), dùng camera thật.`;
        });
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

  /** Chooses the webcam background; anything but 'off' needs the tracker's person mask. Rejects when masks are unavailable. */
  async setBackground(bg: WebcamBg): Promise<void> {
    await this.applyBackground(bg);
  }

  private async applyBackground(bg: WebcamBg): Promise<void> {
    this.background = bg;
    if (bg === 'off') this.matte.clear();
    try {
      await this.tracker?.setMasks?.(bg !== 'off');
    } catch (e) {
      this.background = 'off';
      this.matte.clear();
      throw e;
    }
  }

  /** The camera picked in the settings, or the default one when that camera is gone (unplugged). */
  private async openChosenCamera(cameraId: string | null): Promise<HTMLVideoElement> {
    if (!cameraId) return this.deps.openCamera();
    try {
      return await this.deps.openCamera(cameraId);
    } catch (e) {
      if (e instanceof CameraError && e.kind === 'not_found') return this.deps.openCamera();
      throw e;
    }
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

  private readonly onPose = (frame: PoseFrame | null, _inferMs = 0, mask: Alpha | null = null): void => {
    if (this.background !== 'off' && mask && frame && this.video) this.matte.update(this.video, mask);
    else this.matte.clear();
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
