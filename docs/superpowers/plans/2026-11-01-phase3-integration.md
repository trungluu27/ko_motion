# Phase 3 – Body Control, Calibration, Split Screen & Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đánh với AI bằng cơ thể qua webcam. Có màn calibration trước trận, tự tạm dừng khi mất tracking, ba chế độ hiển thị (chia đôi / picture-in-picture / chỉ game) và nút quay video ghi cả webcam lẫn trận đấu trên cùng một canvas.

**Architecture:** `MotionSession` (một instance dùng chung giữa các scene) giữ camera, `PoseTracker`, `MotionEngine` và calibration. Mỗi `EngineOutput` được đẩy vào `MotionInput` (thuần), nơi chuyển thành `TickInput` mỗi tick và bỏ event cũ hơn 250 ms. Webcam được vẽ bằng `drawWebcamPanel` (Phase 1) lên một `CanvasTexture` của Phaser, nên toàn bộ khung hình nằm trên `game.canvas` và `VideoRecorder` (Phase 1) quay thẳng canvas đó cùng audio từ `Sfx`. Bố cục do `layoutFor(mode)` (thuần) quyết định, HUD, hiệu ứng và võ sĩ đều vẽ theo vùng arena của bố cục.

**Tech Stack:** Phaser 3.90, TypeScript, Vitest (+ happy-dom cho test lưu trữ), MediaPipe (đã có).

**Spec:** `docs/superpowers/specs/2026-10-31-body-fighter-design.md` mục 7 (cùng 4, 5.4, 6.3).

## Global Constraints

- Canvas 1280×720. `split`: webcam x 0–480, arena x 480–1280. `pip`: arena toàn khung, webcam 320×180 ở góc phải trên, dưới thanh HUD (y = 90). `game`: chỉ arena.
- Event từ cơ thể cũ hơn **250 ms** khi tới tick thì bỏ (spec 7).
- Mất tracking: **500 ms** không `ok` → pause, overlay "Bước vào lại khung hình". `ok` liên tục **1 s** → đếm ngược **3-2-1** (3 s) → chạy tiếp. Mất lại trong lúc đếm thì quay về pause.
- Calibration lưu ở `localStorage['bf.calibration']`, model ở `localStorage['bf.model']` (dùng chung với Motion Lab). Không vào trận bằng cơ thể khi chưa có calibration hợp lệ.
- Quay video: phím **P** và nút ⏺ trên HUD (R vẫn là đấu lại). Tên file `bodyfighter-YYYYMMDD-HHmmss.webm`, gồm cả âm thanh game.
- Phím chung: **C** đổi điều khiển bàn phím ↔ cơ thể, **V** đổi chế độ hiển thị, **F3** bật/tắt chỉ số hiệu năng. Bàn phím luôn hoạt động song song khi dùng cơ thể (spec 6.4).
- Commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `npm run check` xanh trước mỗi commit.

## Review Focus

1. **Từ chối quyền camera / không có camera khi chuyển sang điều khiển cơ thể:** hiện thông báo, tự quay về bàn phím, game không treo. Kiểm tra thủ công ở Task 6.
2. **Calibration lưu trong localStorage bị hỏng hoặc từ phiên bản cũ:** bị bỏ qua, yêu cầu calibrate lại, không ném lỗi mỗi frame. Test ở Task 4.
3. **Mất tracking đúng lúc đang đếm ngược hoặc khi trận đã kết thúc:** đếm ngược bị huỷ về pause; sau khi có kết quả thì không pause nữa. Test ở Task 3.
4. **Phím/cơ thể gửi event dồn trong lúc pause:** khi chạy tiếp không được xả cả loạt đòn cũ (đều cũ hơn 250 ms). Test ở Task 2.
5. **Đổi chế độ hiển thị khi đang quay video:** video vẫn ghi liên tục, không hỏng file (cùng một canvas). Kiểm tra thủ công ở Task 7.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/game/layout.ts` | `ViewMode`, `layoutFor(mode)` → vùng arena và vùng webcam |
| `src/game/input/motionInput.ts` | `EngineOutput` → `TickInput`, bỏ event cũ |
| `src/game/trackingPause.ts` | Máy trạng thái pause / đếm ngược theo tracking |
| `src/motion/calibrationStore.ts` | Đọc/ghi calibration có kiểm tra hợp lệ |
| `src/game/motion/motionSession.ts` | Camera + tracker + engine + calibration dùng chung |
| `src/game/render/webcamLayer.ts` | CanvasTexture của Phaser vẽ `drawWebcamPanel` |
| `src/game/scenes/CalibrationScene.ts` | Màn calibration trước trận |
| `src/game/scenes/FightScene.ts`, `render/{hud,effects,stickFighter,sfx}.ts` | Theo bố cục, điều khiển cơ thể, pause, quay video |

---

### Task 1: Bố cục và vẽ theo vùng arena

**Files:** Create `src/game/layout.ts`. Modify `src/game/render/{stickFighter,hud,effects}.ts`, `src/game/scenes/FightScene.ts`. Test `tests/game/layout.test.ts`.

**Interfaces – Produces:**
```ts
type ViewMode = 'split' | 'pip' | 'game';
const VIEW_MODES: ViewMode[];                       // ['split', 'pip', 'game'] (thứ tự xoay vòng của phím V)
type Region = { x: number; y: number; w: number; h: number };
type Layout = { arena: Region; webcam: Region | null };
function layoutFor(mode: ViewMode): Layout;
function arenaView(arena: Region): ArenaView;       // toScreen: arena.x + 40·s + (x/1000)·(arena.w − 80·s); groundY 620; bodyScale s = arena.w / 1280
```
`ArenaView` thêm trường `bodyScale` (nhân mọi kích thước cơ thể và độ cao nhảy). `Hud` nhận `Region` của arena (thanh HP mỗi bên rộng `0.4·w`, đồng hồ ở giữa vùng). `Effects` lấy tâm vùng arena cho chữ K.O.

- [ ] Test: `layoutFor('split')` → arena `{x:480, y:0, w:800, h:720}`, webcam `{x:0, y:0, w:480, h:720}`; `'pip'` → arena toàn khung, webcam `{x:944, y:90, w:320, h:180}`; `'game'` → webcam null; `arenaView` của split: `toScreen(0) = 505`, `toScreen(1000) = 1255`, `bodyScale = 0.625`.
- [ ] FAIL → cài đặt (FightScene vẫn dùng `'game'` ở task này) → PASS, `npm run build` xanh → commit `feat(game): layout regions and region-aware rendering`.

### Task 2: MotionInput

**Files:** Create `src/game/input/motionInput.ts`. Test `tests/game/motionInput.test.ts`.

**Interfaces – Produces:**
```ts
const MAX_EVENT_AGE_MS = 250;
class MotionInput {
  push(out: EngineOutput): void;      // xếp event (giữ t), cập nhật state + tracking mới nhất
  next(now: number): TickInput;       // bỏ event có now − t > 250; một đòn mỗi tick; jump chỉ khi tick đó không có đòn
  clear(): void;                      // xoá hàng đợi (khi pause / bắt đầu trận)
}
```
Ánh xạ: `punch_*`/`kick_*` → `attack`; `jump` → `jump`; `state.block/crouch` giữ nguyên; `dodge ≠ 0` → `dodge`; `move` giữ nguyên dấu (cơ thể sang phải của người chơi = sang phải màn hình gương). Tracking khác `ok` → state mặc định.

- [ ] Test: event punch_l t=1000 → `next(1100).attack === 'punch_l'`, lần sau null; event t=1000 → `next(1300).attack === null` (quá 250 ms) **[RF4]**; punch_l + punch_r cùng frame → hai tick liên tiếp; jump + punch_r cùng frame → tick 1 punch_r (không jump), tick 2 jump; state `{block:true, move:1}` → `block`, `move 1`; tracking `partial` → `move 0, block false`; `clear()` xoá hàng đợi.
- [ ] FAIL → cài đặt → PASS → commit `feat(game): motion input with stale-event dropping`.

### Task 3: Pause theo tracking

**Files:** Create `src/game/trackingPause.ts`. Test `tests/game/trackingPause.test.ts`.

**Interfaces – Produces:**
```ts
type PauseView = { paused: boolean; countdown: number | null };   // countdown 3,2,1 khi đang đếm, null khi không
class TrackingPause {
  update(tracking: TrackingStatus, now: number, matchOver: boolean): PauseView;
  reset(): void;
}
```
Trạng thái: `running` → (không ok ≥ 500 ms) → `paused` → (ok liên tục ≥ 1000 ms) → `countdown` (3 s; hiển thị `ceil(còn lại/1000)`) → `running`. Đang `countdown` mà không ok → `paused` (đếm lại 1 s ok). `matchOver` thì luôn `running`.

- [ ] Test: ok liên tục → không pause; partial 400 ms rồi ok → không pause; partial 500 ms → paused; sau đó ok 999 ms → vẫn paused, 1000 ms → countdown 3; +1500 ms kể từ lúc bắt đầu đếm → countdown 2 (còn 1500 ms, `ceil`); +3000 ms → running; mất tracking trong lúc countdown → paused **[RF3]**; `matchOver` → không pause dù mất tracking **[RF3]**.
- [ ] FAIL → cài đặt → PASS → commit `feat(game): pause and 3-2-1 resume driven by tracking`.

### Task 4: Lưu calibration an toàn

**Files:** Create `src/motion/calibrationStore.ts`. Modify `src/lab/labApp.ts` (dùng store). Test `tests/motion/calibrationStore.test.ts` (happy-dom).

**Interfaces – Produces:**
```ts
const CALIBRATION_KEY = 'bf.calibration';
function isCalibration(x: unknown): x is Calibration;    // đủ mọi trường số hữu hạn, torsoPx/shoulderPx/legPx > 0, upperArm/foreArm có l/r
function loadCalibration(storage?: Storage): Calibration | null;   // JSON hỏng / thiếu trường → xoá key, trả null
function saveCalibration(cal: Calibration, storage?: Storage): void;
```
- [ ] Test: lưu rồi đọc lại bằng nhau; chuỗi `'{'` → null và key bị xoá **[RF2]**; thiếu `legPx` → null **[RF2]**; `torsoPx: 0` → null.
- [ ] FAIL → cài đặt, Lab chuyển sang dùng store → PASS → commit `feat(motion): validated calibration storage shared by lab and game`.

### Task 5: MotionSession, lớp webcam và màn calibration

**Files:** Create `src/game/motion/motionSession.ts`, `src/game/render/webcamLayer.ts`, `src/game/scenes/CalibrationScene.ts`.

**Interfaces – Produces:**
```ts
class MotionSession {
  static get(): MotionSession;                         // instance dùng chung
  readonly engine: MotionEngine;
  video: HTMLVideoElement | null;
  lastFrame: PoseFrame | null; lastOut: EngineOutput | null;
  calibration: Calibration | null;                     // nạp từ calibrationStore khi khởi tạo
  start(): Promise<void>;                              // mở camera + tracker (model từ bf.model, mặc định full); ném CameraError khi bị từ chối
  onOutput(fn: (out: EngineOutput, frame: PoseFrame | null) => void): () => void;   // trả hàm huỷ đăng ký
  setCalibration(cal: Calibration): void;              // lưu store + engine.setCalibration
  get running(): boolean;
}
class WebcamLayer {
  constructor(scene: Phaser.Scene, key?: string);
  draw(region: Region | null, session: MotionSession, label: ActionEvent | null, prompt?: string): void;   // null → ẩn
}
```
`CalibrationScene` (key `'calibration'`): webcam lớn bên trái (vùng split), bên phải là hướng dẫn: đứng nghiêng khoảng 45°, cách 2,5–3 m, thấy toàn thân. Trạng thái dùng `Calibrator` với chữ của spec 5.4 ("Đang tìm người chơi", "Chưa thấy toàn thân", "Ra ngoài khung hình", "Đang hiệu chỉnh xx%", "Sẵn sàng!"). Phím: **Enter** vào trận (chỉ khi đã có calibration), **K** calibrate lại, **Esc** quay về bàn phím. Lỗi camera → hiện thông báo và tự về FightScene với bàn phím.

- [ ] `npm run check` + `npm run build` xanh (phần này phụ thuộc DOM/camera nên không có unit test; logic thuần đã test ở Task 2–4).
- [ ] Commit `feat(game): shared motion session, webcam layer and calibration scene`.

### Task 6: Điều khiển bằng cơ thể trong trận

**Files:** Modify `src/game/scenes/FightScene.ts`, `src/main.ts`.

- Scene nhận `{ control: 'keyboard' | 'body', view: ViewMode }` qua `scene.start('fight', data)`. Mặc định keyboard + `game`. Chọn body thì mặc định `split`.
- **C**: keyboard → body chuyển sang `CalibrationScene`; body → keyboard thì tiếp tục trận với bàn phím. **V**: xoay vòng `VIEW_MODES`. Webcam layer chỉ vẽ khi đang dùng body.
- Body: đăng ký `MotionSession.onOutput` → `MotionInput.push` và nhãn động tác (`ActionLabelTimer`). Mỗi tick, input người chơi = gộp `MotionInput.next(now)` với bàn phím (đòn nào có trước thì dùng, `move`/`block`/`crouch`/`dodge` lấy OR). Huỷ đăng ký khi scene shutdown.
- Pause: `TrackingPause.update(lastOut.tracking, now, !!match.result)`; khi `paused` thì không step sim, `MotionInput.clear()`, overlay mờ "Bước vào lại khung hình". Khi `countdown` hiện số lớn ở giữa arena.
- **F3**: chữ nhỏ góc trái dưới: game FPS (`game.loop.actualFps`), tracking FPS, độ trễ p50.
- [ ] `npm run check` + `npm run build` xanh.
- [ ] Kiểm tra thủ công (cần camera và người chơi): C → màn calibration → Enter vào trận chia đôi; đấm, đá, block, né, cúi, đi trái/phải điều khiển được võ sĩ; bước ra khỏi khung → pause, quay lại → 3-2-1; chặn quyền camera → thông báo và về bàn phím **[RF1]**; F3 hiện FPS game (ghi lại con số; nếu < 55 FPS thì ghi vào ledger để làm Web Worker ở plan sau).
- [ ] Commit `feat(game): body-controlled fights with tracking pause and split view`.

### Task 7: Quay video trong game

**Files:** Modify `src/game/render/sfx.ts`, `src/game/scenes/FightScene.ts`, `src/game/render/hud.ts`.

- `Sfx.recordingStream(): MediaStream | null`: tạo `MediaStreamAudioDestinationNode` và nối mọi âm thanh vào cả loa lẫn node này.
- **P** hoặc nút ⏺ (chữ bấm được dưới đồng hồ) → `VideoRecorder.start(game.canvas, sfx.recordingStream())`. Bấm lại → `stop()` → `downloadBlob(recordingFilename(new Date()))`. Khi đang ghi: chấm đỏ + `REC mm:ss` ở góc trên giữa. Ẩn nút nếu `!VideoRecorder.isAvailable()`.
- [ ] `npm run check` + `npm run build` xanh.
- [ ] Kiểm tra thủ công: quay 10 s ở chế độ split → file `.webm` có webcam + trận + âm thanh; đổi V giữa lúc quay → file vẫn liền mạch **[RF5]**.
- [ ] Commit `feat(game): record the fight with webcam and sound to WebM`.

### Task 8: Tài liệu

**Files:** Modify `README.md`, spec mục 7 (phím quay video = P).
- [ ] README: mục "Chơi bằng cơ thể" (C, calibration, tư thế nghiêng, V, P, F3, pause khi ra khỏi khung). Spec 7: ghi phím P và lý do (R là đấu lại).
- [ ] Commit `docs: body-control play instructions`.
