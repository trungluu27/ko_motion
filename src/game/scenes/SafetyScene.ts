import Phaser from 'phaser';
import { type LaunchData, advance } from '../launch';
import { loadSettings, saveSettings } from '../settings';
import { FONT } from '../ui/menuList';
import { SAFETY_LINES } from '../ui/text';

/** One-time safety notice before the first match or drill (spec phase5 7). */
export class SafetyScene extends Phaser.Scene {
  private data_!: LaunchData;

  constructor() {
    super('safety');
  }

  init(data: LaunchData): void {
    this.data_ = data;
  }

  create(): void {
    this.add.text(640, 90, 'Trước khi bắt đầu', { fontFamily: FONT, fontSize: '52px', fontStyle: '900', color: '#facc15' }).setOrigin(0.5);
    this.add.text(640, 150, 'Game này bắt bạn vận động thật. Vài điều để chơi an toàn:', { fontFamily: FONT, fontSize: '22px', color: '#cbd5e1' }).setOrigin(0.5);
    this.add.text(200, 210, SAFETY_LINES.map((l) => `•  ${l}`).join('\n\n'), { fontFamily: FONT, fontSize: '24px', color: '#f1f5f9', wordWrap: { width: 900 } });
    this.add.text(640, 640, 'Enter: Tôi đã hiểu    ·    Esc: về menu', { fontFamily: FONT, fontSize: '24px', fontStyle: '800', color: '#22d3ee' }).setOrigin(0.5);

    const onKey = (e: KeyboardEvent) => {
      // a held Enter must not also confirm the next screen
      if (e.repeat) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        saveSettings({ ...loadSettings(), safetyAck: true });
        advance(this, this.data_);
      } else if (e.code === 'Escape') {
        this.scene.start('menu');
      }
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
  }
}
