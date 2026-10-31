# Phase 1 – Motion Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng nền tảng dự án và trang Motion Lab: webcam → MediaPipe → nhận diện 8 nhóm động tác → hiển thị chia đôi màn hình, ghi/phát lại phiên, quay video, đo độ trễ và độ chính xác.

**Architecture:** Lõi `src/motion/` là TS thuần nhận `PoseFrame` và trả `ControlFrame`; mọi thứ chạm DOM/MediaPipe (`camera.ts`, `poseTracker.ts`, `src/view`, `src/recording`, `src/lab`) nằm ở lớp ngoài. Recognizer được viết theo TDD bằng chuỗi pose giả lập (`tests/helpers/synthPose.ts`). Độ chính xác trên dữ liệu thật đo bằng `npm run eval`.

**Tech Stack:** Vite 6, TypeScript 5 (strict), Vitest 3, `@mediapipe/tasks-vision`, `tsx` (chạy script Node), Python 3.11 trong `.venv` (numpy, pandas, matplotlib, pytest, jupyter).

**Spec:** `docs/superpowers/specs/2026-10-31-body-fighter-design.md` (mục 2, 3, 4, 5, 10, 11).

## Global Constraints

- TypeScript `strict: true`; không dùng `any` trong `src/motion/` và `src/shared/`.
- `src/motion/*` (trừ `camera.ts`, `poseTracker.ts`) và `src/shared/*` không được import DOM API hay `@mediapipe/*`.
- Trái/phải = giải phẫu của người chơi (quy ước landmark MediaPipe). Ảnh **không** lật gương trong dữ liệu; chỉ lật khi vẽ.
- Mọi ngưỡng lấy từ `src/motion/config.ts` (`DEFAULT_CONFIG`), không hard-code trong recognizer.
- Python chỉ chạy trong `.venv` ở gốc repo (`.venv\Scripts\python`).
- `npm run check` (= `tsc --noEmit && vitest run`) phải xanh trước mỗi commit.
- Commit message kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Bố cục Lab: canvas 1280×720, panel webcam 480 px bên trái (đồng bộ với chế độ `split` của game).

## Review Focus

1. **Khung hình bị khựng / FPS không đều** (tab giật, 1 frame trễ 500 ms): vận tốc phải tính theo `dt` thật; khoảng trống > 250 ms phải reset lịch sử, không sinh punch/kick ma. → Test ở Task 6.
2. **Người chơi ra khỏi khung một phần giữa động tác** (chân ra mép ảnh khi đá): không phát event, state về mặc định, cần 300 ms `ok` mới chạy lại. → Test ở Task 10.
3. **Người chơi tiến/lùi xa camera sau khi calibrate** (tỉ lệ cơ thể đổi): engine báo `needsRecalibration` khi `torsoPx` lệch > 25% so với calibration, Lab hiện cảnh báo. → Test ở Task 10.
4. **File phiên hỏng / sai version** khi kéo thả: báo lỗi rõ ràng, không crash Lab. → Test ở Task 11.
5. **Từ chối quyền camera / không có camera**: Lab vẫn mở được, hiện hướng dẫn, chức năng phát lại phiên vẫn dùng được. → Checklist thủ công ở Task 14.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `lab.html` | Scaffold, multi-page |
| `scripts/fetch-models.ts` | Tải model `.task` + copy WASM MediaPipe vào `public/` |
| `src/shared/types.ts` | Kiểu ở spec mục 4 |
| `src/shared/math.ts` | Vector/góc/thống kê |
| `src/motion/landmarks.ts` | Hằng số chỉ số landmark |
| `src/motion/config.ts` | `MotionConfig` + `DEFAULT_CONFIG` |
| `src/motion/oneEuro.ts` | Bộ lọc One Euro + `PoseSmoother` |
| `src/motion/tracking.ts` | `trackingStatusOf`, `TrackingGate` |
| `src/motion/calibration.ts` | `Calibration`, `Calibrator` |
| `src/motion/features.ts` | `Features`, `FeatureExtractor` |
| `src/motion/recognizers/*.ts` | punch, kick, jump, block, crouch, dodge, move |
| `src/motion/motionEngine.ts` | Ghép pipeline + xử lý xung đột |
| `src/motion/session/{format,replay}.ts` | Định dạng phiên, phát lại |
| `src/motion/session/recorder.ts` | Ghi `PoseFrame` + nhãn |
| `src/motion/eval.ts` | So khớp event với nhãn → precision/recall |
| `src/motion/camera.ts`, `src/motion/poseTracker.ts` | I/O trình duyệt |
| `src/view/webcamPanel.ts` | Vẽ webcam + skeleton + nhãn |
| `src/recording/videoRecorder.ts` | Quay canvas → webm |
| `src/lab/*` | Trang Motion Lab |
| `scripts/eval.ts` | CLI eval + dump feature CSV |
| `tools/*` | Python phân tích |
| `tests/**` | Vitest; `tests/helpers/synthPose.ts` |

---

### Task 1: Scaffold dự án + tải model

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `lab.html`, `src/main.ts`, `src/lab/main.ts`, `scripts/fetch-models.ts`, `tests/smoke.test.ts`
- Modify: `.gitignore` (thêm `public/mediapipe/`)

**Interfaces:**
- Produces: scripts `dev`, `build`, `test` (`vitest run`), `check` (`tsc --noEmit && vitest run`), `setup` (`tsx scripts/fetch-models.ts`), `eval` (`tsx scripts/eval.ts`). Đường dẫn runtime: `/models/pose_landmarker_{full,lite}.task`, `/mediapipe/wasm/`.

- [ ] **Step 1:** `npm init -y`; cài `vite typescript vitest tsx @types/node` (dev) và `@mediapipe/tasks-vision`. `package.json` có `"type": "module"`.
- [ ] **Step 2:** `tsconfig.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `lib ["ES2022","DOM","DOM.Iterable"]`, `include ["src","tests","scripts"]`, `noEmit`. `vite.config.ts`: `build.rollupOptions.input = { main: 'index.html', lab: 'lab.html' }`, `test.environment = 'node'`.
- [ ] **Step 3:** `index.html` hiển thị "BODY FIGHTER – coming soon" và link tới `lab.html`. `lab.html` có `<div id="app">` và nạp `src/lab/main.ts` (tạm in "Motion Lab").
- [ ] **Step 4:** `scripts/fetch-models.ts`: tải về `public/models/` hai URL `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_{full|lite}/float16/latest/pose_landmarker_{full|lite}.task` (bỏ qua nếu đã có), copy `node_modules/@mediapipe/tasks-vision/wasm/*` → `public/mediapipe/wasm/`.
- [ ] **Step 5:** `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 6:** Chạy `npm run setup` → có 2 file `.task` (> 1 MB) và thư mục wasm. Chạy `npm run check` → PASS. Chạy `npm run build` → tạo `dist/index.html` và `dist/lab.html`.
- [ ] **Step 7:** Commit `chore: scaffold vite+ts+vitest project and model fetch script`.

### Task 2: Kiểu dữ liệu, toán học, landmark, config

**Files:**
- Create: `src/shared/types.ts`, `src/shared/math.ts`, `src/motion/landmarks.ts`, `src/motion/config.ts`
- Test: `tests/shared/math.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: đúng như spec mục 4 (`Landmark`, `PoseFrame`, `DiscreteAction`, `ActionEvent`, `ControlState`, `TrackingStatus`, `ControlFrame`) + `type LR<T> = { l: T; r: T }`, `const DEFAULT_STATE: ControlState` (tất cả false/0).
  - `math.ts`: `type Vec3 = {x:number;y:number;z:number}`; `sub(a,b)`, `dist(a,b): number` (3D), `dist2d(a,b)`, `mid(a,b): Vec3`, `angleDeg(a,b,c): number` (góc tại b, 0..180), `clamp01(x)`, `median(xs: number[]): number`, `percentile(xs: number[], p: number): number` (nội suy tuyến tính, p ∈ [0,100]).
  - `landmarks.ts`: `LM = { NOSE:0, L_SHOULDER:11, R_SHOULDER:12, L_ELBOW:13, R_ELBOW:14, L_WRIST:15, R_WRIST:16, L_HIP:23, R_HIP:24, L_KNEE:25, R_KNEE:26, L_ANKLE:27, R_ANKLE:28 } as const`; `KEY_JOINTS` = vai, hông, gối, mắt cá (8 chỉ số).
  - `config.ts`: `MotionConfig` + `DEFAULT_CONFIG` với **đúng** các giá trị:
    ```ts
    oneEuro:   { minCutoff: 1.0, beta: 0.02, dCutoff: 1.0 }
    tracking:  { visibilityMin: 0.5, edgeMargin: 0.02, resumeDebounceMs: 300, gapResetMs: 250 }
    calibration: { frames: 45, hipStableMax: 0.03, recalibrateRatio: 0.25 }
    punch:  { extOn: 0.80, velOn: 2.5, elbowMinDeg: 140, extOff: 0.55, refractoryMs: 180 }
    kick:   { liftOn: 0.35, otherFootMax: 0.10, velOn: 1.5, liftOff: 0.15, hipRiseMax: 0.06, refractoryMs: 350 }
    jump:   { riseOn: 0.12, startMax: 0.03, windowMs: 300, landOff: 0.05, refractoryMs: 500 }
    block:  { wristNoseMax: 0.7, holdMs: 100, releaseMs: 120 }
    crouch: { dropOn: 0.25, holdMs: 120, dropOff: 0.15 }
    dodge:  { leanOnDeg: 15, hipDxMax: 0.30, leanOffDeg: 8 }
    move:   { on: 0.45, off: 0.30 }
    event:  { minConfidence: 0.5, baseConfidence: 0.6 }
    ```

- [ ] **Step 1: Test** `tests/shared/math.test.ts`: `angleDeg` của (1,0,0)-(0,0,0)-(0,1,0) = 90 (±1e-9), thẳng hàng = 180; `median([3,1,2]) = 2`, `median([1,2,3,4]) = 2.5`; `percentile([1..100], 95) ≈ 95.05`; `clamp01(-1)=0, clamp01(2)=1`.
- [ ] **Step 2:** `npx vitest run tests/shared/math.test.ts` → FAIL (module không tồn tại).
- [ ] **Step 3:** Viết 4 file theo Interfaces.
- [ ] **Step 4:** `npm run check` → PASS.
- [ ] **Step 5:** Commit `feat(shared): core types, math helpers, landmark ids, motion config`.

### Task 3: Bộ sinh pose giả lập (test helper)

**Files:**
- Create: `tests/helpers/synthPose.ts`
- Test: `tests/helpers/synthPose.test.ts`

**Interfaces:**
- Consumes: `PoseFrame`, `LM`, `Vec3`.
- Produces:
  ```ts
  type ArmPose = { ext: number; dir: 'down' | 'forward' | 'side' | 'guard' };   // ext 0..1 = |wrist-shoulder|/(upper+fore)
  type SynthParams = {
    hipX: number; hipY: number;          // tâm hông trên ảnh (0..1); mặc định 0.5, 0.55
    scale: number;                       // px-ảnh chuẩn hoá trên 1 m; mặc định 0.25
    lean: number;                        // độ, + = nghiêng sang phải người chơi
    hipDrop: number;                     // m hạ hông (crouch), giữ mắt cá trên sàn
    jump: number;                        // m nâng toàn thân
    armL: ArmPose; armR: ArmPose;
    liftL: number; liftR: number;        // m nâng mắt cá
    visibility: number;                  // mặc định 0.99
    hidden?: number[];                   // chỉ số landmark visibility = 0.1
  };
  const DEFAULT_SYNTH: SynthParams;      // đứng thủ thế: armL/armR = {ext:0.45, dir:'guard'}
  function synthFrame(p: Partial<SynthParams>, t: number, frameId?: number): PoseFrame;
  function synthSequence(keys: { t: number; p: Partial<SynthParams> }[], fps?: number): PoseFrame[]; // nội suy tuyến tính số; dir lấy theo key trước
  ```
  Cơ thể chuẩn (m): vai rộng 0.38, thân (vai→hông) 0.50, cánh tay 0.28, cẳng tay 0.26, đùi 0.45, ống chân 0.43, mũi cao hơn trung điểm vai 0.25. World: gốc ở tâm hông, y hướng xuống, z âm = hướng về camera; vai **trái** có x **lớn hơn** (giống ảnh thật không lật gương). Ảnh: `image.x = hipX + world.x·scale`, `image.y = hipY' + world.y·scale`, với `hipY' = hipY − jump·scale + hipDrop·scale`. World luôn lấy gốc ở hông; `hipDrop` làm gối gập để mắt cá giữ nguyên trên sàn ảnh, còn `jump` dịch cả người. `lean` xoay các điểm phần thân trên quanh tâm hông. `dir:'forward'` duỗi về −z, `'side'` duỗi ra ngoài theo ±x, `'guard'` cổ tay cạnh mũi, `'down'` buông dọc thân. Khuỷu đặt sao cho tam giác vai–khuỷu–cổ tay đúng chiều dài đoạn.

- [ ] **Step 1: Test:** với `synthFrame({armL:{ext:0.9,dir:'forward'}},0)`: `dist(world[L_SHOULDER], world[L_WRIST]) / 0.54 ≈ 0.9` (±0.01) và `world[L_WRIST].z < world[L_SHOULDER].z`; `image[L_SHOULDER].x > image[R_SHOULDER].x`; `{jump:0.2}` làm `image[L_ANKLE].y` nhỏ hơn mặc định đúng `0.2*scale` (±1e-6); `synthSequence` 2 key cách 1000 ms ở 30 fps trả 31 frame, `t` tăng đều.
- [ ] **Step 2:** Chạy test → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** Chạy test → PASS; `npm run check` → PASS.
- [ ] **Step 5:** Commit `test: synthetic pose generator for recognizer TDD`.

### Task 4: One Euro filter và tracking status

**Files:**
- Create: `src/motion/oneEuro.ts`, `src/motion/tracking.ts`
- Test: `tests/motion/oneEuro.test.ts`, `tests/motion/tracking.test.ts`

**Interfaces:**
- Produces:
  - `class OneEuroFilter { constructor(minCutoff, beta, dCutoff); filter(x: number, tMs: number): number; reset(): void }` (công thức chuẩn Casiez 2012, dt theo giây).
  - `class PoseSmoother { constructor(cfg: MotionConfig['oneEuro']); smooth(f: PoseFrame): PoseFrame; reset(): void }`: lọc x, y, z của cả `image` và `world`; visibility giữ nguyên.
  - `function trackingStatusOf(f: PoseFrame | null, cfg: MotionConfig['tracking']): TrackingStatus`, xét theo thứ tự: `null`/rỗng → `no_person`; khớp trong `KEY_JOINTS` có visibility < 0.5 → `partial`; khớp chính có image x hoặc y < 0.02 hoặc > 0.98 → `out_of_frame`; còn lại → `ok`.
  - `class TrackingGate { constructor(cfg); update(status: TrackingStatus, t: number): boolean }` trả `true` (cho phép nhận diện) chỉ khi status `ok` liên tục ≥ 300 ms kể từ lần không-ok gần nhất. Lần đầu tiên gặp `ok` (chưa từng mất) cho phép ngay.

- [ ] **Step 1: Test:** One Euro: tín hiệu hằng 5.0 → output 5.0; tín hiệu 5.0 + nhiễu ±0.05 (seed cố định) → độ lệch chuẩn đầu ra < 50% đầu vào; bước nhảy 0→1 → sau 10 frame (30 fps) output > 0.9. Tracking: các case của 4 status (dùng `synthFrame` + `hidden` + `hipX:0.01`); `TrackingGate`: ok@0 → true; partial@100 → false; ok@200 → false; ok@450 → false; ok@500 → true.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** Chạy → PASS.
- [ ] **Step 5:** Commit `feat(motion): one-euro smoothing and tracking status gate`.

### Task 5: Calibration

**Files:**
- Create: `src/motion/calibration.ts`
- Test: `tests/motion/calibration.test.ts`

**Interfaces:**
- Consumes: `trackingStatusOf`, `median`, `LM`.
- Produces:
  ```ts
  type Calibration = {
    hipX: number; hipY: number; ankleYL: number; ankleYR: number;      // ảnh
    torsoPx: number; shoulderPx: number; legPx: number;                 // ảnh (chuẩn hoá)
    upperArm: LR<number>; foreArm: LR<number>;                          // world m
  };
  type CalibrationProgress = { status: TrackingStatus | 'calibrating' | 'ready'; progress: number; calibration?: Calibration };
  class Calibrator { constructor(cfg: MotionConfig); push(f: PoseFrame | null): CalibrationProgress; reset(): void }
  ```
  Đếm frame liên tiếp có status `ok` và |hipX − hipX của frame đầu chuỗi| < 0.03 (hipStableMax, theo toạ độ ảnh). Gặp vi phạm thì đếm lại từ 0. Đủ 45 frame → `ready` + `calibration` = trung vị từng đại lượng. `progress = count/45`. `legPx` = trung bình |hông→mắt cá| hai bên trên ảnh.

- [ ] **Step 1: Test:** 45 frame `synthFrame({})` → frame thứ 45 trả `ready`, `torsoPx ≈ 0.5*0.25` (±1e-3), `shoulderPx ≈ 0.38*0.25`, `upperArm.l ≈ 0.28`; 30 frame ổn định + 1 frame `hipX: 0.6` → progress về 0; frame `null` → status `no_person`, progress 0.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS.
- [ ] **Step 5:** Commit `feat(motion): neutral-pose calibration`.

### Task 6: Feature extractor

**Files:**
- Create: `src/motion/features.ts`
- Test: `tests/motion/features.test.ts`

**Interfaces:**
- Consumes: `Calibration`, `PoseFrame`, math, `LM`.
- Produces:
  ```ts
  type Features = {
    t: number; dt: number;                  // ms
    hipDx: number;                          // (cal.hipX - hipX)/shoulderPx, + = sang phải người chơi
    hipDy: number;                          // (hipY - cal.hipY)/torsoPx, + = hạ xuống
    lean: number;                           // độ; + = thân nghiêng sang phải người chơi
    torsoScale: number;                     // torsoPx hiện tại / cal.torsoPx
    armExt: LR<number>; armExtVel: LR<number>; elbowAngle: LR<number>;
    wristNose: LR<number>;                  // dist2d(cổ tay, mũi)/shoulderPx
    wristAboveShoulder: LR<boolean>;
    wristInStrikeZone: LR<boolean>;         // y cổ tay nằm giữa hông và (mũi − 0.5·torsoPx)
    ankleLift: LR<number>; ankleLiftVel: LR<number>;   // (cal.ankleY - ankleY)/legPx, đơn vị/giây
    vis: { armL: number; armR: number; legL: number; legR: number; torso: number };  // visibility trung bình
  };
  class FeatureExtractor { constructor(cal: Calibration, cfg: MotionConfig); update(f: PoseFrame): Features; reset(): void }
  ```
  `armExt` dùng **world** (3D). Vận tốc = (giá trị hiện tại − giá trị cách 2 frame) / Δt thật (giây). Nếu `f.t − tPrev > gapResetMs (250)` thì xoá lịch sử, vận tốc = 0 cho frame đó.

- [ ] **Step 1: Test:**
  - Đứng yên (`DEFAULT_SYNTH`): |hipDx|, |hipDy|, |lean| < 0.01; `armExt.l ≈ 0.45`; vận tốc ≈ 0.
  - `armL {ext:0.9, dir:'forward'}` → `armExt.l ≈ 0.9` (±0.02), `elbowAngle.l > 150`.
  - Chuỗi duỗi `ext` 0.45→0.95 trong 100 ms (30 fps) → max `armExtVel.l > 2.5`.
  - `lean: 20` → `lean ≈ 20` (±2); `hipX = 0.5 − 0.5·0.38·0.25` (dịch sang phải người chơi nửa vai) → `hipDx ≈ 0.5` (±0.02).
  - `hipDrop: 0.15` → `hipDy ≈ 0.15/0.5 = 0.3` (±0.03).
  - **[Review Focus 1]** Chuỗi ext 0.45 @t=0 rồi 0.95 @t=500 (khoảng trống 500 ms, không frame giữa) → `armExtVel.l === 0` ở frame t=500.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS.
- [ ] **Step 5:** Commit `feat(motion): feature extraction (body-normalized, dt-aware velocities)`.

### Task 7: Punch recognizer

**Files:**
- Create: `src/motion/recognizers/punch.ts`, `src/motion/recognizers/confidence.ts`
- Test: `tests/motion/recognizers/punch.test.ts`

**Interfaces:**
- Consumes: `Features`, `MotionConfig`.
- Produces:
  - `confidence.ts`: `eventConfidence(vis: number, primary: number, on: number, cfg: MotionConfig['event']): number` = `vis * clamp01(baseConfidence + 0.4 * (primary - on) / on)`.
  - `class PunchRecognizer { constructor(side: 'l'|'r', cfg: MotionConfig); update(f: Features, frameId: number): ActionEvent | null; reset(): void }` (mọi recognizer event dùng chữ ký `update(f, frameId)` này). State `idle → fired` (fired khi `armExt > 0.80 && armExtVel > 2.5 && elbowAngle > 140 && wristInStrikeZone` và đã qua refractory 180 ms) → về `idle` khi `armExt < 0.55`. Event `{action:'punch_l'|'punch_r', confidence: eventConfidence(vis.armX, armExtVel, 2.5, …), t: f.t, frameId}`.

- [ ] **Step 1: Test** (chuỗi synth → `FeatureExtractor` → recognizer):
  - jab trái nhanh (0.45→0.95→0.45 trong 300 ms) → đúng **1** event `punch_l`, `confidence ≥ 0.5`; không có `punch_r`.
  - duỗi chậm (0.45→0.95 trong 1500 ms) → 0 event.
  - giữ tay duỗi 2 s sau cú đấm → vẫn chỉ 1 event.
  - 3 cú liên tiếp cách nhau 400 ms → 3 event.
  - tay duỗi `dir:'down'` (ngoài strike zone) → 0 event.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS.
- [ ] **Step 5:** Commit `feat(motion): punch recognizer`.

### Task 8: Kick và Jump recognizer

**Files:**
- Create: `src/motion/recognizers/kick.ts`, `src/motion/recognizers/jump.ts`
- Test: `tests/motion/recognizers/kick.test.ts`, `tests/motion/recognizers/jump.test.ts`

**Interfaces:**
- Consumes: `Features`, `Calibration`, `eventConfidence`.
- Produces:
  - `class KickRecognizer { constructor(side, cfg); update(f: Features, frameId: number): ActionEvent | null; reset() }`: fire khi `ankleLift[side] > 0.35 && ankleLift[other] < 0.10 && ankleLiftVel[side] > 1.5 && hipDy > -0.06`; reset khi `ankleLift[side] < 0.15`; refractory 350 ms.
  - `class JumpRecognizer { constructor(cal: Calibration, cfg); update(f, frameId): ActionEvent | null; isAirborne(): boolean; reset() }`: ngưỡng mắt cá tính theo đơn vị chân `riseOn * cal.torsoPx / cal.legPx`. Fire khi `-hipDy > 0.12` và cả hai `ankleLift` vượt ngưỡng đã quy đổi, đồng thời trong 300 ms trước đó có frame với `-hipDy < 0.03`. Airborne cho đến khi `-hipDy < 0.05`; refractory 500 ms.

- [ ] **Step 1: Test:**
  - Kick (chân dài 0.88 m nên `ankleLift` = lift/0.88): nâng `liftR` 0→0.45 m (≈0.51) trong 200 ms rồi hạ → 1 `kick_r`; nâng chậm 2 s → 0; giữ chân trên cao 1 s → vẫn 1.
  - Jump: `jump` 0→0.10 m (= 0.2 torso) trong 150 ms rồi về 0 → 1 `jump`, `isAirborne()` true ở đỉnh, false sau khi tiếp đất; trong cùng chuỗi đó `KickRecognizer` L và R đều trả 0 event; nâng hông chậm (1 s) → 0 jump.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS.
- [ ] **Step 5:** Commit `feat(motion): kick and jump recognizers`.

### Task 9: State recognizer (block, crouch, dodge, move)

**Files:**
- Create: `src/motion/recognizers/states.ts`
- Test: `tests/motion/recognizers/states.test.ts`

**Interfaces:**
- Produces: `class StateRecognizer { constructor(cfg); update(f: Features): ControlState; reset() }` với quy tắc ở spec 5.3:
  - block: cả hai `wristAboveShoulder` và `wristNose < 0.7`, giữ ≥ 100 ms mới bật; mất điều kiện ≥ 120 ms mới tắt.
  - crouch: `hipDy > 0.25` giữ ≥ 120 ms; tắt khi `hipDy < 0.15`.
  - dodge: `|lean| > 15 && |hipDx| < 0.30` → `sign(lean)`; tắt khi `|lean| < 8`.
  - move: `|hipDx| > 0.45` → `sign(hipDx)`; tắt khi `|hipDx| < 0.30`.

- [ ] **Step 1: Test:** guard cao hai tay (`dir:'guard'` + tay sát mũi) giữ 200 ms → block bật ở khoảng frame ≥ 100 ms, không bật ở frame 66 ms; hạ tay → tắt sau ≥ 120 ms. `hipDrop 0.15` → crouch true sau 120 ms. `lean 20` → dodge = 1; `lean -20` → −1; `lean 20` + `hipDx 0.6` → dodge 0, move 1. `hipDx` 0.5 → 0.35 → vẫn move 1 (hysteresis); 0.25 → 0.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS.
- [ ] **Step 5:** Commit `feat(motion): continuous state recognizers with hysteresis`.

### Task 10: MotionEngine

**Files:**
- Create: `src/motion/motionEngine.ts`
- Test: `tests/motion/motionEngine.test.ts`

**Interfaces:**
- Consumes: mọi thứ từ Task 4–9.
- Produces:
  ```ts
  type EngineOutput = ControlFrame & { latencyMs: number | null; needsRecalibration: boolean; features: Features | null };
  class MotionEngine {
    constructor(cfg?: MotionConfig);
    setCalibration(cal: Calibration | null): void;     // reset toàn bộ recognizer
    feed(f: PoseFrame | null, now: number): EngineOutput;
    reset(): void;
  }
  ```
  Thứ tự: smoother → `trackingStatusOf` → `TrackingGate`. Nếu gate đóng **hoặc** chưa có calibration: `events: []`, `state: DEFAULT_STATE`, reset recognizer. Ngược lại: features → recognizer. Xử lý xung đột: bỏ punch khi `state.block`; bỏ jump khi `state.crouch`; bỏ event có `confidence < 0.5`. `t` của ControlFrame = `f.t`; `latencyMs = now − f.t` nếu có event, ngược lại null. `needsRecalibration = |torsoScale − 1| > 0.25`.

- [ ] **Step 1: Test:**
  - Chưa calibrate → không event dù đấm.
  - Calibrate (từ `Calibrator` trên 45 frame synth) rồi đấm trái → 1 `punch_l`, `latencyMs = now − t`.
  - Đang block (guard 200 ms) rồi duỗi tay trái → 0 punch.
  - Crouch rồi nhảy → 0 jump.
  - **[Review Focus 2]** Giữa cú đá, frame có `hidden: [LM.R_ANKLE, LM.R_KNEE]` → status `partial`, events rỗng, state mặc định. Frame `ok` trở lại ở t+100 vẫn chưa nhận diện; ở t+350 thì nhận lại.
  - **[Review Focus 3]** `scale` 0.25 → 0.33 (tiến lại gần) → `needsRecalibration === true`; 0.27 → false.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS.
- [ ] **Step 5:** Commit `feat(motion): motion engine composing tracking, features and recognizers`.

### Task 11: Định dạng phiên, ghi, phát lại và eval

**Files:**
- Create: `src/motion/session/format.ts`, `src/motion/session/recorder.ts`, `src/motion/session/replay.ts`, `src/motion/eval.ts`, `scripts/eval.ts`
- Test: `tests/motion/session.test.ts`, `tests/motion/eval.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type LabelAction = DiscreteAction | 'block' | 'crouch' | 'dodge_l' | 'dodge_r' | 'move_l' | 'move_r' | 'idle';
  type Label = { action: LabelAction; tStart: number; tEnd: number; expectedCount?: number };
  type Session = { version: 1; createdAt: string; width: number; height: number; model: 'full' | 'lite';
                   calibration: Calibration | null; labels: Label[]; frames: PoseFrame[] };
  function serializeSession(s: Session): string;          // làm tròn số 4 chữ số thập phân
  function parseSession(text: string): Session;           // throw SessionFormatError(message) nếu JSON hỏng / version ≠ 1 / thiếu frames
  class SessionRecorder { start(meta: Omit<Session,'frames'|'labels'|'version'>): void; addFrame(f: PoseFrame): void; addLabel(l: Label): void; stop(): Session; get recording(): boolean }
  function replaySession(s: Session, engine?: MotionEngine): EngineOutput[];   // calibrate bằng s.calibration, nếu null thì chạy Calibrator trên các frame đầu; now = f.t
  type ActionScore = { tp: number; fp: number; fn: number; precision: number; recall: number };
  function evaluate(outputs: EngineOutput[], labels: Label[], toleranceMs?: number): Record<DiscreteAction, ActionScore>;
  ```
  Luật `evaluate` (chỉ cho action rời rạc): event cùng loại rơi vào `[tStart, tEnd + 300]` của một label tính là TP, tối đa `expectedCount` (mặc định 1) TP mỗi label; phần dư và event ngoài mọi label cùng loại là FP. FN = `expectedCount` − TP. Label `idle` không tạo FN; event trong cửa sổ idle là FP. Precision/recall khi mẫu số 0 thì = 1.
  `scripts/eval.ts`: đọc mọi `fixtures/sessions/*.json` (và `.json.gz` qua `zlib`), in bảng precision/recall từng action; cờ `--dump <dir>` ghi `<tên>.features.csv` (cột: t + mọi trường số của Features, LR tách `_l/_r`) và `<tên>.labels.json`.

- [ ] **Step 1: Test:** serialize→parse giữ nguyên dữ liệu (sai số ≤ 1e-4); `parseSession('{')` và `parseSession('{"version":2}')` throw `SessionFormatError` **[Review Focus 4]**; replay một session synth có 3 cú đấm trái + label `{punch_l, expectedCount:3}` → `evaluate` cho `punch_l` precision 1, recall 1; thêm 1 event giả trong cửa sổ `idle` → fp 1.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS.
- [ ] **Step 5:** `npm run eval` khi `fixtures/sessions/` rỗng → in "No sessions found" và exit 0.
- [ ] **Step 6:** Commit `feat(motion): session format, replay and accuracy evaluation`.

### Task 12: Python tooling trong `.venv`

**Files:**
- Create: `tools/requirements.txt`, `tools/analyze_session.py`, `tools/tests/test_analyze.py`, `tools/README.md`

**Interfaces:**
- Consumes: CSV và labels JSON từ `npm run eval -- --dump <dir>`.
- Produces: `python tools/analyze_session.py <features.csv> <labels.json> [--out plot.png] [--cols armExt_l,armExtVel_l,...]`: vẽ mỗi cột một subplot theo t, tô vùng label theo màu action, đường ngang ngưỡng nếu cột có trong bảng `THRESHOLDS` (sao từ `DEFAULT_CONFIG`). Hàm `load(csv, labels) -> (pd.DataFrame, list[dict])` và `plot(df, labels, cols, out)`.

- [ ] **Step 1:** `python -m venv .venv`; `requirements.txt`: `numpy`, `pandas`, `matplotlib`, `pytest`, `jupyter`; `.venv\Scripts\python -m pip install -r tools/requirements.txt`.
- [ ] **Step 2: Test** `tools/tests/test_analyze.py`: tạo CSV 30 dòng + labels tạm (`tmp_path`), gọi `plot(...)` → file PNG tồn tại và > 0 byte; `load` trả DataFrame có cột `t`.
- [ ] **Step 3:** `.venv\Scripts\python -m pytest tools/tests -q` → FAIL.
- [ ] **Step 4:** Cài đặt; chạy lại → PASS. `tools/README.md`: lệnh tạo venv, dump, vẽ.
- [ ] **Step 5:** Commit `chore(tools): python venv analysis script for session features`.

### Task 13: Camera, PoseTracker, WebcamPanel, VideoRecorder

**Files:**
- Create: `src/motion/camera.ts`, `src/motion/poseTracker.ts`, `src/view/webcamPanel.ts`, `src/recording/videoRecorder.ts`
- Test: `tests/motion/poseTracker.test.ts`, `tests/view/webcamPanel.test.ts`, `tests/recording/videoRecorder.test.ts`

**Interfaces:**
- Produces:
  - `camera.ts`: `listCameras(): Promise<MediaDeviceInfo[]>`; `openCamera(deviceId?: string): Promise<HTMLVideoElement>` (ideal 1280×720, 30 fps); throw `CameraError` với `kind: 'denied' | 'not_found' | 'other'`.
  - `poseTracker.ts`: `toPoseFrame(result: { landmarks: Landmark[][]; worldLandmarks: Landmark[][] }, frameId: number, t: number): PoseFrame | null` (thuần, test được; lấy người đầu tiên); `class PoseTracker { static create(model: 'full'|'lite'): Promise<PoseTracker>; readonly delegate: 'GPU'|'CPU'; start(video, onFrame: (f: PoseFrame | null, inferMs: number) => void): void; stop(): void; close(): void }`. `create` dùng `FilesetResolver.forVisionTasks('/mediapipe/wasm')`, `numPoses: 1`, `runningMode: 'VIDEO'`; thử GPU, lỗi thì CPU. Vòng lặp `video.requestVideoFrameCallback`, `t = metadata.captureTime ?? metadata.expectedDisplayTime`, bỏ frame khi đang xử lý.
  - `webcamPanel.ts`: `class ActionLabelTimer { constructor(durationMs = 600); push(e: ActionEvent): void; current(now: number): ActionEvent | null }` (event mới thay event cũ); `drawWebcamPanel(ctx: CanvasRenderingContext2D, rect: {x,y,w,h}, video: HTMLVideoElement | null, frame: PoseFrame | null, out: EngineOutput | null, label: ActionEvent | null): void`: video lật gương (object-fit cover), skeleton (khớp xanh nếu vis ≥ 0.5, đỏ nếu thấp), badge tracking status (tiếng Việt: "Không thấy người chơi", "Chưa thấy toàn thân", "Ra ngoài khung hình", "OK"), nhãn động tác chữ lớn (PUNCH L…), các chip BLOCK / CROUCH / DODGE ◄► / MOVE ◄►, cảnh báo "Cần hiệu chỉnh lại" khi `needsRecalibration`.
  - `videoRecorder.ts`: `pickMimeType(isSupported: (t: string) => boolean): string | null` theo thứ tự `video/webm;codecs=vp9,opus` → `video/webm;codecs=vp8,opus` → `video/webm`; `recordingFilename(d: Date): string` = `bodyfighter-YYYYMMDD-HHmmss.webm` (giờ local); `class VideoRecorder { static isAvailable(): boolean; start(canvas: HTMLCanvasElement, audio?: MediaStream): void; stop(): Promise<Blob>; get recording(): boolean; elapsedMs(now: number): number }`, `captureStream(30)`; `downloadBlob(blob, filename)`.

- [ ] **Step 1: Test** (phần thuần): `toPoseFrame` với 0 người → null, với 1 người → 33 landmark và đúng `t`; `ActionLabelTimer` hiện event trong 600 ms rồi null, event mới thay thế; `pickMimeType` chỉ hỗ trợ vp8 → trả vp8, không hỗ trợ gì → null; `recordingFilename(new Date(2026,9,31,14,5,9))` = `bodyfighter-20261031-140509.webm`.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS. `npm run check` PASS.
- [ ] **Step 5:** Commit `feat: camera, pose tracker, webcam panel and video recorder`.

### Task 14: Trang Motion Lab – pipeline live, calibration, debug panel

**Files:**
- Create: `src/lab/main.ts` (thay bản tạm), `src/lab/labApp.ts`, `src/lab/debugPanel.ts`, `src/lab/latencyStats.ts`, `src/lab/style.css`
- Test: `tests/lab/latencyStats.test.ts`

**Interfaces:**
- Consumes: Task 10, 11, 13.
- Produces: `class LatencyStats { constructor(capacity = 200); add(ms: number): void; p50(): number | null; p95(): number | null }`; `class FpsCounter { tick(t: number): void; fps(): number }` (cửa sổ 1 s, cùng file).
  Lab: canvas 1280×720. Trái 480 px là `drawWebcamPanel`. Phải 800 px là debug panel vẽ trên cùng canvas, gồm: 20 event gần nhất (giờ, action, conf, latency); sparkline 5 s cho `armExt_l/r`, `ankleLift_l/r`, `lean`, `hipDx`, `hipDy` có vạch ngưỡng; FPS tracking; thời gian suy luận; latency p50/p95; delegate GPU/CPU. Thanh điều khiển HTML phía trên canvas: chọn camera, model full/lite (đổi thì tạo lại tracker), nút **Calibrate** (overlay dùng `Calibrator`, hiện lần lượt "Đang tìm người chơi" / "Chưa thấy toàn thân" / "Ra ngoài khung hình" / "Đang hiệu chỉnh" + thanh tiến độ / "Sẵn sàng"; lưu `localStorage['bf.calibration']`, tự nạp khi mở trang). Model mặc định lưu ở `localStorage['bf.model']` (mặc định `full`). Nếu tracker chạy GPU thất bại thì hiện chip "CPU". Tải model lỗi → thông báo kèm nút **Thử lại**. Lỗi camera (`CameraError`) → thông báo theo `kind` ("Bạn đã chặn quyền camera…", "Không tìm thấy camera…"), trang vẫn chạy.

- [ ] **Step 1: Test:** `LatencyStats` rỗng → null; thêm 1..100 → p50 ≈ 50.5, p95 ≈ 95.05; vượt capacity thì bỏ giá trị cũ nhất.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS.
- [ ] **Step 5: Kiểm tra thủ công** (`npm run dev` → `http://localhost:5173/lab.html`):
  - Camera hiển thị lật gương, có skeleton, FPS ≥ 25 (ghi lại số đo).
  - Calibrate: đứng thủ thế → thanh tiến độ → "Sẵn sàng"; F5 vẫn còn calibration.
  - Đấm/đá/nhảy/block/cúi/nghiêng/dịch ngang → nhãn và chip hiện đúng; log có latency.
  - Bước ra khỏi khung → badge đổi, không có event.
  - **[Review Focus 5]** Chặn quyền camera trong trình duyệt → hiện thông báo hướng dẫn, trang không crash, các nút điều khiển vẫn bấm được.
- [ ] **Step 6:** Commit `feat(lab): live motion lab with calibration and debug panel`.

### Task 15: Lab – quay video, ghi/phát lại phiên, guided capture

**Files:**
- Create: `src/lab/guidedCapture.ts`, `src/lab/sessionControls.ts`
- Modify: `src/lab/labApp.ts`
- Test: `tests/lab/guidedCapture.test.ts`

**Interfaces:**
- Consumes: `SessionRecorder`, `serializeSession`, `parseSession`, `replaySession`, `VideoRecorder`, `Label`.
- Produces:
  ```ts
  type CaptureStep = { action: LabelAction; prompt: string; durationMs: number; expectedCount?: number };
  const DEFAULT_SCRIPT: CaptureStep[];
  class GuidedCapture { constructor(script: CaptureStep[], restMs = 3000); start(t: number): void;
    update(t: number): { step: CaptureStep | null; phase: 'rest' | 'perform' | 'done'; remainingMs: number; newLabel?: Label } }
  ```
  `DEFAULT_SCRIPT`: mỗi action rời rạc (punch_l, punch_r, kick_l, kick_r, jump) "Làm X ×10" trong 25 s, `expectedCount: 10`; mỗi state (block, crouch, dodge_l, dodge_r, move_l, move_r) "Giữ X 3 giây" 6 s; cuối cùng `idle` "Di chuyển tự do, KHÔNG ra đòn" 60 s. Mỗi bước có 3 s nghỉ trước. `newLabel` được trả đúng một lần khi một bước perform kết thúc, với `tStart/tEnd` là cửa sổ perform.
  Nút trên Lab: **⏺ Record video** (quay canvas Lab, phím `R`, chấm đỏ + đồng hồ); **💾 Ghi phiên** (bật/tắt `SessionRecorder`, khi dừng tải `session-YYYYMMDD-HHmmss.json`); **🎯 Guided capture** (tự ghi phiên + nhãn, hiện prompt to trên panel webcam, xong thì tải file); **▶ Phát lại**: kéo thả hoặc chọn file `.json`, chạy `replaySession` theo thời gian thực, vẽ skeleton trên nền đen; nếu file có nhãn thì hiện bảng `evaluate` ngay trong debug panel. File lỗi → hiện thông báo `SessionFormatError.message`.

- [ ] **Step 1: Test:** script 2 bước (perform 1000 ms, rest 500 ms) start@0: t=200 → `rest`; t=600 → `perform` step 0; t=1500 → `newLabel` `{tStart:500,tEnd:1500}` trả đúng một lần (gọi lại t=1501 thì không còn); sau bước cuối → `done`.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS.
- [ ] **Step 5: Kiểm tra thủ công:** khi đã chặn quyền camera, phát lại phiên vẫn chạy (Review Focus 5); kéo vào một file `.json` hỏng → hiện thông báo lỗi, Lab vẫn chạy; quay 10 s video Lab → file `.webm` mở được, có cả webcam lẫn panel; ghi phiên 10 s → kéo lại vào Lab → phát lại khớp chuyển động; chạy một guided capture rút gọn (bỏ qua bằng phím `N`) → file có `labels`.
- [ ] **Step 6:** Commit `feat(lab): video recording, session record/replay and guided capture`.

### Task 16: Thu dữ liệu thật, tinh chỉnh, ghi kết quả (cần người dùng tham gia)

**Files:**
- Create: `fixtures/sessions/*.json.gz`, `README.md`
- Modify: `src/motion/config.ts` (ngưỡng sau tinh chỉnh), spec Phụ lục A

- [ ] **Step 1:** Người dùng chạy guided capture đầy đủ 2 lần: (a) đứng thẳng đối diện camera, (b) đứng nghiêng khoảng 45°. Nén gzip rồi lưu vào `fixtures/sessions/`.
- [ ] **Step 2:** `npm run eval` → ghi lại bảng baseline. `npm run eval -- --dump out/` rồi vẽ bằng `tools/analyze_session.py` cho các action chưa đạt.
- [ ] **Step 3:** Chỉnh ngưỡng trong `config.ts` cho tới khi mọi action rời rạc đạt precision ≥ 0.90, recall ≥ 0.85, phiên idle ≤ 2 FP mỗi loại. Mỗi lần đổi đều chạy `npm run check` (unit test synth vẫn phải xanh; nếu vỡ thì cập nhật test có lý do).
- [ ] **Step 4:** Điền Phụ lục A của spec: bảng precision/recall, latency p50/p95, FPS (full/lite), GPU/CPU, tư thế khuyến nghị. Nếu model `full` < 25 FPS trên máy người dùng thì đổi mặc định `bf.model` sang `lite` (spec 5.6).
- [ ] **Step 5:** `README.md`: giới thiệu, `npm install && npm run setup && npm run dev`, cách đặt camera (cao ngang hông, cách 2,5–3 m), cách đo glass-to-glass bằng quay slow-mo điện thoại, mục Python `.venv`.
- [ ] **Step 6:** Commit `chore: tuned thresholds from real sessions; record phase-1 results`.

---

**Điều kiện hoàn tất Phase 1:** Task 1–16 xong, `npm run check` xanh, Phụ lục A có số liệu đạt ngưỡng spec 5.6 (hoặc ghi rõ action nào chưa đạt kèm quyết định xử lý trước Phase 3).
