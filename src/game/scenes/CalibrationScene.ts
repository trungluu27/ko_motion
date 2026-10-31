import Phaser from 'phaser';
import { Calibrator, type CalibrationProgress } from '../../motion/calibration';
import { CameraError } from '../../motion/camera';
import { DEFAULT_CONFIG } from '../../motion/config';
import type { Region } from '../layout';
import { MotionSession } from '../motion/motionSession';
import { WebcamLayer } from '../render/webcamLayer';

const WEBCAM: Region = { x: 0, y: 0, w: 640, h: 720 };
const STATUS_TEXT: Record<CalibrationProgress['status'], string> = {
  no_person: 'Đang tìm người chơi…',
  partial: 'Chưa thấy toàn thân: lùi ra xa camera',
  out_of_frame: 'Ra ngoài khung hình: đứng vào giữa',
  ok: 'Đang hiệu chỉnh…',
  calibrating: 'Đang hiệu chỉnh: đứng yên thủ thế',
  ready: 'Sẵn sàng!',
};

/** Pre-fight calibration with the live webcam; the fight starts only with a valid calibration (spec 5.4, 7). */
export class CalibrationScene extends Phaser.Scene {
  private session!: MotionSession;
  private webcam!: WebcamLayer;
  private calibrator: Calibrator | null = null;
  private progress: CalibrationProgress | null = null;
  private status!: Phaser.GameObjects.Text;
  private keysHint!: Phaser.GameObjects.Text;
  private error: string | null = null;

  constructor() {
    super('calibration');
  }

  create(): void {
    this.session = MotionSession.get();
    this.calibrator = null;
    this.progress = null;
    this.error = null;
    this.webcam = new WebcamLayer(this);
    const font = 'system-ui, sans-serif';
    const x = WEBCAM.w + 40;
    this.add.text(x, 60, 'Calibration', { fontFamily: font, fontSize: '40px', fontStyle: '900', color: '#22d3ee' });
    this.add.text(
      x,
      130,
      [
        '1. Đứng nghiêng khoảng 45° (vai trái hướng về camera)',
        '2. Cách camera 2,5–3 m, thấy cả đầu lẫn bàn chân',
        '3. Ánh sáng chiếu từ phía trước',
        '4. Đứng thủ thế yên khoảng 2 giây',
      ].join('\n\n'),
      { fontFamily: font, fontSize: '20px', color: '#e2e8f0', wordWrap: { width: 560 } },
    );
    this.status = this.add.text(x, 420, '', { fontFamily: font, fontSize: '30px', fontStyle: '900', color: '#facc15', wordWrap: { width: 560 } });
    this.keysHint = this.add.text(x, 600, '', { fontFamily: font, fontSize: '18px', color: '#94a3b8', wordWrap: { width: 560 } });

    if (!this.session.calibration) this.calibrator = new Calibrator(DEFAULT_CONFIG);
    const unsubscribe = this.session.onOutput((_out, frame) => {
      if (!this.calibrator) return;
      this.progress = this.calibrator.push(frame);
      if (this.progress.calibration) {
        this.session.setCalibration(this.progress.calibration);
        this.calibrator = null;
      }
    });

    this.session.start().catch((e: unknown) => {
      this.error = e instanceof CameraError ? e.message : `Không mở được camera hoặc model: ${String(e)}`;
      this.time.delayedCall(4000, () => this.scene.start('fight', { control: 'keyboard', view: 'game', notice: this.error }));
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && this.session.calibration && !this.calibrator && this.session.running) {
        this.scene.start('fight', { control: 'body', view: 'split' });
      } else if (e.code === 'KeyK' && this.session.running) {
        this.calibrator = new Calibrator(DEFAULT_CONFIG);
        this.progress = null;
      } else if (e.code === 'Escape') {
        this.session.pause();
        this.scene.start('fight', { control: 'keyboard', view: 'game' });
      }
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      unsubscribe();
    });
  }

  private statusText(): string {
    if (this.error) return `📷 ${this.error}\nĐang quay về điều khiển bàn phím…`;
    if (!this.session.running) return 'Đang mở camera và tải model…';
    if (this.calibrator) {
      const p = this.progress;
      if (!p) return STATUS_TEXT.no_person;
      return p.status === 'calibrating' ? `${STATUS_TEXT.calibrating} ${Math.round(p.progress * 100)}%` : STATUS_TEXT[p.status];
    }
    return STATUS_TEXT.ready;
  }

  update(): void {
    const ready = this.session.running && !!this.session.calibration && !this.calibrator;
    this.status.setText(this.statusText());
    this.status.setColor(ready ? '#4ade80' : this.error ? '#f87171' : '#facc15');
    this.keysHint.setText(
      ready ? 'Enter: vào trận · K: calibrate lại · Esc: chơi bằng bàn phím' : 'K: calibrate lại · Esc: chơi bằng bàn phím',
    );
    this.webcam.draw(WEBCAM, this.session, null);
  }
}
