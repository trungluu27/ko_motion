import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark, PoseFrame } from '../shared/types';

type RawLandmark = { x: number; y: number; z: number; visibility?: number };

/** Converts a MediaPipe result into a PoseFrame for the first detected person (copying the data). */
export function toPoseFrame(
  result: { landmarks: RawLandmark[][]; worldLandmarks: RawLandmark[][] },
  frameId: number,
  t: number,
  aspect = 1,
): PoseFrame | null {
  const image = result.landmarks[0];
  const world = result.worldLandmarks[0];
  if (!image || !world) return null;
  const copy = (l: RawLandmark): Landmark => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility ?? 0 });
  return { frameId, t, aspect, image: image.map(copy), world: world.map(copy) };
}

export type PoseModel = 'full' | 'lite';

/** Runs MediaPipe PoseLandmarker on each new video frame. */
export class PoseTracker {
  private handle: number | null = null;
  private frameId = 0;
  private lastTs = 0;
  private busy = false;
  private video: HTMLVideoElement | null = null;

  private constructor(
    private readonly landmarker: PoseLandmarker,
    readonly delegate: 'GPU' | 'CPU',
    readonly model: PoseModel,
  ) {}

  static async create(model: PoseModel): Promise<PoseTracker> {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const base = import.meta.env.BASE_URL;
    const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
    const make = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `${base}models/pose_landmarker_${model}.task`, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    try {
      return new PoseTracker(await make('GPU'), 'GPU', model);
    } catch (e) {
      console.warn('[PoseTracker] GPU delegate failed, falling back to CPU', e);
      return new PoseTracker(await make('CPU'), 'CPU', model);
    }
  }

  start(video: HTMLVideoElement, onFrame: (f: PoseFrame | null, inferMs: number) => void): void {
    this.stop();
    this.video = video;
    const tick = (now: number, meta: VideoFrameCallbackMetadata) => {
      this.handle = video.requestVideoFrameCallback(tick);
      if (this.busy) return;
      this.busy = true;
      try {
        const t = meta.captureTime ?? meta.expectedDisplayTime ?? now;
        const ts = Math.max(this.lastTs + 1, Math.round(t));
        this.lastTs = ts;
        const start = performance.now();
        const result = this.landmarker.detectForVideo(video, ts);
        const aspect = video.videoHeight ? video.videoWidth / video.videoHeight : 1;
        onFrame(toPoseFrame(result, this.frameId++, t, aspect), performance.now() - start);
      } finally {
        this.busy = false;
      }
    };
    this.handle = video.requestVideoFrameCallback(tick);
  }

  stop(): void {
    if (this.handle !== null && this.video) this.video.cancelVideoFrameCallback(this.handle);
    this.handle = null;
  }

  close(): void {
    this.stop();
    this.landmarker.close();
  }
}
