import Phaser from 'phaser';
import type { Launch, LaunchData } from '../launch';
import { MotionSession } from '../motion/motionSession';
import type { MatchResult } from '../sim/types';
import { type StatsSnapshot, kcalEstimate } from '../stats';
import { FONT } from '../ui/menuList';

export type ResultData = { stats: StatsSnapshot; result: MatchResult; launch: Launch; control: 'keyboard' | 'body' };

/** Body-controlled matches in a row, for the rest reminder (kept in memory only). */
let bodyStreak = 0;
const REST_AFTER = 3;

const LEVEL: Record<string, string> = { easy: 'AI Easy', normal: 'AI Normal', hard: 'AI Hard' };

/** Win/lose and the player's numbers after a match (spec phase5 4). */
export class ResultScene extends Phaser.Scene {
  private d!: ResultData;

  constructor() {
    super('result');
  }

  init(data: ResultData): void {
    this.d = data;
    bodyStreak = data.control === 'body' ? bodyStreak + 1 : 0;
  }

  create(): void {
    const { stats: s, result, launch } = this.d;
    const won = result.winner === 0;
    const title = result.winner === null ? 'HOÀ' : won ? 'THẮNG!' : 'THUA';
    const why = result.reason === 'ko' ? 'KO' : 'hết giờ';
    const level = launch.mode === 'fight' ? LEVEL[launch.opponent] : '';
    this.add
      .text(640, 110, title, { fontFamily: FONT, fontSize: '96px', fontStyle: '900', color: won ? '#4ade80' : result.winner === null ? '#facc15' : '#f87171', stroke: '#020617', strokeThickness: 10 })
      .setOrigin(0.5);
    this.add.text(640, 185, `${why} · ${level} · ${s.seconds} giây`, { fontFamily: FONT, fontSize: '24px', color: '#94a3b8' }).setOrigin(0.5);

    const rows: [string, string][] = [
      ['Đòn trúng', String(s.hitsLanded)],
      ['Combo dài nhất', `${s.longestCombo} đòn`],
      ['Đòn đỡ được', String(s.blocked)],
      ['Cú đấm / cú đá / đặc biệt', `${s.punches} / ${s.kicks} / ${s.specials}`],
      ['Sát thương gây ra / nhận', `${Math.round(s.damageDealt)} / ${Math.round(s.damageTaken)}`],
      ['Năng lượng ước tính*', `≈ ${kcalEstimate(s).toFixed(1)} kcal`],
    ];
    rows.forEach(([k, v], i) => {
      this.add.text(380, 250 + i * 50, k, { fontFamily: FONT, fontSize: '26px', color: '#cbd5e1' });
      this.add.text(900, 250 + i * 50, v, { fontFamily: FONT, fontSize: '26px', fontStyle: '800', color: '#f8fafc' }).setOrigin(1, 0);
    });
    this.add.text(640, 560, '* con số cho vui, không phải phép đo', { fontFamily: FONT, fontSize: '15px', color: '#64748b' }).setOrigin(0.5);
    if (this.d.control === 'body' && bodyStreak >= REST_AFTER) {
      this.add
        .text(640, 600, `Bạn đã đấu ${bodyStreak} trận liền, nghỉ 1–2 phút và uống nước nhé 💧`, { fontFamily: FONT, fontSize: '22px', fontStyle: '700', color: '#facc15' })
        .setOrigin(0.5);
    }
    this.add.text(640, 670, 'Enter: đấu lại · M hoặc Esc: về menu', { fontFamily: FONT, fontSize: '22px', fontStyle: '800', color: '#22d3ee' }).setOrigin(0.5);

    const onKey = (e: KeyboardEvent) => {
      // a held Enter must not also confirm the next screen
      if (e.repeat) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        this.scene.start('fight', { launch, rest: [], control: this.d.control } satisfies LaunchData);
      } else if (e.code === 'Escape' || e.code === 'KeyM') {
        if (this.d.control === 'body') {
          bodyStreak = 0;
          MotionSession.get().pause();
        }
        this.scene.start('menu');
      }
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
  }
}
