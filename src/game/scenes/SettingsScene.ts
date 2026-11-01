import Phaser from 'phaser';
import { listCameras } from '../../motion/camera';
import { VIEW_MODES } from '../layout';
import { Sfx } from '../render/sfx';
import { type Settings, WEBCAM_BGS, loadSettings, saveSettings } from '../settings';
import { BG_LABEL } from '../ui/text';
import { FONT, MenuList } from '../ui/menuList';

const VIEW_LABEL = { split: 'chia đôi', pip: 'webcam góc', game: 'chỉ game' } as const;

const cycle = <T,>(xs: readonly T[], v: T, step: 1 | -1): T => xs[(xs.indexOf(v) + step + xs.length) % xs.length];

/** Persistent settings, each row changed with ←/→ or a click (spec phase5 3). */
export class SettingsScene extends Phaser.Scene {
  private s!: Settings;
  private webcams: { id: string | null; label: string }[] = [{ id: null, label: 'Mặc định' }];
  private menu!: MenuList;

  constructor() {
    super('settings');
  }

  create(): void {
    this.s = loadSettings();
    const sfx = Sfx.get();
    this.add.text(640, 70, 'Cài đặt', { fontFamily: FONT, fontSize: '48px', fontStyle: '900', color: '#f8fafc' }).setOrigin(0.5);
    this.add.text(640, 660, '↑/↓ chọn · ←/→ đổi · Esc về menu · Model mới áp dụng ở lần bật camera kế tiếp', { fontFamily: FONT, fontSize: '17px', color: '#64748b' }).setOrigin(0.5);
    this.menu = new MenuList(this, 300, 160, { onMove: () => sfx.ui(), onBack: () => this.scene.start('menu'), lineHeight: 62, fontSize: 28 });

    const set = (patch: Partial<Settings>) => {
      this.s = { ...this.s, ...patch };
      saveSettings(this.s);
      sfx.setVolume(this.s.sfxVolume);
      sfx.ui();
    };
    const row = (label: () => string, step: (d: 1 | -1) => void) => ({ label, onLeft: () => step(-1), onRight: () => step(1), onSelect: () => step(1) });
    const cameraLabel = () => this.webcams.find((c) => c.id === this.s.cameraId)?.label ?? 'Camera đã chọn (chưa thấy)';
    this.menu.setItems([
      row(() => `Điều khiển:  ◀ ${this.s.control === 'body' ? 'Cơ thể (webcam)' : 'Bàn phím'} ▶`, () => set({ control: this.s.control === 'body' ? 'keyboard' : 'body' })),
      row(() => `Hiển thị khi dùng cơ thể:  ◀ ${VIEW_LABEL[this.s.view]} ▶`, (d) => set({ view: cycle(VIEW_MODES, this.s.view, d) })),
      row(() => `Camera:  ◀ ${cameraLabel()} ▶`, (d) => {
        const ids = this.webcams.map((c) => c.id);
        set({ cameraId: cycle(ids, ids.includes(this.s.cameraId) ? this.s.cameraId : null, d) });
      }),
      row(() => `Nền webcam:  ◀ ${BG_LABEL[this.s.webcamBg]} ▶`, (d) => set({ webcamBg: cycle(WEBCAM_BGS, this.s.webcamBg, d) })),
      row(() => `Model nhận diện:  ◀ ${this.s.model === 'full' ? 'Full (chính xác)' : 'Lite (nhẹ, máy yếu)'} ▶`, () => set({ model: this.s.model === 'full' ? 'lite' : 'full' })),
      row(() => `Âm lượng:  ◀ ${Math.round(this.s.sfxVolume * 100)}% ▶`, (d) => set({ sfxVolume: Math.round(Math.max(0, Math.min(1, this.s.sfxVolume + d * 0.1)) * 10) / 10 })),
      row(() => `Nhạc nền:  ◀ ${this.s.music ? 'Bật' : 'Tắt'} ▶`, () => set({ music: !this.s.music })),
      { label: () => '← Về menu', onSelect: () => this.scene.start('menu') },
    ]);

    // device labels stay empty until camera permission was granted once
    listCameras()
      .then((devices) => {
        this.webcams = [{ id: null, label: 'Mặc định' }, ...devices.map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }))];
        if (this.scene.isActive()) this.menu.refresh();
      })
      .catch(() => undefined);
  }
}
