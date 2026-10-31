const MIME_CANDIDATES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function pickMimeType(isSupported: (t: string) => boolean): string | null {
  return MIME_CANDIDATES.find((t) => isSupported(t)) ?? null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local timestamp stamp `YYYYMMDD-HHmmss`. */
export function timestamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function recordingFilename(d: Date): string {
  return `bodyfighter-${timestamp(d)}.webm`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Records a canvas (plus optional audio) to a WebM blob. */
export class VideoRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  static isAvailable(): boolean {
    return typeof MediaRecorder !== 'undefined' && pickMimeType((t) => MediaRecorder.isTypeSupported(t)) !== null;
  }

  get recording(): boolean {
    return this.recorder !== null;
  }

  elapsedMs(now: number): number {
    return this.recorder ? now - this.startedAt : 0;
  }

  start(canvas: HTMLCanvasElement, audio?: MediaStream): void {
    if (this.recorder) return;
    const mimeType = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
    if (!mimeType) throw new Error('Trình duyệt không hỗ trợ quay video WebM.');
    const stream = canvas.captureStream(30);
    for (const track of audio?.getAudioTracks() ?? []) stream.addTrack(track);
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(1000);
    this.startedAt = performance.now();
  }

  stop(): Promise<Blob> {
    const rec = this.recorder;
    if (!rec) return Promise.reject(new Error('Chưa ghi video.'));
    this.recorder = null;
    return new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(this.chunks, { type: rec.mimeType }));
      rec.stop();
      for (const t of rec.stream.getVideoTracks()) t.stop();
    });
  }
}
