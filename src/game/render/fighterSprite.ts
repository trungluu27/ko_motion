import type Phaser from 'phaser';
import type { ArenaView } from '../layout';
import { telegraphing } from '../sim/match';
import type { Fighter, MatchResult, MoveId, SimEvent } from '../sim/types';
import { type ClipInfo, WalkTracker, clipInfoFromMeta, jumpLiftPx, spriteFrame } from './spriteAnim';

export type SpriteMeta = {
  anchor: { x: number; y: number };
  frameHeight: number;
  clips: Record<string, number>;
  impact: Record<string, number>;
};

/** On-screen standing height at bodyScale 1 (the stick fighter was about this tall). */
const STANDING_PX = 300;
/** The fighter's standing height as a share of the rendered frame height (render_sprites.py FILL). */
const FILL = 0.88;
const FLASH_TICKS = 3;

/** A Mixamo-rendered fighter: picks the sprite for the sim state, flips by facing, flashes on hits, glows on telegraphs. */
export class FighterSprite {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly clips: ClipInfo;
  private readonly walk = new WalkTracker();
  private actionKind = '';
  private actionTicks = 0;
  private lastHitMove: MoveId | null = null;
  private flash = 0;

  constructor(
    scene: Phaser.Scene,
    key: string,
    private readonly meta: SpriteMeta,
    private readonly self: 0 | 1,
  ) {
    this.clips = clipInfoFromMeta(meta);
    this.shadow = scene.add.ellipse(0, 0, 160, 26, 0x000000, 0.45).setDepth(9);
    this.sprite = scene.add.sprite(0, 0, key, 'idle/000').setDepth(10);
  }

  /** Call once per sim tick with that tick's events. */
  tick(f: Fighter, events: SimEvent[]): void {
    this.walk.tick(f);
    if (f.action.kind !== this.actionKind) {
      this.actionKind = f.action.kind;
      this.actionTicks = 0;
    } else {
      this.actionTicks++;
    }
    for (const e of events) {
      if ((e.type === 'hit' || e.type === 'guard_break') && e.fighter !== this.self) {
        this.lastHitMove = e.move ?? null;
        this.flash = FLASH_TICKS;
      }
    }
    if (this.flash > 0) this.flash--;
  }

  draw(f: Fighter, opponent: Fighter, view: ArenaView, tick: number, result: MatchResult | null, sinceResult: number): void {
    const { clip, index } = spriteFrame(f, {
      self: this.self, opponentX: opponent.x, dx: this.walk.dx, lastHitMove: this.lastHitMove, result,
      tick, actionTicks: this.actionTicks, sinceResult, clips: this.clips,
    });
    const scale = (STANDING_PX * view.bodyScale) / (this.meta.frameHeight * FILL);
    const x = view.toScreen(f.x);
    this.sprite
      .setFrame(`${clip}/${String(index).padStart(3, '0')}`)
      .setFlipX(f.facing < 0)
      .setOrigin(f.facing < 0 ? 1 - this.meta.anchor.x : this.meta.anchor.x, this.meta.anchor.y)
      .setScale(scale)
      .setPosition(x, view.groundY - jumpLiftPx(f, view.bodyScale));
    const lift = jumpLiftPx(f, 1) / 120;
    this.shadow.setPosition(x, view.groundY).setScale(view.bodyScale * (1 - 0.4 * lift));

    const a = f.action;
    const telegraph = telegraphing(f);
    if (this.flash > 0) this.sprite.setTintFill(0xffffff);
    // a solid yellow blink: multiplying the tint barely shows on dark clothes against the night stage
    else if (telegraph && a.kind === 'attack' && a.frame % 6 < 3) this.sprite.setTintFill(0xfde047);
    else this.sprite.clearTint();
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
  }
}
