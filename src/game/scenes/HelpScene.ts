import Phaser from 'phaser';
import { FONT } from '../ui/menuList';
import { BODY_LINES, CAMERA_LINES, KEYBOARD_LINES, SAFETY_LINES } from '../ui/text';

/** Controls, camera placement and safety, always reachable from the menu (spec phase5 7). */
export class HelpScene extends Phaser.Scene {
  constructor() {
    super('help');
  }

  create(): void {
    const head = { fontFamily: FONT, fontSize: '26px', fontStyle: '900', color: '#22d3ee' };
    const body = { fontFamily: FONT, fontSize: '17px', color: '#e2e8f0', lineSpacing: 6, wordWrap: { width: 560 } };
    const list = (lines: string[]) => lines.map((l) => `•  ${l}`).join('\n');
    this.add.text(640, 40, 'Hướng dẫn & an toàn', { fontFamily: FONT, fontSize: '40px', fontStyle: '900', color: '#f8fafc' }).setOrigin(0.5);
    this.add.text(50, 100, 'Bàn phím', head);
    this.add.text(50, 140, list(KEYBOARD_LINES), body);
    this.add.text(50, 380, 'Cơ thể', head);
    this.add.text(50, 420, list(BODY_LINES), body);
    this.add.text(670, 100, 'Đặt camera', head);
    this.add.text(670, 140, list(CAMERA_LINES), body);
    this.add.text(670, 380, 'An toàn', head);
    this.add.text(670, 420, list(SAFETY_LINES), body);
    this.add.text(640, 690, 'Esc hoặc Enter: về menu', { fontFamily: FONT, fontSize: '18px', color: '#64748b' }).setOrigin(0.5);

    const onKey = (e: KeyboardEvent) => {
      // a held Enter must not also confirm the next screen
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter') this.scene.start('menu');
    };
    window.addEventListener('keydown', onKey);
    this.input.on('pointerdown', () => this.scene.start('menu'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
  }
}
