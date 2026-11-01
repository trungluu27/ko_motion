# Thay nền webcam – Plan

**Spec:** `docs/superpowers/specs/2026-11-01-webcam-background-design.md`

**Constraints:**
- Mặc định là `off`, và khi tắt thì không tốn thêm chi phí.
- Không đổi Motion Lab.
- 280 test hiện có phải còn xanh.

### Task 1: Settings và mask từ tracker
- `settings.ts`:
  - thêm `webcamBg: 'off' | 'blur' | 'neon' | 'studio'` (mặc định `off`);
  - thêm hàm `nextBg(bg)`.
- Test settings: giá trị lạ thì lấy mặc định; `nextBg` chạy vòng.
- `poseTracker.ts`:
  - thêm `setMasks(on: boolean): Promise<void>` (gọi `setOptions`);
  - `onFrame(frame, inferMs, mask?: { data: Float32Array; width: number; height: number })`: mask được copy thưa ra trong callback (dùng `maskToAlpha`), sau đó `close()`.
- `src/view/personMatte.ts`:
  - `maskToAlpha(data: Float32Array, w: number, h: number, step: number): { alpha: Uint8ClampedArray; w: number; h: number }` (thuần, có test);
  - `class PersonMatte { update(video, alpha); canvas: HTMLCanvasElement | null; clear() }`.
- `MotionSession`:
  - giữ `matte`;
  - `setBackground(bg)` bật hoặc tắt mask của tracker;
  - đọc settings lúc `start()`.

### Task 2: Vẽ nền trên panel và điều khiển
- `webcamPanel.ts`: thêm `opts.background?: { kind; image?; matte? }`. Vẽ nền, rồi vẽ người lật gương theo `proj`. Giữ nguyên skeleton và nhãn động tác.
- `WebcamLayer`: truyền background từ settings vào panel; tải `neon_far` dưới dạng `HTMLImageElement`.
- `SettingsScene`: thêm dòng "Nền webcam". `FightScene`: phím **B** đổi nền, có hiện notice, và lưu lại. Help và README thêm phím B.
- Lỗi: nếu `setMasks` reject thì quay về `off` và hiện notice.
- `npm run check`, build, commit.

### Task 3: Kiểm tra tay (người dùng)
- Thử 4 nền ở chế độ chia đôi, webcam góc và Drill.
- F3: game ≥ 55 FPS; tracking không giảm quá 2 FPS so với `off`.
- Quay video bằng P và xem nền mới có trong video không.
