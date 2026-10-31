import type Phaser from 'phaser';
import type { Region } from '../layout';
import type { HudModel } from './hudModel';

const MARGIN = 24;

/** Health, stamina and special bars, the round clock, and the result banner. */
export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private clock: Phaser.GameObjects.Text;
  private banner: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const font = 'system-ui, sans-serif';
    this.g = scene.add.graphics().setDepth(40);
    this.clock = scene.add
      .text(0, 44, '99', { fontFamily: font, fontSize: '44px', fontStyle: '900', color: '#f8fafc' })
      .setOrigin(0.5)
      .setDepth(41);
    this.banner = scene.add
      .text(0, 330, '', { fontFamily: font, fontSize: '88px', fontStyle: '900', color: '#f8fafc', stroke: '#020617', strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(50);
    this.hint = scene.add
      .text(0, 410, 'Nhấn R để đấu lại', { fontFamily: font, fontSize: '26px', color: '#cbd5e1' })
      .setOrigin(0.5)
      .setDepth(50);
  }

  private bar(x: number, y: number, w: number, h: number, frac: number, color: number, fromRight: boolean): void {
    const f = Math.max(0, Math.min(1, frac));
    this.g.fillStyle(0x0f172a, 0.9);
    this.g.fillRect(x, y, w, h);
    this.g.fillStyle(color, 1);
    this.g.fillRect(fromRight ? x + w * (1 - f) : x, y, w * f, h);
    this.g.lineStyle(2, 0x334155, 1);
    this.g.strokeRect(x, y, w, h);
  }

  /** Draws the HUD across the top of the arena region. */
  draw(h: HudModel, area: Region): void {
    this.g.clear();
    const cx = area.x + area.w / 2;
    const barW = area.w * 0.4;
    const small = barW * 0.6;
    const left = area.x + MARGIN;
    const right = area.x + area.w - MARGIN;
    const hpColor = (v: number) => (v > 0.5 ? 0x22c55e : v > 0.25 ? 0xfacc15 : 0xef4444);
    for (const i of [0, 1] as const) {
      const r = i === 1;
      this.bar(r ? right - barW : left, 22, barW, 26, h.hp[i], hpColor(h.hp[i]), r);
      this.bar(r ? right - small : left, 54, small, 10, h.stamina[i], 0x4ade80, r);
      this.bar(r ? right - small : left, 68, small, 10, h.special[i], h.special[i] >= 1 ? 0xe879f9 : 0x7c3aed, r);
    }
    for (const t of [this.clock, this.banner, this.hint]) t.setX(cx);
    this.clock.setText(String(h.seconds));
    this.banner.setText(h.result ?? '');
    this.banner.setColor(h.result === 'YOU WIN' ? '#4ade80' : h.result === 'YOU LOSE' ? '#f87171' : '#f8fafc');
    this.hint.setVisible(h.result !== null);
  }
}
