import Phaser from 'phaser';
import { AiInput } from '../ai/aiInput';
import type { Difficulty } from '../ai/difficulty';
import { DummyInput } from '../input/dummyInput';
import { IntentBuilder } from '../input/intent';
import { keyboardControl } from '../input/keyboardMap';
import { FixedStep } from '../loop';
import { Effects } from '../render/effects';
import { Hud } from '../render/hud';
import { hudModel } from '../render/hudModel';
import { poseFor } from '../render/pose';
import { Sfx } from '../render/sfx';
import { type ArenaView, arenaView, layoutFor } from '../layout';
import { OPPONENT_COLOR, PLAYER_COLOR, drawFighter } from '../render/stickFighter';
import { NPC_TELEGRAPH } from '../sim/constants';
import { createMatch, stepMatch } from '../sim/match';
import type { Match, TickInput } from '../sim/types';

const W = 1280;
const H = 720;
const GAME_KEYS = new Set(['KeyA', 'KeyD', 'KeyS', 'KeyW', 'KeyJ', 'KeyK', 'KeyU', 'KeyI', 'Space', 'KeyQ', 'KeyE']);
type Opponent = Difficulty | 'dummy';
const OPPONENT_KEYS: Record<string, Opponent> = { Digit1: 'easy', Digit2: 'normal', Digit3: 'hard', Digit0: 'dummy' };
const OPPONENT_LABEL: Record<Opponent, string> = { easy: 'AI Easy', normal: 'AI Normal', hard: 'AI Hard', dummy: 'bao cát (jab có báo trước)' };

/** Keyboard fight against the sparring dummy: fixed 60 Hz sim, neon stick fighters, HUD, effects and sound. */
export class FightScene extends Phaser.Scene {
  private match!: Match;
  private intent = new IntentBuilder();
  private opponent: Opponent = 'normal';
  private opponentInput: { next: (m: Match) => TickInput } = this.makeOpponent();
  private step = new FixedStep();
  private down = new Set<string>();
  private pressed = new Set<string>();
  private fighters!: Phaser.GameObjects.Graphics;
  private effects!: Effects;
  private hud!: Hud;
  private sfx = new Sfx();
  private info!: Phaser.GameObjects.Text;
  private view: ArenaView = arenaView(layoutFor('game').arena);

  constructor() {
    super('fight');
  }

  create(): void {
    this.drawStage();
    this.fighters = this.add.graphics().setDepth(10);
    this.effects = new Effects(this, this.view);
    this.hud = new Hud(this);
    this.info = this.add
      .text(W / 2, H - 28, '', { fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#94a3b8' })
      .setOrigin(0.5)
      .setDepth(41);
    this.restart();

    const onDown = (e: KeyboardEvent) => {
      this.sfx.unlock();
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'KeyR') this.restart();
      const opponent = OPPONENT_KEYS[e.code];
      if (opponent) {
        this.opponent = opponent;
        this.restart();
      }
    };
    const onUp = (e: KeyboardEvent) => this.down.delete(e.code);
    const onBlur = () => this.down.clear();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    });
  }

  private restart(): void {
    this.match = createMatch({ extraStartup: [0, NPC_TELEGRAPH] });
    this.intent = new IntentBuilder();
    this.opponentInput = this.makeOpponent();
    this.updateInfo();
  }

  /** A fresh opponent per match, so no AI statistics or plans carry over. */
  private makeOpponent(): { next: (m: Match) => TickInput } {
    if (this.opponent === 'dummy') {
      const dummy = new DummyInput('jab');
      return { next: (m) => dummy.next(m.frame) };
    }
    return new AiInput(this.opponent, 1, Date.now() >>> 0);
  }

  private updateInfo(): void {
    this.info.setText(
      `A/D đi · W nhảy · S cúi · J/K đấm · U/I đá · Space block · Q/E né · J+K nhanh = special · ` +
        `Đối thủ [1/2/3 AI · 0 bao cát]: ${OPPONENT_LABEL[this.opponent]} · R đấu lại`,
    );
  }

  private drawStage(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillGradientStyle(0x020617, 0x020617, 0x1e1b4b, 0x1e1b4b, 1);
    g.fillRect(0, 0, W, H);
    g.lineStyle(1, 0x312e81, 0.5);
    for (let x = 0; x <= W; x += 64) g.lineBetween(x, this.view.groundY, W / 2 + (x - W / 2) * 1.8, H);
    g.lineStyle(14, 0x22d3ee, 0.15);
    g.lineBetween(0, this.view.groundY, W, this.view.groundY);
    g.lineStyle(3, 0x22d3ee, 0.9);
    g.lineBetween(0, this.view.groundY, W, this.view.groundY);
  }

  update(_time: number, delta: number): void {
    this.intent.push(keyboardControl({ down: this.down, pressed: this.pressed }, performance.now()));
    this.pressed.clear();
    const ticks = this.step.advance(delta);
    for (let i = 0; i < ticks; i++) {
      stepMatch(this.match, [this.intent.next(), this.opponentInput.next(this.match)]);
      for (const e of this.match.events) {
        this.effects.handle(e, this.match);
        this.sfx.play(e);
      }
    }
    this.fighters.clear();
    this.match.fighters.forEach((f, i) => {
      drawFighter(this.fighters, f, poseFor(f), i === 0 ? PLAYER_COLOR : OPPONENT_COLOR, this.view);
    });
    this.hud.draw(hudModel(this.match), this.view.region);
  }
}
