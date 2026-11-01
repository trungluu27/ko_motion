/** A person mask sampled down to an alpha channel (spec webcam-background 2). */
export type Alpha = { alpha: Uint8ClampedArray; w: number; h: number };

/** Samples every step-th pixel of a 0..1 confidence mask into 0..255 alpha. */
export function maskToAlpha(data: Float32Array, w: number, h: number, step: number): Alpha {
  const aw = Math.ceil(w / step);
  const ah = Math.ceil(h / step);
  const alpha = new Uint8ClampedArray(aw * ah);
  for (let y = 0; y < ah; y++) {
    const row = y * step * w;
    for (let x = 0; x < aw; x++) alpha[y * aw + x] = Math.round(data[row + x * step] * 255);
  }
  return { alpha, w: aw, h: ah };
}

/** The player cut out of the video frame the mask was computed on, so mask and picture line up. */
export class PersonMatte {
  private alphaCanvas: HTMLCanvasElement | null = null;
  private person: HTMLCanvasElement | null = null;
  private ready = false;

  /** The cut-out (video size, transparent around the player), or null before the first mask. */
  get canvas(): HTMLCanvasElement | null {
    return this.ready ? this.person : null;
  }

  update(video: HTMLVideoElement, a: Alpha): void {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    this.alphaCanvas ??= document.createElement('canvas');
    this.person ??= document.createElement('canvas');
    const ac = this.alphaCanvas;
    if (ac.width !== a.w || ac.height !== a.h) {
      ac.width = a.w;
      ac.height = a.h;
    }
    const actx = ac.getContext('2d');
    const img = actx?.createImageData(a.w, a.h);
    if (!actx || !img) return;
    for (let i = 0; i < a.alpha.length; i++) img.data[i * 4 + 3] = a.alpha[i];
    actx.putImageData(img, 0, 0);

    const pc = this.person;
    if (pc.width !== vw || pc.height !== vh) {
      pc.width = vw;
      pc.height = vh;
    }
    const ctx = pc.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(video, 0, 0, vw, vh);
    // the small mask scaled up with smoothing gives soft edges
    ctx.globalCompositeOperation = 'destination-in';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(ac, 0, 0, vw, vh);
    ctx.globalCompositeOperation = 'source-over';
    this.ready = true;
  }

  clear(): void {
    this.ready = false;
  }
}
