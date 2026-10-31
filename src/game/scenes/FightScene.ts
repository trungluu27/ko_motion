import Phaser from 'phaser';
import { AiInput } from '../ai/aiInput';
import type { Difficulty } from '../ai/difficulty';
import { DummyInput } from '../input/dummyInput';
import { IntentBuilder } from '../input/intent';
import { keyboardControl } from '../input/keyboardMap';
import { mergeInputs } from '../input/mergeInputs';
import { MotionInput } from '../input/motionInput';
import { type ArenaView, CANVAS_H, type Layout, VIEW_MODES, type ViewMode, arenaView, layoutFor } from '../layout';
import { FixedStep } from '../loop';
import { MotionSession } from '../motion/motionSession';
import { Effects } from '../render/effects';
import { Hud } from '../render/hud';
import { hudModel } from '../render/hudModel';
import { poseFor } from '../render/pose';
import { Sfx } from '../render/sfx';
import { OPPONENT_COLOR, PLAYER_COLOR, drawFighter } from '../render/stickFighter';
import { WebcamLayer } from '../render/webcamLayer';
import { NPC_TELEGRAPH } from '../sim/constants';
import { createMatch, stepMatch } from '../sim/match';
import type { Match, TickInput } from '../sim/types';
import { TrackingPause } from '../trackingPause';
import { ActionLabelTimer } from '../../view/webcamPanel';

const GAME_KEYS = new Set(['KeyA', 'KeyD', 'KeyS', 'KeyW', 'KeyJ', 'KeyK', 'KeyU', 'KeyI', 'Space', 'KeyQ', 'KeyE', 'F3']);
type Opponent = Difficulty | 'dummy';
const OPPONENT_KEYS: Record<string, Opponent> = { Digit1: 'easy', Digit2: 'normal', Digit3: 'hard', Digit0: 'dummy' };
const OPPONENT_LABEL: Record<Opponent, string> = { easy: 'AI Easy', normal: 'AI Normal', hard: 'AI Hard', dummy: 'bao cát' };
const VIEW_LABEL: Record<ViewMode, string> = { split: 'chia đôi', pip: 'webcam góc', game: 'chỉ game' };

export type Control = 'keyboard' | 'body';
export type FightData = { control?: Control; view?: ViewMode; notice?: string | null };

/** The fight: keyboard and/or body control against the AI, fixed 60 Hz sim, split-screen webcam, tracking pause. */
export class FightScene extends Phaser.Scene {
  private match!: Match;
  private intent = new IntentBuilder();
  private motion = new MotionInput();
  private opponent: Opponent = 'normal';
  private opponentInput: { next: (m: Match) => TickInput } = this.makeOpponent();
  private step = new FixedStep();
  private pause = new TrackingPause();
  private labels = new ActionLabelTimer();
  private down = new Set<string>();
  private pressed = new Set<string>();
  private control: Control = 'keyboard';
  private viewMode: ViewMode = 'split';
  private layout: Layout = layoutFor('game');
  private view: ArenaView = arenaView(this.layout.arena);
  private stage!: Phaser.GameObjects.Graphics;
  private fighters!: Phaser.GameObjects.Graphics;
  private effects!: Effects;
  private hud!: Hud;
  private webcam!: WebcamLayer;
  private sfx = new Sfx();
  private info!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Text;
  private perf!: Phaser.GameObjects.Text;
  private showPerf = false;
  private notice: string | null = null;
  private noticeUntil = 0;

  constructor() {
    super('fight');
  }

  init(data: FightData): void {
    this.control = data.control ?? this.control;
    this.viewMode = data.view ?? this.viewMode;
    this.notice = data.notice ?? null;
  }

  create(): void {
    const font = 'system-ui, sans-serif';
    this.down = new Set();
    this.pressed = new Set();
    this.step = new FixedStep();
    this.pause = new TrackingPause();
    this.stage = this.add.graphics().setDepth(0);
    this.fighters = this.add.graphics().setDepth(10);
    this.effects = new Effects(this, this.view);
    this.hud = new Hud(this);
    this.webcam = new WebcamLayer(this);
    this.webcam.setDepth(45);
    this.info = this.add.text(0, CANVAS_H - 28, '', { fontFamily: font, fontSize: '15px', color: '#94a3b8' }).setOrigin(0.5).setDepth(41);
    this.overlay = this.add
      .text(0, 330, '', { fontFamily: font, fontSize: '44px', fontStyle: '900', color: '#f8fafc', stroke: '#020617', strokeThickness: 8, align: 'center' })
      .setOrigin(0.5)
      .setDepth(60);
    this.perf = this.add.text(12, CANVAS_H - 52, '', { fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: '#a3e635' }).setDepth(61);
    this.noticeUntil = this.notice ? performance.now() + 6000 : 0;
    this.applyLayout();
    this.restart();
    this.attachKeyboard();
    if (this.control === 'body') this.attachBody();
  }

  private attachKeyboard(): void {
    const onDown = (e: KeyboardEvent) => {
      this.sfx.unlock();
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'KeyR') this.restart();
      if (e.code === 'KeyC') this.toggleControl();
      if (e.code === 'KeyV') this.cycleView();
      if (e.code === 'F3') this.showPerf = !this.showPerf;
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

  private attachBody(): void {
    const session = MotionSession.get();
    this.motion = new MotionInput();
    const unsubscribe = session.onOutput((out) => {
      this.motion.push(out);
      const now = performance.now();
      for (const e of out.events) this.labels.push(e, now);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    session.start().catch((e: unknown) => {
      this.control = 'keyboard';
      this.applyLayout();
      this.showNotice(`📷 ${e instanceof Error ? e.message : String(e)} Đã chuyển về bàn phím.`);
    });
  }

  private toggleControl(): void {
    if (this.control === 'keyboard') {
      this.scene.start('calibration');
    } else {
      this.control = 'keyboard';
      this.applyLayout();
      this.updateInfo();
    }
  }

  private cycleView(): void {
    if (this.control !== 'body') return;
    this.viewMode = VIEW_MODES[(VIEW_MODES.indexOf(this.viewMode) + 1) % VIEW_MODES.length];
    this.applyLayout();
    this.updateInfo();
  }

  private applyLayout(): void {
    this.layout = layoutFor(this.control === 'body' ? this.viewMode : 'game');
    this.view = arenaView(this.layout.arena);
    this.effects.view = this.view;
    this.drawStage();
    const { arena } = this.layout;
    this.info.setX(arena.x + arena.w / 2);
    this.overlay.setX(arena.x + arena.w / 2);
  }

  private showNotice(text: string): void {
    this.notice = text;
    this.noticeUntil = performance.now() + 6000;
  }

  private restart(): void {
    this.match = createMatch({ extraStartup: [0, NPC_TELEGRAPH] });
    this.intent = new IntentBuilder();
    this.motion.clear();
    this.pause.reset();
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
    const body = this.control === 'body';
    this.info.setText(
      (body
        ? `Cơ thể · V hiển thị: ${VIEW_LABEL[this.viewMode]} · C về bàn phím`
        : 'A/D đi · W nhảy · S cúi · J/K đấm · U/I đá · Space block · Q/E né · C chơi bằng cơ thể') +
        ` · Đối thủ [1/2/3/0]: ${OPPONENT_LABEL[this.opponent]} · R đấu lại · F3 hiệu năng`,
    );
  }

  private drawStage(): void {
    const g = this.stage;
    const { arena } = this.layout;
    const ground = this.view.groundY;
    g.clear();
    g.fillGradientStyle(0x020617, 0x020617, 0x1e1b4b, 0x1e1b4b, 1);
    g.fillRect(arena.x, 0, arena.w, CANVAS_H);
    g.lineStyle(1, 0x312e81, 0.5);
    const cx = arena.x + arena.w / 2;
    for (let x = arena.x; x <= arena.x + arena.w; x += 64) g.lineBetween(x, ground, cx + (x - cx) * 1.8, CANVAS_H);
    g.lineStyle(14, 0x22d3ee, 0.15);
    g.lineBetween(arena.x, ground, arena.x + arena.w, ground);
    g.lineStyle(3, 0x22d3ee, 0.9);
    g.lineBetween(arena.x, ground, arena.x + arena.w, ground);
  }

  update(_time: number, delta: number): void {
    const now = performance.now();
    const body = this.control === 'body';
    const session = body ? MotionSession.get() : null;
    this.intent.push(keyboardControl({ down: this.down, pressed: this.pressed }, now));
    this.pressed.clear();

    const pause = body
      ? this.pause.update(session?.lastOut?.tracking ?? 'no_person', now, this.match.result !== null)
      : { paused: false, countdown: null };
    const ticks = this.step.advance(delta);
    if (pause.paused) {
      this.motion.clear();
    } else {
      for (let i = 0; i < ticks; i++) {
        const keys = this.intent.next();
        const player = body ? mergeInputs(this.motion.next(now), keys) : keys;
        stepMatch(this.match, [player, this.opponentInput.next(this.match)]);
        for (const e of this.match.events) {
          this.effects.handle(e, this.match);
          this.sfx.play(e);
        }
      }
    }

    this.fighters.clear();
    this.match.fighters.forEach((f, i) => {
      drawFighter(this.fighters, f, poseFor(f), i === 0 ? PLAYER_COLOR : OPPONENT_COLOR, this.view);
    });
    this.hud.draw(hudModel(this.match), this.layout.arena);
    if (session) this.webcam.draw(this.layout.webcam, session, this.labels.current(now));
    else this.webcam.draw(null, MotionSession.get(), null);

    const noticeOn = this.notice !== null && now < this.noticeUntil;
    this.overlay.setText(
      pause.countdown !== null ? String(pause.countdown) : pause.paused ? 'Bước vào lại khung hình' : noticeOn ? this.notice ?? '' : '',
    );
    this.overlay.setFontSize(pause.countdown !== null ? 120 : noticeOn && !pause.paused ? 22 : 44);

    this.perf.setVisible(this.showPerf);
    if (this.showPerf) {
      const p50 = session?.latency.p50();
      this.perf.setText(
        `game ${this.game.loop.actualFps.toFixed(0)} FPS` +
          (session ? ` · tracking ${session.trackingFps.fps()} FPS · latency p50 ${p50 === null || p50 === undefined ? '–' : p50.toFixed(0)} ms` : ''),
      );
    }
  }
}
