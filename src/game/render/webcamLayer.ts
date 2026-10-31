import type Phaser from 'phaser';
import type { Region } from '../layout';
import type { MotionSession } from '../motion/motionSession';
import type { ActionEvent } from '../../shared/types';
import { drawWebcamPanel } from '../../view/webcamPanel';

/** Draws the Phase 1 webcam panel into a Phaser CanvasTexture, so the webcam is part of the game canvas (and recordings). */
export class WebcamLayer {
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly img: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, key = 'webcam') {
    const existing = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture) : null;
    this.tex = existing ?? scene.textures.createCanvas(key, 480, 720)!;
    this.img = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(5);
  }

  draw(region: Region | null, session: MotionSession, label: ActionEvent | null, prompt?: string): void {
    if (!region) {
      this.img.setVisible(false);
      return;
    }
    if (this.tex.width !== region.w || this.tex.height !== region.h) this.tex.setSize(region.w, region.h);
    drawWebcamPanel(
      this.tex.getContext(),
      { x: 0, y: 0, w: region.w, h: region.h },
      session.video,
      session.lastFrame,
      session.lastOut,
      label,
      { prompt },
    );
    this.tex.refresh();
    this.img.setPosition(region.x, region.y).setVisible(true);
  }

  setDepth(depth: number): void {
    this.img.setDepth(depth);
  }
}
