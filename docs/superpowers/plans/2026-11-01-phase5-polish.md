# Phase 5 – Hoàn thiện: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Thêm menu, settings, màn an toàn, training (drill và bao cát), màn kết quả kèm thống kê, nhạc nền, và deploy lên GitHub Pages.

**Architecture:** Logic thuần, test được, đặt trong `src/game/{settings,menuNav,stats}.ts`, `src/game/training/*` và `src/game/render/music.ts` (`musicPattern`). Các scene Phaser mỏng chỉ đọc và vẽ từ phần logic đó. Scene nhận dữ liệu khởi chạy qua kiểu `Launch`.

**Tech Stack:** TS, Phaser 3.90, Vitest, WebAudio, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-01-phase5-polish-design.md`

## Global Constraints
- Phím in-game cũ không đổi: R, C, V, 1/2/3/0, P, F3. Thêm Esc (về menu) và N (nhạc).
- Mọi asset đi qua `import.meta.env.BASE_URL`. Vite đặt `base: './'`.
- Chữ hiển thị trong UI bằng tiếng Việt.
- 242 test hiện có phải còn xanh. Lệnh kiểm tra là `npm run check`.
- Không push lên GitHub khi người dùng chưa xác nhận.

## Review Focus
- JSON settings hỏng hoặc thiếu field: không được crash, field lỗi lấy giá trị mặc định.
- Không cấp quyền camera: SettingsScene hiện "Mặc định"; Drill bằng cơ thể quay về bàn phím và báo lý do.
- Rời scene (Esc) giữa trận hoặc giữa drill: nhạc phải tắt, listener bàn phím và session bị gỡ, đang quay video thì dừng quay.
- Đấu lại từ ResultScene giữ nguyên độ khó và kiểu điều khiển.
- Drill: event cũ từ trước lúc gọi lượt không được tính cho lượt đó.

---

### Task 1: Settings và MotionSession
**Files:** Create `src/game/settings.ts`, `tests/game/settings.test.ts`; Modify `src/game/motion/motionSession.ts`, `tests/game/motionSession*.test.ts` (nếu có).
- Produces:
  - `type Settings`, `DEFAULT_SETTINGS`, `loadSettings(storage?: Storage): Settings`, `saveSettings(s: Settings, storage?: Storage): void`;
  - `saveSettings` cũng ghi `bf.model`;
  - `SessionDeps.openCamera(deviceId?: string)`, `MotionSession.start()` đọc settings.
- [ ] Test: JSON hỏng thì trả về mặc định; field sai kiểu thì dùng mặc định cho field đó; lưu rồi đọc lại phải khớp; `sfxVolume` bị kẹp trong 0..1.
- [ ] Test (inject deps): start dùng `cameraId` từ settings; đổi model rồi pause và start lại thì tracker được tạo lại với model mới.
- [ ] Implement, chạy test cho xanh, commit `feat(game): persistent settings; session honors camera and model`.

### Task 2: Menu, Settings, Help, Safety và luồng scene
**Files:** Create `src/game/menuNav.ts`, `src/game/launch.ts`, `src/game/scenes/{MenuScene,SettingsScene,HelpScene,SafetyScene}.ts`, `src/game/ui/menuList.ts`, `tests/game/menuNav.test.ts`, `tests/game/launch.test.ts`; Modify `src/main.ts`, `CalibrationScene.ts`, `FightScene.ts`.
- Produces:
  - `menuNav(index, count, key): { index; action: 'none' | 'select' | 'back' | 'left' | 'right' }`. Index quay vòng; nhận ArrowUp/W, ArrowDown/S, Enter/Space, Escape, ArrowLeft/A, ArrowRight/D.
  - `type Launch` (spec 2).
  - `routeLaunch(launch, settings): Array<'safety' | 'calibration' | 'fight' | 'drill'>`. Đầu tiên là safety nếu chưa ack, tiếp theo là calibration nếu control là body, cuối cùng là đích.
  - `MenuList(scene, x, y, items)`: danh sách chữ có highlight, hover và click; khi chọn thì gọi `sfx.ui()`.
- [ ] Test menuNav: quay vòng ở hai đầu, các phím select/back/left/right.
- [ ] Test routeLaunch: đủ 4 tổ hợp (ack hay chưa, body hay keyboard), cho fight, dummy và drill.
- [ ] Scenes:
  - Menu: Quick Fight sẽ mở danh sách con chọn độ khó.
  - Settings theo spec 3.
  - Help gồm bảng phím, cách đặt camera và nội dung an toàn.
  - Safety theo spec 7.
  - Calibration nhận `next`.
  - FightScene nhận `launch`; Esc về menu; hiện 1/2/3/0 cùng lúc.
  - `main.ts` khởi động vào menu.
- [ ] `npm run check` xanh, build xanh, commit `feat(game): menu, settings, help and safety screens`.

### Task 3: Thống kê trận và ResultScene
**Files:** Create `src/game/stats.ts`, `src/game/scenes/ResultScene.ts`, `tests/game/stats.test.ts`; Modify `FightScene.ts`.
- Produces:
  - `class MatchStats { observe(events: SimEvent[], frame: number): void; currentCombo: number; snapshot(): StatsSnapshot }`;
  - `type StatsSnapshot = { punches; kicks; specials; hitsLanded; blocked; damageDealt; damageTaken; longestCombo; seconds }`;
  - `kcalEstimate(s): number`.
- [ ] Test:
  - 3 đòn trúng, mỗi đòn cách nhau 30 frame, cho `longestCombo` = 3;
  - nếu khoảng cách là 50 frame thì chỉ được 1;
  - nếu người chơi bị trúng đòn ở giữa thì chuỗi bị cắt;
  - đòn bị đỡ không được tính vào `hitsLanded`;
  - `blocked` đếm đúng khi đối thủ đánh vào người chơi đang đỡ.
- [ ] FightScene chuyển sang ResultScene sau 150 tick kể từ khi có kết quả, kèm `{ snapshot, result, launch, control, bodyStreak }`. ResultScene hiện lời nhắc nghỉ khi `bodyStreak >= 3`.
- [ ] Check, rồi commit `feat(game): match stats and result screen`.

### Task 4: Training (bao cát và drill)
**Files:** Create `src/game/training/{dummy,drill}.ts`, `src/game/scenes/DrillScene.ts`, `tests/game/training/{dummy,drill}.test.ts`; Modify `FightScene.ts`, `src/game/input/dummyInput.ts` (nếu cần).
- Produces:
  - `trainingTick(m: Match, ticksSinceHit: number): void`;
  - `class Drill` (theo spec 5);
  - `type DrillMove = 'punch_l' | 'punch_r' | 'kick_l' | 'kick_r' | 'block'`.
- [ ] Test dummy:
  - HP người chơi luôn đầy;
  - HP của bao cát được hồi khi `ticksSinceHit >= 90`;
  - `framesLeft` không bao giờ giảm.
- [ ] Test drill:
  - đủ 12 lượt rồi chuyển sang `done`;
  - không lặp 3 lần liền (thử với 50 seed);
  - đúng động tác thì ra `hit` kèm reaction ms;
  - sai động tác thì ra `wrong`; hết 2,5 s thì ra `miss`;
  - event có `t` trước lúc gọi lượt bị bỏ qua;
  - block nhận theo `state.block`;
  - `summary` tính đúng accuracy và mean.
- [ ] DrillScene: dùng cơ thể (qua Calibration) hoặc bàn phím; có bảng tổng kết; Enter để làm lại, Esc về menu.
- [ ] Check, rồi commit `feat(game): training drill and sandbag`.

### Task 5: Âm thanh
**Files:** Create `src/game/render/music.ts`, `tests/game/music.test.ts`; Modify `sfx.ts`, `FightScene.ts`, `DrillScene.ts`, menu scenes.
- Produces:
  - `musicPattern(bar: number): Note[]`, trong đó `Note = { step: 0..15; voice: 'bass' | 'kick' | 'hat'; freq?: number }`;
  - `class Music(sfx: Sfx)` với `start()`, `stop()`, `setEnabled(on: boolean)`;
  - `Sfx.setVolume(v)`, `Sfx.ui()`, `Sfx.drill(kind: 'prompt' | 'hit' | 'wrong')`, `Sfx.context()` (dùng chung AudioContext và master).
- [ ] Test `musicPattern`:
  - có kick ở step 0, 4, 8, 12 trong mọi ô nhịp;
  - mọi step nằm trong 0..15;
  - vòng 4 ô nhịp lặp lại (`bar` và `bar + 4` cho ra cùng kết quả);
  - tần số bass nằm trong 40..200 Hz.
- [ ] Nối âm lượng và nhạc theo settings; phím N bật/tắt nhạc trong trận; nhạc tắt khi scene shutdown.
- [ ] Check, rồi commit `feat(audio): procedural music, volume, UI and drill sounds`.

### Task 6: Deploy, README và kiểm thử tay
**Files:** Create `.github/workflows/pages.yml`; Modify `vite.config.ts`, `README.md`, spec chính (đánh dấu phase 5).
- [ ] `base: './'`. Chạy `npm run build`, rồi `npx vite preview`, mở `/` và `/lab.html` để kiểm tra asset (không có 404 trong log preview).
- [ ] Viết workflow Pages như spec 8.
- [ ] README: link chơi, đặt camera, demo, an toàn, menu.
- [ ] Checklist kiểm thử tay (người dùng làm):
  - mở menu bằng chuột và bằng phím;
  - đổi settings rồi tải lại trang, thấy giá trị vẫn được giữ;
  - lần đầu chơi thì thấy màn an toàn;
  - đấu Normal đến hết trận, thấy ResultScene, đấu lại được;
  - chơi drill bằng bàn phím và bằng cơ thể;
  - đánh bao cát thấy combo;
  - nhạc bật/tắt bằng N;
  - quay video có nhạc.
- [ ] Commit `chore: GitHub Pages deploy and README`. **Hỏi người dùng trước khi push.**
