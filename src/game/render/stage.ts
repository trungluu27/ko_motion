import type Phaser from 'phaser';
import type { ArenaView } from '../layout';

export type StageInfo = { width: number; height: number; fighterRow: number; curbRow: number };

const MAX_SHIFT = 80;
const FOLLOW = 0.16;
// the floor stays put: the fighters stand on it and would otherwise appear to slide
const FACTORS = { far: 0.3, mid: 0.6, floor: 0 } as const;

export function parallaxOffsets(midX: number): Record<keyof typeof FACTORS, number> {
  const shift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, (midX - 500) * FOLLOW));
  return { far: -shift * FACTORS.far + 0, mid: -shift * FACTORS.mid + 0, floor: -shift * FACTORS.floor + 0 };
}

/** Three-layer parallax backdrop that drifts with the fighters' midpoint. */
export class Stage {
  private readonly layers: Record<keyof typeof FACTORS, Phaser.GameObjects.Image>;

  constructor(scene: Phaser.Scene, prefix: string, private readonly info: StageInfo) {
    this.layers = {
      far: scene.add.image(0, 0, `${prefix}_far`).setDepth(1),
      mid: scene.add.image(0, 0, `${prefix}_mid`).setDepth(2),
      floor: scene.add.image(0, 0, `${prefix}_floor`).setDepth(3),
    };
  }

  draw(view: ArenaView, midX: number): void {
    const offsets = parallaxOffsets(midX);
    const cx = view.region.x + view.region.w / 2;
    // the row the fighters stand on in the render lines up with the arena ground
    const top = view.groundY - this.info.fighterRow;
    for (const [name, img] of Object.entries(this.layers) as [keyof typeof FACTORS, Phaser.GameObjects.Image][]) {
      img.setOrigin(0.5, 0).setPosition(cx + offsets[name], top);
    }
  }
}
