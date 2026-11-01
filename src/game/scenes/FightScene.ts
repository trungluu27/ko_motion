import Phaser from 'phaser';
import { AiInput } from '../ai/aiInput';
import type { Difficulty } from '../ai/difficulty';
import type { Launch, LaunchData } from '../launch';
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
import { loadSettings, saveSettings } from '../settings';
import { MatchStats } from '../stats';
import { trainingTick } from '../training/dummy';
import type { ResultData } from './ResultScene';
import { OPPONENT_COLOR, PLAYER_COLOR, drawFighter } from '../render/stickFighter';
import { WebcamLayer } from '../render/webcamLayer';
import { FighterSprite, type SpriteMeta } from '../render/fighterSprite';
import { Stage, type StageInfo } from '../render/stage';
import { telegraphFor } from '../sim/constants';
import { createMatch, stepMatch } from '../sim/match';
import type { Match, TickInput } from '../sim/types';
import { TrackingPause, effectiveTracking } from '../trackingPause';
import { VideoRecorder, downloadBlob, recordingFilename } from '../../recording/videoRecorder';
import { ActionLabelTimer } from '../../view/webcamPanel';

/** Ticks between the match result and the result screen: the KO and the victory pose play out first. */
const RESULT_DELAY = 150;
const GAME_KEYS = new Set(['Escape', 'KeyP', 'KeyA', 'KeyD', 'KeyS', 'KeyW', 'KeyJ', 'KeyK', 'KeyU', 'KeyI', 'Space', 'KeyQ', 'KeyE', 'F3']);
type Opponent = Difficulty | 'dummy';
const FIGHTER_KEYS = ['fighter_a', 'fighter_b'] as const;
const OPPONENT_KEYS: Record<string, Opponent> = { Digit1: 'easy', Digit2: 'normal', Digit3: 'hard', Digit0: 'dummy' };
const OPPONENT_LABEL: Record<Opponent, string> = { easy: 'AI Easy', normal: 'AI Normal', hard: 'AI Hard', dummy: 'bao cát (luyện combo)' };
const VIEW_LABEL: Record<ViewMode, string> = { split: 'chia đôi', pip: 'webcam góc', game: 'chỉ game' };

export type Control = 'keyboard' | 'body';
export type FightData = Partial<LaunchData>;

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
  private backdrop: Stage | null = null;
  private sprites: [FighterSprite, FighterSprite] | null = null;
  private failedAssets = new Set<string>();
  private simTicks = 0;
  private sinceResult = 0;
  private stats = new MatchStats();
  private sinceHit = 0;
  private comboText!: Phaser.GameObjects.Text;
  private fighters!: Phaser.GameObjects.Graphics;
  private effects!: Effects;
  private hud!: Hud;
  private webcam!: WebcamLayer;
  private sfx = Sfx.get();
  private info!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Text;
  private perf!: Phaser.GameObjects.Text;
  private showPerf = false;
  private notice: string | null = null;
  private noticeUntil = 0;
  private recorder = new VideoRecorder();
  private recButton!: Phaser.GameObjects.Text;

  constructor() {
    super('fight');
  }

  /** Fighter atlases and stage layers; any failure falls back to the stick fighters / plain stage. */
  preload(): void {
    const base = import.meta.env.BASE_URL;
    this.failedAssets = new Set();
    this.load.on('loaderror', (file: Phaser.Loader.File) => this.failedAssets.add(file.key));
    for (const f of FIGHTER_KEYS) {
      if (!this.textures.exists(f)) this.load.multiatlas(f, `${base}sprites/${f}.json`, `${base}sprites/`);
      if (!this.cache.json.exists(`${f}_meta`)) this.load.json(`${f}_meta`, `${base}sprites/${f}.json`);
    }
    if (!this.textures.exists('neon_far')) {
      this.load.image('neon_far', `${base}stages/neon_street/far.jpg`);
      this.load.image('neon_mid', `${base}stages/neon_street/mid.webp`);
      this.load.image('neon_floor', `${base}stages/neon_street/floor.webp`);
      this.load.json('neon_stage', `${base}stages/neon_street/stage.json`);
    }
  }

  private createArt(): void {
    const ok = (k: string) => !this.failedAssets.has(k);
    const metas = FIGHTER_KEYS.map((f) => (this.cache.json.get(`${f}_meta`) as { meta?: SpriteMeta } | undefined)?.meta);
    const spritesOk = FIGHTER_KEYS.every((f, i) => ok(f) && this.textures.exists(f) && metas[i]?.clips);
    this.sprites = spritesOk
      ? [new FighterSprite(this, FIGHTER_KEYS[0], metas[0]!, 0), new FighterSprite(this, FIGHTER_KEYS[1], metas[1]!, 1)]
      : null;
    if (!spritesOk) console.warn('[FightScene] fighter sprites unavailable, using stick fighters');
    const stageInfo = this.cache.json.get('neon_stage') as StageInfo | undefined;
    const stageOk = ['neon_far', 'neon_mid', 'neon_floor'].every((k) => ok(k) && this.textures.exists(k)) && stageInfo;
    this.backdrop = stageOk ? new Stage(this, 'neon', stageInfo) : null;
  }

  init(data: FightData): void {
    const settings = loadSettings();
    const launch: Launch = data.launch ?? { mode: 'fight', opponent: this.opponent === 'dummy' ? 'normal' : this.opponent };
    this.opponent = launch.mode === 'fight' ? launch.opponent : 'dummy';
    this.control = data.control ?? settings.control;
    this.viewMode = settings.view;
    this.notice = data.notice ?? null;
  }

  /** The current activity, for calibration round-trips. */
  private launch(): Launch {
    return this.opponent === 'dummy' ? { mode: 'dummy' } : { mode: 'fight', opponent: this.opponent };
  }

  create(): void {
    const font = 'system-ui, sans-serif';
    this.down = new Set();
    this.pressed = new Set();
    this.step = new FixedStep();
    this.pause = new TrackingPause();
    this.stage = this.add.graphics().setDepth(0);
    this.createArt();
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
    this.comboText = this.add
      .text(0, 150, '', { fontFamily: font, fontSize: '40px', fontStyle: '900', color: '#facc15', stroke: '#020617', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(60);
    this.perf = this.add.text(12, CANVAS_H - 52, '', { fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: '#a3e635' }).setDepth(61);
    this.recButton = this.add
      .text(0, 96, '', { fontFamily: font, fontSize: '16px', fontStyle: '700', color: '#f8fafc', backgroundColor: '#1e293b', padding: { x: 10, y: 4 } })
      .setOrigin(0.5)
      .setDepth(62)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => void this.toggleRecording());
    this.recButton.setVisible(VideoRecorder.isAvailable());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.recorder.recording) void this.toggleRecording();
    });
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
      if (e.code === 'Escape') this.toMenu();
      if (e.code === 'KeyR') this.restart();
      if (e.code === 'KeyC') this.toggleControl();
      if (e.code === 'KeyV') this.cycleView();
      if (e.code === 'F3') this.showPerf = !this.showPerf;
      if (e.code === 'KeyP' && VideoRecorder.isAvailable()) void this.toggleRecording();
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
      this.toKeyboard();
      this.showNotice(`📷 ${e instanceof Error ? e.message : String(e)} Đã chuyển về bàn phím.`);
    });
  }

  /** Records the whole game canvas (webcam + fight) with game sound to a WebM download. */
  private async toggleRecording(): Promise<void> {
    if (this.recorder.recording) {
      const blob = await this.recorder.stop();
      downloadBlob(blob, recordingFilename(new Date()));
      return;
    }
    try {
      this.recorder.start(this.game.canvas, this.sfx.recordingStream() ?? undefined);
    } catch (e) {
      this.showNotice(`Không quay được video: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private toggleControl(): void {
    if (this.control === 'keyboard') {
      this.scene.start('calibration', { launch: this.launch(), rest: ['fight'] } satisfies LaunchData);
    } else {
      MotionSession.get().pause();
      this.toKeyboard();
      this.updateInfo();
    }
  }

  /** Back to keyboard control; the NPC's warning shortens from the next attack on (spec ai-difficulty 2.2). */
  private toKeyboard(): void {
    this.control = 'keyboard';
    this.match.fighters[1].extraStartup = telegraphFor('keyboard');
    this.applyLayout();
  }

  private toMenu(): void {
    if (this.control === 'body') MotionSession.get().pause();
    this.scene.start('menu');
  }

  private cycleView(): void {
    if (this.control !== 'body') return;
    this.viewMode = VIEW_MODES[(VIEW_MODES.indexOf(this.viewMode) + 1) % VIEW_MODES.length];
    saveSettings({ ...loadSettings(), view: this.viewMode });
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
    this.recButton.setX(arena.x + arena.w / 2);
    this.overlay.setX(arena.x + arena.w / 2);
    this.overlay.setWordWrapWidth(arena.w - 80);
  }

  private showNotice(text: string): void {
    this.notice = text;
    this.noticeUntil = performance.now() + 6000;
  }

  private restart(): void {
    this.match = createMatch({ extraStartup: [0, telegraphFor(this.control)] });
    this.sinceResult = 0;
    this.stats = new MatchStats();
    this.sinceHit = 0;
    this.intent = new IntentBuilder();
    this.motion.clear();
    this.pause.reset();
    this.opponentInput = this.makeOpponent();
    this.updateInfo();
  }

  /** A fresh opponent per match, so no AI statistics or plans carry over. */
  private makeOpponent(): { next: (m: Match) => TickInput } {
    if (this.opponent === 'dummy') {
      const dummy = new DummyInput('idle');
      return { next: (m) => dummy.next(m.frame) };
    }
    return new AiInput(this.opponent, 1, Date.now() >>> 0);
  }

  private updateInfo(): void {
    const body = this.control === 'body';
    this.info.setText(
      (body
        ? `Esc menu · Cơ thể · V hiển thị: ${VIEW_LABEL[this.viewMode]} · C về bàn phím`
        : 'Esc menu · A/D đi · W nhảy · S cúi · J/K đấm · U/I đá · Space block · Q/E né · C cơ thể') +
        ` · Đối thủ [1/2/3/0]: ${OPPONENT_LABEL[this.opponent]} · R đấu lại · F3 hiệu năng`,
    );
  }

  private drawStage(): void {
    const g = this.stage;
    const { arena } = this.layout;
    const ground = this.view.groundY;
    g.clear();
    if (this.backdrop) return;
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
      ? this.pause.update(effectiveTracking(session?.lastOut?.tracking, session?.lastOutAt ?? null, now), now, this.match.result !== null)
      : { paused: false, countdown: null };
    const ticks = this.step.advance(delta);
    if (pause.paused) {
      this.motion.clear();
      this.intent.clear();
    } else {
      for (let i = 0; i < ticks; i++) {
        const keys = this.intent.next();
        const player = body ? mergeInputs(this.motion.next(now), keys) : keys;
        stepMatch(this.match, [player, this.opponentInput.next(this.match)]);
        this.stats.observe(this.match.events, this.match.frame);
        if (this.opponent === 'dummy') {
          const hit = this.match.events.some((e) => (e.type === 'hit' || e.type === 'guard_break') && e.fighter === 0);
          this.sinceHit = hit ? 0 : this.sinceHit + 1;
          trainingTick(this.match, this.sinceHit);
        }
        this.simTicks++;
        if (this.match.result) this.sinceResult++;
        this.sprites?.forEach((sp, j) => sp.tick(this.match.fighters[j], this.match.events));
        for (const e of this.match.events) {
          this.effects.handle(e, this.match);
          this.sfx.play(e);
        }
      }
    }

    if (this.match.result && this.opponent !== 'dummy' && this.sinceResult >= RESULT_DELAY) {
      const data: ResultData = { stats: this.stats.snapshot(), result: this.match.result, launch: this.launch(), control: this.control };
      this.scene.start('result', data);
      return;
    }

    this.fighters.clear();
    const [fa, fb] = this.match.fighters;
    this.backdrop?.draw(this.view, (fa.x + fb.x) / 2);
    if (this.sprites) {
      this.sprites[0].draw(fa, fb, this.view, this.simTicks, this.match.result, this.sinceResult);
      this.sprites[1].draw(fb, fa, this.view, this.simTicks, this.match.result, this.sinceResult);
    } else {
      this.match.fighters.forEach((f, i) => {
        drawFighter(this.fighters, f, poseFor(f), i === 0 ? PLAYER_COLOR : OPPONENT_COLOR, this.view);
      });
    }
    this.hud.draw(hudModel(this.match), this.layout.arena);
    if (session) this.webcam.draw(this.layout.webcam, session, this.labels.current(now));
    else this.webcam.draw(null, MotionSession.get(), null);

    const combo = this.stats.comboAt(this.match.frame);
    this.comboText.setX(this.layout.arena.x + this.layout.arena.w / 2).setText(this.opponent === 'dummy' && combo >= 2 ? `COMBO ×${combo}` : '');

    const noticeOn = this.notice !== null && now < this.noticeUntil;
    this.overlay.setText(
      pause.countdown !== null ? String(pause.countdown) : pause.paused ? 'Bước vào lại khung hình' : noticeOn ? this.notice ?? '' : '',
    );
    this.overlay.setFontSize(pause.countdown !== null ? 120 : noticeOn && !pause.paused ? 22 : 44);

    if (this.recorder.recording) {
      const s = Math.floor(this.recorder.elapsedMs(now) / 1000);
      this.recButton.setText(`● REC ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}  (P dừng)`);
      this.recButton.setColor('#f87171');
    } else {
      this.recButton.setText('⏺ Quay video (P)');
      this.recButton.setColor('#f8fafc');
    }

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
