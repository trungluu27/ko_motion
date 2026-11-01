import Phaser from 'phaser';
import { createRng } from '../../shared/rng';
import type { ActionEvent } from '../../shared/types';
import { keyboardControl } from '../input/keyboardMap';
import type { LaunchData } from '../launch';
import { MotionSession } from '../motion/motionSession';
import { Sfx } from '../render/sfx';
import { WebcamLayer } from '../render/webcamLayer';
import { loadSettings } from '../settings';
import { DRILL_MOVES, Drill, type DrillMove, type DrillView } from '../training/drill';
import { FONT } from '../ui/menuList';
import { ActionLabelTimer } from '../../view/webcamPanel';

const MOVE_LABEL: Record<DrillMove, string> = { punch_l: 'ĐẤM TRÁI', punch_r: 'ĐẤM PHẢI', kick_l: 'ĐÁ TRÁI', kick_r: 'ĐÁ PHẢI', block: 'BLOCK' };
const MOVE_KEY: Record<DrillMove, string> = { punch_l: 'J', punch_r: 'K', kick_l: 'U', kick_r: 'I', block: 'Space' };
const FEEDBACK_MS = 900;

/** Training drill: calls random moves, scores reaction and accuracy (spec phase5 5). */
export class DrillScene extends Phaser.Scene {
  private control: 'keyboard' | 'body' = 'keyboard';
  private notice: string | null = null;
  private drill!: Drill;
  private webcam!: WebcamLayer;
  private prompt!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  private summary!: Phaser.GameObjects.Text;
  private bodyEvents: ActionEvent[] = [];
  private bodyBlock = false;
  private labels = new ActionLabelTimer();
  private down = new Set<string>();
  private pressed = new Set<string>();
  private feedbackUntil = 0;
  private lastRound = 0;
  private lastPhase: DrillView['phase'] = 'wait';

  constructor() {
    super('drill');
  }

  init(data: Partial<LaunchData>): void {
    this.control = data.control ?? loadSettings().control;
    this.notice = data.notice ?? null;
  }

  create(): void {
    const body = this.control === 'body';
    const cx = body ? 960 : 640;
    this.webcam = new WebcamLayer(this);
    this.add.text(cx, 60, 'Drill', { fontFamily: FONT, fontSize: '36px', fontStyle: '900', color: '#22d3ee' }).setOrigin(0.5);
    this.sub = this.add.text(cx, 110, '', { fontFamily: FONT, fontSize: '20px', color: '#94a3b8', align: 'center' }).setOrigin(0.5);
    this.prompt = this.add.text(cx, 300, '', { fontFamily: FONT, fontSize: '96px', fontStyle: '900', color: '#f8fafc', stroke: '#020617', strokeThickness: 10 }).setOrigin(0.5);
    this.feedback = this.add.text(cx, 430, '', { fontFamily: FONT, fontSize: '36px', fontStyle: '800', color: '#4ade80' }).setOrigin(0.5);
    this.summary = this.add.text(cx, 360, '', { fontFamily: FONT, fontSize: '24px', color: '#e2e8f0', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    this.add.text(cx, 680, 'Esc: về menu', { fontFamily: FONT, fontSize: '17px', color: '#64748b' }).setOrigin(0.5);
    if (this.notice) this.add.text(cx, 600, this.notice, { fontFamily: FONT, fontSize: '17px', color: '#f87171', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);

    if (body) {
      const unsubscribe = MotionSession.get().onOutput((out) => {
        this.bodyEvents.push(...out.events);
        for (const e of out.events) this.labels.push(e, performance.now());
        this.bodyBlock = out.state.block;
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    }
    const onDown = (e: KeyboardEvent) => {
      Sfx.get().unlock();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'Escape') {
        if (body) MotionSession.get().pause();
        this.scene.start('menu');
      } else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && this.drill.view().phase === 'done') {
        this.restart();
      }
    };
    const onUp = (e: KeyboardEvent) => this.down.delete(e.code);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    });
    this.restart();
  }

  private restart(): void {
    this.drill = new Drill(createRng(Date.now() >>> 0));
    this.bodyEvents = [];
    this.lastRound = 0;
    this.lastPhase = 'wait';
    this.feedbackUntil = 0;
  }

  update(): void {
    const now = performance.now();
    const keys = keyboardControl({ down: this.down, pressed: this.pressed }, now);
    this.pressed.clear();
    const events = [...this.bodyEvents, ...keys.events];
    this.bodyEvents = [];
    const v = this.drill.update(now, { events, block: this.bodyBlock || keys.state.block });
    this.react(v, now);
    this.draw(v, now);
  }

  /** Sounds and feedback text on a new prompt or a scored round. */
  private react(v: DrillView, now: number): void {
    const sfx = Sfx.get();
    if (v.phase === 'prompt' && this.lastPhase !== 'prompt') sfx.drill('prompt');
    if (v.round > this.lastRound && v.last) {
      const r = v.last;
      sfx.drill(r.outcome === 'hit' ? 'hit' : 'wrong');
      this.feedback
        .setText(r.outcome === 'hit' ? `✓ ${Math.round(r.reactionMs ?? 0)} ms` : r.outcome === 'wrong' ? '✗ sai động tác' : '⏱ hết giờ')
        .setColor(r.outcome === 'hit' ? '#4ade80' : '#f87171');
      this.feedbackUntil = now + FEEDBACK_MS;
    }
    this.lastRound = v.round;
    this.lastPhase = v.phase;
  }

  private draw(v: DrillView, now: number): void {
    const body = this.control === 'body';
    // the webcam shows what was recognized; the call itself stays big on the right
    this.webcam.draw(body ? { x: 0, y: 0, w: 640, h: 720 } : null, MotionSession.get(), this.labels.current(now));
    const done = v.phase === 'done';
    this.prompt.setVisible(!done).setText(v.prompt ? MOVE_LABEL[v.prompt] : '…');
    this.prompt.setColor(v.prompt ? '#f8fafc' : '#475569');
    this.feedback.setVisible(!done && now < this.feedbackUntil);
    this.sub.setText(
      done
        ? 'Hoàn thành!'
        : `Lượt ${Math.min(v.round + 1, v.rounds)}/${v.rounds}` + (body ? '' : ` · ${v.prompt ? `phím ${MOVE_KEY[v.prompt]}` : 'J/K đấm · U/I đá · Space block'}`),
    );
    this.summary.setVisible(done);
    if (done) {
      const s = this.drill.summary();
      const rows = DRILL_MOVES.filter((m) => s.perMove[m].total > 0).map((m) => `${MOVE_LABEL[m]}: ${s.perMove[m].hit}/${s.perMove[m].total}`);
      this.summary.setText(
        [
          `Chính xác: ${Math.round(s.accuracy * 100)}%`,
          `Phản ứng trung bình: ${s.meanReactionMs === null ? '–' : `${Math.round(s.meanReactionMs)} ms`}`,
          '',
          ...rows,
          '',
          'Enter: làm lại · Esc: về menu',
        ].join('\n'),
      );
    }
  }
}
