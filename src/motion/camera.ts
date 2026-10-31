export class CameraError extends Error {
  override name = 'CameraError';
  constructor(readonly kind: 'denied' | 'not_found' | 'other', message: string) {
    super(message);
  }
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

/** Opens a webcam (ideal 1280×720 @ 30 fps) into a playing, muted video element. */
export async function openCamera(deviceId?: string): Promise<HTMLVideoElement> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('other', 'Trình duyệt không hỗ trợ camera.');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new CameraError('denied', 'Bạn đã chặn quyền camera. Hãy bấm biểu tượng 🔒 trên thanh địa chỉ và cho phép Camera, rồi tải lại trang.');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new CameraError('not_found', 'Không tìm thấy camera. Hãy cắm webcam rồi thử lại.');
    }
    throw new CameraError('other', `Không mở được camera: ${e instanceof Error ? e.message : String(e)}`);
  }
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  return video;
}

export function closeCamera(video: HTMLVideoElement | null): void {
  const stream = video?.srcObject;
  if (stream instanceof MediaStream) for (const t of stream.getTracks()) t.stop();
}
