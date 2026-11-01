import Phaser from 'phaser';
import type { Difficulty } from '../ai/difficulty';
import { type Launch, advance, routeLaunch } from '../launch';
import { Sfx } from '../render/sfx';
import { loadSettings } from '../settings';
import { FONT, type MenuItem, MenuList } from '../ui/menuList';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy: dễ, AI nghỉ nhiều', normal: 'Normal: biết thủ và phạt đòn', hard: 'Hard: phản xạ nhanh, combo 3 đòn' };

/** Title menu (spec phase5 2): Quick Fight, Training, Settings, Help. */
export class MenuScene extends Phaser.Scene {
  private menu!: MenuList;
  private hint!: Phaser.GameObjects.Text;
  private sub: 'main' | 'fight' | 'training' = 'main';

  constructor() {
    super('menu');
  }

  create(): void {
    const sfx = Sfx.get();
    this.add.text(640, 120, 'BODY FIGHTER', { fontFamily: FONT, fontSize: '84px', fontStyle: '900', color: '#f8fafc', stroke: '#0e7490', strokeThickness: 10 }).setOrigin(0.5);
    this.add.text(640, 195, 'Đấm, đá, né bằng chính cơ thể bạn trước webcam', { fontFamily: FONT, fontSize: '22px', color: '#94a3b8' }).setOrigin(0.5);
    this.hint = this.add.text(640, 660, '', { fontFamily: FONT, fontSize: '17px', color: '#64748b' }).setOrigin(0.5);
    this.menu = new MenuList(this, 440, 290, {
      onMove: () => sfx.ui(),
      onBack: () => this.sub !== 'main' && this.show('main'),
    });
    // the first key or click also unlocks audio
    const unlock = () => sfx.unlock();
    window.addEventListener('keydown', unlock);
    this.input.on('pointerdown', unlock);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', unlock));
    this.show('main');
  }

  private show(sub: MenuScene['sub']): void {
    this.sub = sub;
    const back: MenuItem = { label: () => '← Quay lại', onSelect: () => this.show('main') };
    const items: Record<MenuScene['sub'], MenuItem[]> = {
      main: [
        { label: () => 'Quick Fight', onSelect: () => this.show('fight') },
        { label: () => 'Training', onSelect: () => this.show('training') },
        { label: () => 'Cài đặt', onSelect: () => this.scene.start('settings') },
        { label: () => 'Hướng dẫn & an toàn', onSelect: () => this.scene.start('help') },
      ],
      fight: [
        ...(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => ({ label: () => DIFFICULTY_LABEL[d], onSelect: () => this.go({ mode: 'fight', opponent: d }) })),
        back,
      ],
      training: [
        { label: () => 'Drill: làm theo động tác được gọi', onSelect: () => this.go({ mode: 'drill' }) },
        { label: () => 'Bao cát: thử combo, không đánh trả', onSelect: () => this.go({ mode: 'dummy' }) },
        back,
      ],
    };
    this.menu.setItems(items[sub], sub === 'fight' ? 1 : 0);
    const control = loadSettings().control === 'body' ? 'cơ thể (webcam)' : 'bàn phím';
    this.hint.setText(`↑/↓ chọn · Enter vào · Esc quay lại · Đang điều khiển bằng ${control} (đổi trong Cài đặt)`);
  }

  private go(launch: Launch): void {
    Sfx.get().ui();
    advance(this, { launch, rest: routeLaunch(launch, loadSettings()) });
  }
}
