# BODY FIGHTER – Design Spec (MVP)

> Ngày: 2026-10-31 · Nguồn ý tưởng: `body_fighter_game_concept.md`
> Trạng thái: Draft chờ review

## 1. Mục tiêu và tiêu chí thành công

**Mục đích:** dự án portfolio / học tập cá nhân. Không có deadline cứng.

**Thành công khi:**
1. Có link web (GitHub Pages) để người khác bấm vào chơi được: đứng trước webcam, đánh hết một trận với NPC chỉ bằng cơ thể.
2. Có chế độ **chia đôi màn hình**: bên trái là webcam + skeleton + tên động tác vừa nhận diện, bên phải là trận đấu. Có **nút Record tích hợp** xuất file video, quay được cả hai bên đồng bộ.
3. Nhận diện ổn định 8 nhóm động tác (mục 5) theo các ngưỡng đo được ở mục 5.6.

**Ràng buộc đã biết:**
- Người chơi có phòng đủ rộng để camera thấy toàn thân (đứng cách khoảng 2,5–3 m).
- Thiết bị: laptop/PC phổ thông + webcam 720p, trình duyệt Chromium (Chrome/Edge) là mục tiêu chính.
- Chỉ cần đồ họa placeholder có phong cách. Sprite anime nằm ngoài MVP.

**Ngoài phạm vi MVP:** Story/Survival/Boss mode, progression, nhiều nhân vật/võ phái, 2 người chơi, mobile.

## 2. Quyết định kiến trúc

| Quyết định | Chọn | Lý do |
|---|---|---|
| Nền tảng | **Web, chạy hoàn toàn trên trình duyệt** | Link chia sẻ được; webcam và game cùng trang nên ghép video dễ; không có độ trễ IPC |
| Ngôn ngữ | TypeScript (strict) | Người dùng đã biết JS/TS |
| Build | Vite, multi-page: `index.html` (game), `lab.html` (Motion Lab) | Dev server nhanh, build tĩnh để deploy Pages |
| Pose | `@mediapipe/tasks-vision` PoseLandmarker, running mode `VIDEO`, delegate `GPU` (fallback `CPU`), model `pose_landmarker_full` (tùy chọn `lite`) | Bản chính thức, chạy WebGL/WASM |
| Game engine | Phaser 3 | 2D, scene, tween, particle, canvas duy nhất nên dễ quay |
| Test | Vitest | Chạy native với Vite/TS |
| Phân tích offline | Python 3.11 trong **`.venv` ở gốc repo** (numpy, pandas, matplotlib, jupyter) | Tận dụng kỹ năng Python để vẽ biểu đồ feature và tinh chỉnh ngưỡng |
| Đồ họa | Võ sĩ "neon stick-fighter" vẽ procedural bằng Phaser Graphics, khung xương có keyframe pose | Không cần asset pipeline; thay sprite sau được |
| Âm thanh | SFX tổng hợp bằng WebAudio (oscillator/noise envelope) | Không vướng bản quyền, không cần file |
| Deploy | GitHub Actions → GitHub Pages | Miễn phí, tự động |

**Nguyên tắc xuyên suốt:**
- **Lõi thuần (pure) tách khỏi I/O.** `motion/` (sau tầng camera), `game/sim/` và `game/ai/` là TS thuần, không đụng DOM hay Phaser, nên test được bằng Vitest. Phaser, DOM và MediaPipe chỉ nằm ở lớp ngoài cùng.
- **Một "hợp đồng" input duy nhất** (`ControlFrame`, mục 4) cho bàn phím, cơ thể và AI. NPC điều khiển võ sĩ theo đúng cách người chơi làm.
- **Thiết kế combat chịu được độ trễ khoảng 150 ms** (mục 6.3).

## 3. Cấu trúc repo

```
ko_motion/
├─ index.html  lab.html  package.json  vite.config.ts  tsconfig.json
├─ public/models/pose_landmarker_full.task, pose_landmarker_lite.task   (tải bằng scripts/fetch-models)
├─ src/
│  ├─ shared/        types.ts (ControlFrame, ActionEvent…), math.ts, rng.ts
│  ├─ motion/        camera.ts, poseTracker.ts, oneEuro.ts, features.ts, calibration.ts,
│  │                 tracking.ts, recognizers/{punch,kick,jump,block,crouch,dodge,move}.ts,
│  │                 motionEngine.ts, config.ts, session/{format,recorder,replay}.ts
│  ├─ recording/     videoRecorder.ts
│  ├─ view/          webcamPanel.ts (vẽ video + skeleton + nhãn động tác lên canvas 2D)
│  ├─ lab/           main.ts + các panel debug (Motion Lab)
│  └─ game/
│     ├─ sim/        fighter.ts, moves.ts, hit.ts, combo.ts, match.ts (fixed-step 60 Hz)
│     ├─ input/      keyboardInput.ts, motionInput.ts, aiInput.ts
│     ├─ ai/         fsm.ts, difficulty.ts, adaptive.ts
│     ├─ render/     stickFighter.ts, effects.ts, hud.ts, sfx.ts
│     └─ scenes/     Boot, Menu, Calibration, Fight, Training, Result
├─ tests/            khớp cấu trúc src/; tests/helpers/synthPose.ts
├─ fixtures/sessions/*.json(.gz)     phiên landmark đã ghi + nhãn
├─ scripts/          eval.ts (chạy recognizer trên fixtures → precision/recall), fetch-models.ts
├─ tools/            requirements.txt, analyze_session.py, notebooks/
└─ docs/superpowers/{specs,plans}/
```

## 4. Kiểu dữ liệu cốt lõi (`src/shared/types.ts`)

```ts
type Landmark = { x: number; y: number; z: number; visibility: number };
type PoseFrame = {
  frameId: number;
  t: number;                  // ms, thời điểm capture video frame (performance.now timeline)
  image: Landmark[];          // 33 điểm, toạ độ chuẩn hoá theo ảnh (0..1)
  world: Landmark[];          // 33 điểm, mét, gốc tại tâm hông
};

type DiscreteAction = 'punch_l' | 'punch_r' | 'kick_l' | 'kick_r' | 'jump';
type ActionEvent = { action: DiscreteAction; confidence: number; t: number; frameId: number };

type ControlState = {
  block: boolean;
  crouch: boolean;
  dodge: -1 | 0 | 1;          // -1 trái, 1 phải
  move: -1 | 0 | 1;
};

type TrackingStatus = 'no_person' | 'partial' | 'out_of_frame' | 'ok';

type ControlFrame = { t: number; events: ActionEvent[]; state: ControlState; tracking: TrackingStatus };
```

"Trái/phải" luôn theo **giải phẫu của người chơi** (đúng quy ước landmark của MediaPipe). Webcam được hiển thị lật gương. Trong game, nhân vật người chơi đứng bên trái và quay mặt sang phải; `move: 1` nghĩa là tiến về phía đối thủ khi người chơi dịch sang phải của chính mình (trên màn hình gương cũng là sang phải).

## 5. Phase 1 – Motion Lab và nhận diện chuyển động

### 5.1. Pipeline

```
camera.ts → poseTracker.ts → PoseFrame ─┬→ tracking.ts → TrackingStatus
                                        ├→ oneEuro (lọc từng toạ độ) → features.ts → Features
                                        │                                 └→ recognizers/* → events + state
                                        └→ session/recorder.ts (tuỳ chọn)
motionEngine.ts ghép tất cả: feed(PoseFrame) → ControlFrame
```

- `poseTracker` dùng `requestVideoFrameCallback` để lấy `captureTime` hoặc `expectedDisplayTime`, rồi gọi `detectForVideo`. Chỉ một frame được xử lý tại một thời điểm; frame đến khi đang bận thì bỏ.
- `motionEngine.feed()` là **hàm thuần theo chuỗi frame** (có state nội bộ, không I/O). `replay.ts` phát lại `PoseFrame[]` từ file JSON vào cùng engine, nên test và eval không cần camera.

### 5.2. Feature (`features.ts`)

Tính cho mỗi frame, sau khi lọc One Euro (minCutoff 1.0, beta 3 cho toạ độ world và imageBeta 15 cho toạ độ ảnh; chỉnh được trong `config.ts`. Beta 0.02 ban đầu làm trễ khoảng 11 frame và cắt mất đỉnh cú đấm; đã đổi ở Task 4 và Task 10 của plan Phase 1):
- **Thang đo cơ thể** (từ calibration): `torsoPx` (độ dài từ trung điểm vai đến trung điểm hông trên ảnh), `shoulderPx`, chiều dài tay và chân theo world.
- **Toàn cục (ảnh):** độ lệch tâm hông so với baseline: `hipDx` (chia cho `shoulderPx`) và `hipDy` (chia cho `torsoPx`, dương = hạ xuống); độ nâng mắt cá trái/phải so với baseline sàn (chia cho chiều dài chân trên ảnh).
- **Thân:** góc nghiêng thân `lean` = góc của vector hông→vai so với phương thẳng đứng; `shoulderDx` = độ lệch của trung điểm vai so với tâm hông.
- **Tay (ảnh, 2D):** `reach2d[L/R]` = khoảng cách cổ tay–vai trên ảnh (đơn vị vuông) / `torsoPx`. Khi đứng nghiêng, tay phía xa bị thân che nên 3D kém tin cậy, còn 2D cho tín hiệu rõ (thủ thế ~0.12, đỉnh cú đấm ~0.75).
- **Tay (world, 3D):** `armExt[L/R]` = |cổ tay − vai| / (cánh tay + cẳng tay); `elbowAngle[L/R]`; vận tốc `armExtVel` (đạo hàm qua 3 frame).
- **Chân (world + ảnh):** `ankleLift[L/R]`, `kneeAngle[L/R]`, vận tốc tương ứng.
- **Tay so với mặt:** khoảng cách cổ tay→mũi chia cho `shoulderPx`; cổ tay cao hơn vai hay không.

Dùng **world landmarks** cho độ duỗi tay. Toạ độ 3D có ước lượng z, nên cú đấm hướng về phía camera vẫn làm `armExt` tăng dù trên ảnh 2D tay gần như không dịch. Đây là cách xử lý rủi ro "đấm thẳng vào camera". Dùng **image landmarks** cho chuyển động toàn cục (jump, crouch, move), vì world landmarks lấy gốc ở hông nên không chứa thông tin dịch chuyển toàn thân.

### 5.3. Recognizer

Mỗi recognizer là một state machine nhỏ, ngưỡng nằm trong `config.ts`. Giá trị ban đầu bên dưới là điểm xuất phát, sẽ tinh chỉnh bằng dữ liệu ghi lại.

| Động tác | Loại | Quy tắc kích hoạt (ban đầu) | Điều kiện reset |
|---|---|---|---|
| Punch L/R | event | `elbowAngle` > 130° **và** góc khuỷu tăng ≥ 30° so với mức thấp nhất trong 400 ms trước đó **và** (`reach2d` > 0.5 **hoặc** `armExt` > 0.95; ngưỡng 3D 0.85 gây nhầm ở tay trước khi thân xoay), cổ tay nằm giữa giữa-thân và trên đỉnh đầu. Không dùng ngưỡng tốc độ tuyệt đối: dữ liệu thật ở 16–30 FPS chỉ đo được 0.7–1.4/s | `elbowAngle` < 115° (thu tay), refractory 180 ms |
| Kick L/R | event | `ankleLift` của một chân > 0.35, chân kia vẫn gần sàn (< 0.10), vận tốc nâng > 1.5/s | mắt cá về < 0.15, refractory 350 ms |
| Jump | event | cả hai mắt cá **và** tâm hông nâng > 0.12 × torso trong ≤ 300 ms | tiếp đất (hông về < 0.05), refractory 500 ms |
| Block | state | cả hai cổ tay cao hơn vai, **cả hai** cách mũi < 0.55 × vai và **tổng** hai khoảng cách < 0.7 × vai (thủ thế sát mặt có tổng ≈ 0.76), không tay nào đang duỗi (khuỷu < 120°), giữ ≥ 150 ms | điều kiện mất ≥ 120 ms; tay duỗi (khuỷu > 120°) thì tắt ngay |
| Crouch | state | `hipDy` hạ > 0.25 × torso, giữ ≥ 120 ms | `hipDy` < 0.15 |
| Dodge L/R | state | `lean` > 15° về một phía **và** \|`hipDx`\| < 0.30 (hông giữ yên, chỉ thân nghiêng) | `lean` < 8° |
| Move L/R | state | \|`hipDx`\| > 0.45 (kiểu joystick: lệch khỏi vùng trung tâm thì đi liên tục) | \|`hipDx`\| < 0.30 (hysteresis) |

**Xử lý xung đột:** Jump chặn Kick trong cùng cửa sổ thời gian. **Punch thắng Block**: một tay duỗi ra (khuỷu > 120°) là block tắt ngay. (Bản đầu để Block chặn Punch, khiến tư thế thủ thế cao làm mất mọi cú đấm.) Đang Crouch thì không phát Jump. Double punch không phải recognizer riêng: hai event punch_l và punch_r trong vòng 250 ms sẽ do tầng combo của game diễn giải.

`confidence` = tích của (visibility trung bình các khớp liên quan) và (mức vượt ngưỡng, chuẩn hoá về 0..1). Event có confidence < 0.5 bị bỏ.

### 5.4. Tracking status và calibration

- `no_person`: không có pose. `partial`: một khớp chính (vai, hông, gối, mắt cá) có visibility < 0.5. `out_of_frame`: khớp chính nằm sát mép ảnh (< 2% hoặc > 98%). `ok`: còn lại.
- Khi khác `ok`, engine **không phát event**, state trả về mặc định và giữ trạng thái đó ≥ 300 ms sau khi trở lại `ok` (debounce).
- **Calibration:** người chơi đứng thủ thế trung lập 2 giây. Hệ thống cần 45 frame liên tiếp `ok` với độ lệch tâm hông < 0.03, rồi lấy trung vị để có baseline (tâm hông, mắt cá, `torsoPx`, `shoulderPx`, chiều dài tay/chân). Các trạng thái trên UI: Đang tìm người chơi → Chưa thấy toàn thân → Ra ngoài khung → Đang hiệu chỉnh (thanh tiến độ) → Sẵn sàng. Calibration được lưu vào localStorage và có nút hiệu chỉnh lại.

### 5.5. Motion Lab (`lab.html`)

Bố cục chia đôi màn hình 1280×720 (cùng bố cục sẽ dùng trong game):
- **Trái – WebcamPanel** (`src/view/webcamPanel.ts`, dùng lại ở game): video lật gương, skeleton (khớp tô màu theo visibility), badge tracking status, **nhãn động tác** hiện to khoảng 600 ms khi có event, và chỉ báo state (BLOCK/CROUCH/DODGE ◄►/MOVE ◄►).
- **Phải – Debug panel:** log event, sparkline cho `armExt`, `ankleLift`, `lean`, `hipDx/Dy`, FPS tracking, độ trễ p50/p95.
- **Thanh điều khiển:** chọn camera, model full/lite, Calibrate, ⏺ Record video, 💾 Ghi phiên landmark, ▶ Phát lại file phiên (kéo thả), **Guided capture**.
- **Guided capture:** hiện lần lượt "Làm PUNCH TRÁI ×10", "…", "Đứng tự do / shadow-boxing 60 giây (không làm động tác nào)", mỗi lượt có cửa sổ thời gian. File phiên lưu kèm nhãn `{action, tStart, tEnd}` để làm ground truth.

### 5.6. Đo lường và tiêu chí qua Phase 1

- **Độ trễ:** `latency = tEmit − frame.t` (gồm thời gian suy luận và thời gian xác nhận động tác). Hiển thị p50/p95. Mục tiêu p95 ≤ 120 ms trên máy người dùng. Độ trễ của webcam/màn hình được đo thủ công một lần bằng cách quay slow-mo điện thoại (hướng dẫn ghi trong README).
- **Độ chính xác** (`npm run eval` chạy `scripts/eval.ts` trên `fixtures/sessions`): event khớp nhãn nếu rơi vào `[tStart, tEnd + 300ms]`. Mục tiêu mỗi động tác rời rạc **precision ≥ 0.90, recall ≥ 0.85**. Phiên shadow-boxing 60 s có **≤ 2 event sai** cho mỗi loại.
- Tracking ≥ 25 FPS với model full; nếu không đạt thì mặc định dùng lite.
- **Kết luận đã đo (2026-10-31):** đứng thẳng đấm vào camera gần như không đo được (cổ tay đứng yên trên ảnh, MediaPipe chỉ thấy tay tiến khoảng 0.1 m). **Tư thế chính thức: đứng nghiêng khoảng 45°**, khớp với game nhìn ngang. Xem Phụ lục A.

### 5.7. Kiểm thử

- `tests/helpers/synthPose.ts`: sinh `PoseFrame` từ khung xương tham số (góc vai/khuỷu/hông/gối, vị trí hông, độ nghiêng) và nội suy theo thời gian để tạo chuỗi động tác giả lập. Mọi recognizer được viết theo TDD bằng chuỗi giả lập này: phát đúng một event, không phát khi đứng yên, không phát lặp, xử lý đúng các xung đột ở 5.3.
- Phiên thật trong `fixtures/` dùng cho eval (không chặn CI, vì ngưỡng tinh chỉnh theo người).
- `tools/analyze_session.py` (chạy trong `.venv`): đọc phiên JSON, vẽ feature theo thời gian kèm vùng nhãn, phục vụ tinh chỉnh ngưỡng.

## 6. Phase 2 – Combat Core (bàn phím)

### 6.1. Mô phỏng (`game/sim`, thuần, fixed-step 60 Hz)

- `Fighter`: `x` (sân 1D, rộng 1000 đơn vị), `facing`, `hp` 100, `stamina` 100 (hồi 15/s sau 0.5 s không hành động), `special` 0–100, trạng thái `idle | walk | attack(moveId, frame) | block | crouch | dodge | jump | hitstun | blockstun | ko`.
- `moves.ts` – frame data (đơn vị frame 60 Hz):

| Move | Startup | Active | Recovery | Dmg | Stamina | Tầm | Độ cao |
|---|---|---|---|---|---|---|---|
| Punch L (jab) | 4 | 3 | 10 | 5 | 6 | 110 | high |
| Punch R (cross) | 6 | 3 | 14 | 8 | 8 | 120 | high |
| Kick L | 8 | 4 | 18 | 10 | 12 | 150 | mid |
| Kick R | 10 | 4 | 20 | 13 | 14 | 160 | mid |
| Special (Power Blast) | 12 | 6 | 30 | 25 | 0 (tốn 100 special) | 220 | mid |

- Hitbox/hurtbox: AABB 1D theo x và độ cao (high/mid). Va chạm được xét **trong không gian game**, không dùng toạ độ webcam.
- **Phòng thủ:** Block giảm 80% sát thương, tốn 5 stamina mỗi đòn đỡ, gây blockstun 8 frame. Crouch né đòn `high`. Dodge cho 20 frame miễn đòn, sau đó 12 frame hồi (spam dodge dễ bị phạt). Jump né đòn `mid` trong các frame giữa không trung.
- Bị trúng đòn: hitstun 14 frame, đẩy lùi, hitstop 4 frame. Stamina < chi phí thì không ra đòn được (hiện "TIRED").
- Trận đấu: 99 giây, 1 round. Thắng khi KO hoặc khi hết giờ còn nhiều HP hơn.

### 6.2. Combo (`combo.ts`)

Bộ đệm các hành động ra đòn trúng hoặc được thực hiện, cửa sổ 700 ms giữa hai bước:

| Chuỗi | Combo | Hiệu ứng |
|---|---|---|
| punch_l → punch_r | Double Jab | +20% dmg đòn cuối, +10 special |
| punch_l → punch_r → kick_r | Triple Attack | +40%, +20 special |
| block → dodge → punch_r (trong 1 s) | Counter | đòn cuối ×1.5, +25 special |
| punch_r → kick_l → kick_r | Power Combo | +50%, +25 special |

Đòn trúng cộng special (+5); bị trúng cộng +3. **Special được kích hoạt bằng cú đấm hai tay** (punch_l và punch_r trong 250 ms) khi special = 100. Không cần cử chỉ mới.

### 6.3. Chịu độ trễ

Input từ cơ thể đến muộn khoảng 150 ms, nên đòn người chơi có startup ngắn (bảng trên). Ngược lại, **mọi đòn của NPC có telegraph ≥ 400 ms** (tư thế chuẩn bị + vệt sáng cảnh báo), để người chơi kịp block hoặc dodge bằng cơ thể. Hằng số này nằm trong `difficulty.ts`.

### 6.4. Render và nhập liệu

- `stickFighter.ts`: khung xương 2D gồm đầu, thân, 2 tay, 2 chân, mỗi chi 2 đốt. Mỗi trạng thái hoặc move có pose keyframe (anticipation → impact → recovery), tween theo frame của sim. Màu neon: người chơi cyan, NPC magenta, có glow.
- `effects.ts`: tia lửa khi trúng đòn (particle), rung màn hình, hitstop, popup chữ (HIT/BLOCK/DODGE/COMBO ×n/TIRED).
- `hud.ts`: HP ×2, stamina, special, đồng hồ, bộ đếm combo.
- `keyboardInput.ts`: A/D = move, S = crouch, W = jump, J/K = punch L/R, U/I = kick L/R, Space = block, Q/E = dodge. Bàn phím luôn bật để debug.

## 7. Phase 3 – Tích hợp cơ thể, calibration và chia màn hình

- `motionInput.ts`: bọc `motionEngine` thành `InputSource`. Mỗi bước sim, nó lấy các event chưa tiêu thụ và state mới nhất. Event cũ hơn 250 ms bị bỏ.
- **Scene Calibration** dùng lại logic 5.4 và WebcamPanel. Không vào trận khi chưa có trạng thái "Sẵn sàng".
- **Mất tracking giữa trận:** sau 500 ms không `ok` thì tự pause, hiện overlay "Bước vào lại khung hình". Khi `ok` liên tục 1 s thì đếm ngược 3-2-1 và tiếp tục.
- **Chế độ hiển thị** (Settings): `split` (mặc định, 1280×720: webcam 480 px bên trái, trận đấu 800 px bên phải), `pip` (webcam góc phải trên), `game` (chỉ có game). WebcamPanel được vẽ **bên trong canvas Phaser** (texture video + Graphics), nên toàn bộ khung hình nằm trên một canvas.
- **Record:** `videoRecorder.ts` dùng `canvas.captureStream(30)` + audio track từ `AudioContext` (qua `MediaStreamAudioDestinationNode`) → `MediaRecorder` (`video/webm;codecs=vp9`, fallback vp8) → tải xuống `bodyfighter-YYYYMMDD-HHmmss.webm`. Nút ⏺ có trên HUD, phím tắt `R`, có chấm đỏ và đồng hồ khi đang ghi. Motion Lab dùng cùng module này với canvas riêng.
- **Hiệu năng:** đo FPS của game khi bật tracking. Nếu game tụt dưới 55 FPS thì chuyển PoseLandmarker sang Web Worker (task có điều kiện trong plan Phase 3).

## 8. Phase 4 – NPC AI

- `aiInput.ts` là một `InputSource`: đọc snapshot của sim (khoảng cách, trạng thái hai bên, HP, stamina) và xuất `ControlFrame`. Nó dùng **đúng move list và luật** như người chơi, ngoại trừ telegraph bắt buộc ở 6.3.
- `fsm.ts`, các state: `Idle, Approach, Attack, Block, Dodge, Counter, Retreat, Special`. Ra quyết định mỗi 100 ms, phản ứng với hành động của người chơi sau `reactionMs`.
- `difficulty.ts`:

| Tham số | Easy | Normal | Hard |
|---|---|---|---|
| reactionMs | 600 | 400 | 250 |
| aggression (xác suất chủ động tấn công khi ở tầm) | 0.25 | 0.45 | 0.6 |
| blockChance / dodgeChance khi thấy đòn | 0.15 / 0.05 | 0.4 / 0.15 | 0.55 / 0.25 |
| counterChance khi người chơi đang recovery | 0 | 0.3 | 0.6 |
| comboLen tối đa | 1 | 2 | 3 |
| idlePauseMs | 1200 | 700 | 400 |

- `adaptive.ts` (Normal/Hard): đếm tần suất hành động của người chơi trong 20 s gần nhất (punch/kick/block/dodge/aggression), rồi điều chỉnh trọng số theo 4 quy tắc ở mục 5.3 của concept doc, mỗi trọng số giới hạn ±30%.
- RNG có seed (`shared/rng.ts`), nên AI được test tất định bằng Vitest.

## 9. Phase 5 – Hoàn thiện

- **Menu** (chuột/bàn phím): Quick Fight (chọn Easy/Normal/Hard), Training, Settings (camera, model, chế độ hiển thị, input bàn phím/cơ thể, âm lượng), Hướng dẫn và an toàn.
- **Training Mode:** (a) *Drill*: hệ thống gọi tên động tác ngẫu nhiên, đo thời gian phản ứng và tỉ lệ nhận diện đúng, có tổng kết cuối bài. (b) *Dummy*: bao cát không đánh trả để thử combo.
- **Result screen:** thắng/thua, số đòn trúng, combo dài nhất, số cú đấm/đá đã thực hiện (gợi hướng Fitness/Analytics).
- **SFX** WebAudio: whoosh, hit, block, KO, UI. Có nhạc nền đơn giản tạo procedural hoặc tắt được.
- **Màn an toàn** trước trận đầu: khoảng trống, giày dép, khuyên nghỉ giữa các trận.
- Deploy: workflow GitHub Actions build và đẩy lên Pages. README có GIF/video demo, hướng dẫn đặt camera, link chơi.

## 10. Xử lý lỗi

| Tình huống | Xử lý |
|---|---|
| Từ chối quyền camera / không có camera | Màn hướng dẫn cấp quyền; vẫn cho chơi bằng bàn phím |
| GPU delegate lỗi | Tự fallback CPU + model lite, hiện cảnh báo nhỏ |
| Model tải lỗi | Thông báo kèm nút thử lại; model host cùng origin trong `public/models` |
| MediaRecorder không hỗ trợ codec | Thử lần lượt vp9 → vp8 → mặc định; không hỗ trợ thì ẩn nút Record |
| Tab bị ẩn | Pause trận và tracking |
| Mất tracking | Mục 7 |

## 11. Kiểm thử tổng thể

- Unit (Vitest): `motion/*` (synthetic pose), `game/sim/*` (frame data, va chạm, block/dodge/crouch, stamina, combo, KO/timeout), `game/ai/*` (seed RNG, quyết định theo tình huống, adaptive).
- Eval: `npm run eval` trên fixtures (Phase 1 trở đi).
- Thủ công: checklist trong mỗi plan (camera thật, quay video, chơi hết một trận ở 3 cấp độ).
- `npm run check` = `tsc --noEmit` + `vitest run` phải xanh trước mỗi commit hoàn tất task.

## 12. Thứ tự thực hiện và plan

Mỗi phase có một implementation plan riêng trong `docs/superpowers/plans/`, viết khi phase trước hoàn tất (để plan sau dựa trên số liệu đo thật):

1. Phase 1 – Motion Lab (mục 5) → kết quả đo được ghi vào spec phụ lục A.
2. Phase 2 – Combat Core (mục 6). Độc lập với Phase 1, có thể làm song song.
3. Phase 3 – Integration (mục 7).
4. Phase 4 – NPC AI (mục 8).
5. Phase 5 – Polish và deploy (mục 9).

## Phụ lục A – Kết quả đo (điền sau Phase 1)

Phiên `fixtures/sessions/2026-10-31-side-quick.json.gz`: đứng nghiêng, vai trái hướng về camera, model full, ~16 FPS khi ghi (30 FPS khi không ghi).

| Hạng mục | Trước khi sửa | Sau khi sửa (mục tiêu) |
|---|---|---|
| punch_l precision / recall | 1.00 / 0.70 | **1.00 / 1.00** (10/10) |
| punch_r precision / recall | – / 0.00 | **1.00 / 1.00** (12/12) |
| Block (frame trong cửa sổ block) | 0 / 84 | **≥ 70 / 84**, ≤ 10 frame nhầm khi thủ thế (test hồi quy `tests/motion/realSessions.test.ts`) |

Nhãn `punch_r` đã được chỉnh theo quỹ đạo cổ tay thô: 12 cú, gồm một cú đấm lúc đang chuẩn bị (19.5 s) và một cú thứ 11 (35.3 s). Phiên đứng thẳng cùng ngày chỉ nhận được 1 cú đấm, xác nhận kết luận ở mục 5.6.

_(Các action còn lại và độ trễ: điền sau phiên guided đầy đủ.)_
