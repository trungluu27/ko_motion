import Phaser from 'phaser';
import { menuNav } from '../menuNav';

export type MenuItem = {
  /** re-read on every redraw, so values shown in the label stay current */
  label: () => string;
  onSelect?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
};

export const FONT = 'system-ui, sans-serif';
const COLOR = '#cbd5e1';
const ACTIVE = '#22d3ee';

/** A vertical text menu driven by the keyboard (menuNav) and the mouse (hover + click). */
export class MenuList {
  private texts: Phaser.GameObjects.Text[] = [];
  private items: MenuItem[] = [];
  private index = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly opts: { onBack?: () => void; onMove?: () => void; lineHeight?: number; fontSize?: number } = {},
  ) {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
      const { index, action } = menuNav(this.index, this.items.length, e.code);
      if (index !== this.index) this.opts.onMove?.();
      this.index = index;
      const item = this.items[this.index];
      if (action === 'select') item?.onSelect?.();
      else if (action === 'left') item?.onLeft?.();
      else if (action === 'right') item?.onRight?.();
      else if (action === 'back') this.opts.onBack?.();
      if (action !== 'none') e.preventDefault();
      this.refresh();
    };
    window.addEventListener('keydown', onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
  }

  setItems(items: MenuItem[], index = 0): void {
    this.texts.forEach((t) => t.destroy());
    this.items = items;
    this.index = index;
    const lh = this.opts.lineHeight ?? 58;
    this.texts = items.map((item, i) =>
      this.scene.add
        .text(this.x, this.y + i * lh, '', { fontFamily: FONT, fontSize: `${this.opts.fontSize ?? 32}px`, fontStyle: '800', color: COLOR })
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.index !== i) this.opts.onMove?.();
          this.index = i;
          this.refresh();
        })
        .on('pointerdown', (p: Phaser.Input.Pointer) => {
          // clicking the left third of a value row steps it back, the rest steps it forward / selects
          const t = this.texts[i];
          if (item.onLeft && p.x < t.x + t.width / 3) item.onLeft();
          else (item.onSelect ?? item.onRight)?.();
          this.refresh();
        }),
    );
    this.refresh();
  }

  refresh(): void {
    this.texts.forEach((t, i) => {
      const on = i === this.index;
      t.setText(`${on ? '▶ ' : '   '}${this.items[i].label()}`).setColor(on ? ACTIVE : COLOR);
    });
  }
}
