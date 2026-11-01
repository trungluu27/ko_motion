# Phase 5: Hoàn thiện – Thiết kế

Ngày 2026-11-01. Tài liệu này chi tiết hoá mục 9 của spec chính (`2026-10-31-body-fighter-design.md`). Phase 1–4, phần đồ hoạ và phần độ khó AI đã merge vào `main`.

## 1. Mục tiêu

Biến bản demo thành một game hoàn chỉnh, có thể đưa vào portfolio:
- có menu;
- có chế độ luyện tập;
- có màn hình kết quả với thống kê;
- có nhạc nền;
- có màn hình an toàn;
- chạy được online qua GitHub Pages, kèm README có demo.

**Tiêu chí thành công.** Người lạ mở link sẽ thấy menu. Từ menu họ chơi được bằng bàn phím hoặc bằng cơ thể mà không cần đọc README. Hết trận, họ thấy thống kê và quay lại được menu. Ngoài ra luyện được từng động tác, và nhận phím tắt in-game của các phase trước vẫn dùng được.

## 2. Luồng màn hình (Phaser scenes)

```
MenuScene ─ Quick Fight ─► chọn Easy/Normal/Hard ─┐
          ├ Training ─► Drill | Bao cát ───────────┤
          ├ Settings (SettingsScene)               ├► [SafetyScene: chỉ lần đầu] ─► [CalibrationScene nếu điều khiển bằng cơ thể] ─► FightScene / DrillScene
          └ Hướng dẫn & an toàn (HelpScene)        ┘
FightScene ─ hết trận (sau 2,5 s) ─► ResultScene ─ Enter: đấu lại | M/Esc: menu
DrillScene ─ hết bài ─► tổng kết ngay trong scene ─ Enter: làm lại | Esc: menu
```

- Màn hình đầu tiên khi mở game là `MenuScene`. Các scene nhận một đối tượng `Launch` mô tả việc cần làm tiếp:
  ```ts
  type Launch = { mode: 'fight'; opponent: Difficulty } | { mode: 'dummy' } | { mode: 'drill' }
  ```
- `CalibrationScene` nhận `next: Launch` thay vì luôn chuyển sang `fight`. Esc trong Calibration sẽ quay lại menu.
- Trong FightScene:
  - Esc: quay về menu.
  - Các phím cũ vẫn giữ: R, C, V, 1/2/3/0, P, F3.
  - Hết trận sẽ chuyển sang ResultScene. Riêng chế độ bao cát thì không chuyển.
- Menu điều khiển được bằng chuột (hover và click) hoặc bàn phím (↑/↓ hoặc W/S, Enter, Esc để lùi). Logic điều hướng nằm trong `menuNav.ts` và được viết thuần, test được.

## 3. Settings (`src/game/settings.ts`)

- Lưu vào `localStorage` dưới khoá `bf.settings` (JSON). Vẫn giữ khoá `bf.model` cũ để tương thích với Motion Lab.
- Kiểu dữ liệu:
  ```ts
  type Settings = {
    control: 'keyboard' | 'body';
    view: ViewMode;
    model: 'full' | 'lite';
    cameraId: string | null;
    sfxVolume: number;   // 0..1, bước 0.1
    music: boolean;
    safetyAck: boolean;
  }
  ```
- `loadSettings(storage)`: nếu JSON hỏng hoặc thiếu field thì lấy giá trị mặc định cho field đó. Mặc định: keyboard, split, full, null, 0.8, true, false.
- `saveSettings(s, storage)`.
- SettingsScene có các dòng: Điều khiển, Hiển thị, Camera (lấy danh sách từ `listCameras()`; nếu chưa cấp quyền thì hiện "Mặc định"), Model, Âm lượng, Nhạc nền. Mỗi dòng đổi giá trị bằng ←/→ hoặc click. Thay đổi được lưu ngay.
- `MotionSession.start()` mở camera theo `cameraId`. Nếu model trong settings khác với model đang nạp thì nạp lại tracker ở lần start kế tiếp.

## 4. Thống kê trận và ResultScene

- `src/game/stats.ts` là bộ đếm thuần. `MatchStats.observe(events, frame)` theo dõi phía người chơi (fighter 0) và đếm:
  - `punches`, `kicks`, `specials`: số đòn đã ra (event `attack`);
  - `hitsLanded`: số đòn trúng, bao gồm guard_break;
  - `blocked`: số đòn của đối thủ mà người chơi đỡ được;
  - `damageDealt`, `damageTaken`;
  - `longestCombo`: chuỗi đòn trúng dài nhất của người chơi. Hai đòn liên tiếp phải cách nhau tối đa `COMBO_GAP` (42 frame) và không có đòn nào của đối thủ trúng người chơi ở giữa. Mỗi đòn trúng lẻ tính là 1;
  - `seconds`: thời gian trận.
- `ResultScene` hiển thị:
  - THẮNG / THUA / HOÀ, kèm lý do (KO hoặc hết giờ) và độ khó;
  - các chỉ số ở trên, cùng ước lượng "≈ kcal" = `0.1 × (punches + specials) + 0.2 × kicks` (con số này chỉ để vui, có ghi chú như vậy);
  - nếu người chơi đã đánh 3 trận liên tiếp bằng cơ thể thì hiện nhắc: "Bạn đã đấu 3 trận liền, nghỉ 1–2 phút và uống nước nhé". Bộ đếm này lưu trong bộ nhớ, không lưu xuống storage.

## 5. Training

- **Bao cát** (`mode: 'dummy'`):
  - Đối thủ là `DummyInput('idle')`.
  - Không giới hạn thời gian: `framesLeft` được giữ ở mức tối đa.
  - Bao cát hồi đầy HP sau 90 tick không bị trúng đòn.
  - Người chơi không mất HP.
  - HUD hiện "COMBO ×N", lấy từ `MatchStats`.
  - Luật này nằm trong hàm thuần `trainingTick(match, stats)` ở `src/game/training/dummy.ts`.
- **Drill** (`src/game/training/drill.ts`, thuần, RNG có seed):
  - Một bài gồm 12 lượt. Mỗi lượt gọi tên một động tác chọn ngẫu nhiên trong punch_l, punch_r, kick_l, kick_r, block; không lặp quá 2 lần liền.
  - Thời gian chờ giữa hai lượt là 1,0–1,8 s (ngẫu nhiên). Mỗi lượt có 2,5 s để làm.
  - Kết quả mỗi lượt:
    - `hit`: action event đầu tiên đúng động tác được gọi; với block thì là `state.block` bật lên;
    - `wrong`: action event đầu tiên là động tác khác;
    - `miss`: hết giờ mà chưa làm gì.
  - Thời gian phản ứng = thời điểm event − thời điểm gọi.
  - API:
    ```ts
    new Drill(rng, { rounds: 12 })
    drill.update(nowMs, frame: { events: ActionEvent[]; block: boolean })
      → { phase: 'wait' | 'prompt' | 'done'; prompt: DrillMove | null; last: RoundResult | null }
    drill.summary()
      → { accuracy, meanReactionMs, perMove: Record<DrillMove, { hit: number; total: number }> }
    ```
  - `DrillScene`:
    - Điều khiển bằng cơ thể: webcam chiếm nửa trái, tên động tác hiện cỡ lớn bên phải.
    - Bàn phím vẫn dùng được (J/K/U/I/Space) để chạy thử.
    - Có âm báo khi gọi lượt mới, khi làm đúng và khi làm sai.
    - Hết bài thì hiện bảng tổng kết.

## 6. Âm thanh

- `Sfx` có thêm:
  - `setVolume(v)` (gain master);
  - âm `ui()` (tiếng click khi di chuyển trong menu);
  - âm `drill(kind)`.
- `Music` (`src/game/render/music.ts`):
  - Dùng chung AudioContext và master với `Sfx`, nhờ vậy tiếng nhạc cũng vào được file ghi hình.
  - Nhạc là vòng lặp tự sinh ở 112 BPM: 4 ô nhịp bass synth, hi-hat bằng noise, kick drum bằng sine sweep. Lập lịch theo kiểu lookahead 100 ms bằng `setInterval` 25 ms.
  - Có `start()`, `stop()` và `setEnabled(b)`.
  - Nhạc phát trong FightScene và DrillScene nếu `settings.music` bật; tắt khi rời scene.
  - Trong trận, phím **N** bật/tắt nhạc.
- Chuỗi nốt nhạc được sinh bằng hàm thuần `musicPattern(bar)`, có test.

## 7. Màn an toàn (`SafetyScene`)

- Xuất hiện trước trận đầu tiên hoặc bài drill đầu tiên nếu `settings.safetyAck` còn false.
- Nội dung:
  - khoảng trống tối thiểu 2 × 2 m, dọn vật cứng, tránh xa cạnh bàn;
  - đi chân trần trên sàn không trơn, hoặc mang giày thể thao; không đi tất trên sàn gỗ;
  - khởi động cổ tay, vai, hông khoảng 1 phút;
  - đá ở mức vừa sức, không cần đá cao;
  - nghỉ sau mỗi 2–3 trận; dừng ngay nếu đau hoặc chóng mặt.
- Bấm Enter nghĩa là "Tôi đã hiểu", sau đó lưu `safetyAck = true`. HelpScene luôn hiện lại nội dung này, kèm hướng dẫn đặt camera và bảng phím.

## 8. Deploy và README

- `vite.config.ts` đặt `base: './'` để chạy được dưới `/<repo>/`. Mọi asset đã dùng `import.meta.env.BASE_URL`.
- `.github/workflows/pages.yml`: khi push lên `main`, workflow chạy `npm ci`, `npm run setup` (tải model và copy WASM), rồi `npm run check` và `npm run build`. Cuối cùng dùng `actions/upload-pages-artifact` và `actions/deploy-pages` để đưa `dist` lên Pages.
- README:
  - link chơi `https://trungluu27.github.io/ko_motion/`;
  - mục "Đặt camera" (có sơ đồ ASCII khoảng cách 2,5–3 m, chiều cao camera ngang hông đến ngực, đứng nghiêng 45°);
  - mục Demo: chỗ để GIF/video, kèm hướng dẫn quay bằng phím P trong game. Video thật do người dùng tự quay;
  - mục an toàn tóm tắt.
- **Push lên GitHub và bật Pages** (Settings → Pages → Source: GitHub Actions) là thao tác của người dùng, hoặc chỉ làm khi người dùng xác nhận.

## 9. Ngoài phạm vi

- Không làm online multiplayer, chọn nhân vật hay thêm sân đấu.
- Không làm bảng xếp hạng.
- Không có nhạc thu sẵn từ file ngoài.
- Không có bản di động hay cảm ứng.

## 10. Kiểm thử

- Vitest cho các phần thuần: `settings`, `menuNav`, `stats`, `drill`, `trainingTick`, `musicPattern`, cùng bộ chọn tracker theo model và camera của MotionSession (inject deps).
- Scene thì kiểm tra bằng tay theo checklist ở task cuối của plan.
