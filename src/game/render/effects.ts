import type Phaser from 'phaser';
import type { ComboName, Match, SimEvent } from '../sim/types';
import type { ArenaView } from '../layout';
import { strikePoint } from './stickFighter';

const SPARK_KEY = 'spark';

const COMBO_TEXT: Record<ComboName, string> = {
  double_jab: 'DOUBLE JAB',
  triple_attack: 'TRIPLE ATTACK',
  counter: 'COUNTER',
  power_combo: 'POWER COMBO',
};

/** Hit sparks, screen shake and floating text driven by sim events. */
export class Effects {
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    public view: ArenaView,
  ) {
    if (!scene.textures.exists(SPARK_KEY)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture(SPARK_KEY, 8, 8);
      g.destroy();
    }
    this.sparks = scene.add.particles(0, 0, SPARK_KEY, {
      speed: { min: 120, max: 380 },
      lifespan: 320,
      scale: { start: 1.1, end: 0 },
      tint: [0xfacc15, 0xffffff, 0xf97316],
      blendMode: 'ADD',
      emitting: false,
    });
    this.sparks.setDepth(20);
  }

  popup(text: string, x: number, y: number, color: string, size = 30): void {
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${size}px`,
        fontStyle: '900',
        color,
        stroke: '#020617',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.scene.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  handle(e: SimEvent, m: Match): void {
    const atk = m.fighters[e.fighter];
    const def = m.fighters[1 - e.fighter];
    const headY = this.view.groundY - 250 * this.view.bodyScale;
    const xOf = (i: number) => this.view.toScreen(m.fighters[i].x);
    switch (e.type) {
      case 'hit': {
        const p = strikePoint(atk, this.view);
        this.sparks.explode(14, p.x, p.y);
        this.scene.cameras.main.shake(120, 0.004);
        this.popup('HIT', xOf(1 - e.fighter), headY, '#fde047');
        break;
      }
      case 'blocked': {
        const p = strikePoint(atk, this.view);
        this.sparks.explode(5, p.x, p.y);
        this.popup('BLOCK', this.view.toScreen(def.x), headY, '#67e8f9');
        break;
      }
      case 'guard_break':
        this.scene.cameras.main.shake(200, 0.007);
        this.popup('GUARD BREAK', this.view.toScreen(def.x), headY, '#f87171');
        break;
      case 'evaded':
        this.popup('DODGE', xOf(e.fighter), headY, '#a7f3d0');
        break;
      case 'tired':
        this.popup('TIRED', xOf(e.fighter), headY, '#94a3b8', 24);
        break;
      case 'combo':
        if (e.combo) this.popup(`COMBO: ${COMBO_TEXT[e.combo]}`, xOf(e.fighter), headY - 40, '#c084fc', 26);
        break;
      case 'ko':
        this.scene.cameras.main.shake(400, 0.01);
        this.popup('K.O.', this.view.region.x + this.view.region.w / 2, 300, '#f43f5e', 96);
        break;
      default:
        break;
    }
  }
}
