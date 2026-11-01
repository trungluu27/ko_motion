# Thay nền webcam – Thiết kế

Ngày 2026-11-01.

## 1. Mục tiêu

Trên khung webcam trong game (gồm chế độ chia đôi, webcam góc, Drill và Calibration) chỉ hiện người chơi. Phần nền phòng được thay bằng một nền khác. Việc này giúp:
- không lộ phòng riêng khi quay video hoặc làm demo cho portfolio;
- hình gọn và đẹp hơn.

Video quay bằng phím P tự có nền mới, vì video quay lại đúng canvas game.

## 2. Cách làm

- **Mặt nạ người:** bật `outputSegmentationMasks` của PoseLandmarker đang dùng. Mặt nạ ra cùng lượt suy luận nên không cần model thứ hai.
  - Chỉ bật khi người chơi chọn một nền khác "Camera thật", bằng `landmarker.setOptions(...)`.
  - Khi chọn "Camera thật" thì không tốn thêm chi phí nào.
- **`PersonMatte`** (`src/view/personMatte.ts`): được gọi ngay trong callback của tracker, đúng khung video đã dùng để suy luận, nên mặt nạ khớp với người. Có 2 canvas:
  1. `alpha`: mặt nạ được lấy mẫu thưa, 1/4 cạnh, khoảng 320×180. Giá trị float 0..1 được chuyển thành kênh alpha. Mép người được làm mềm nhờ phóng to có smoothing.
  2. `person`: vẽ khung video ở kích thước gốc, rồi dùng `destination-in` với `alpha` đã phóng to, để chỉ còn lại người.
  - Mask được đọc trong callback rồi `close()` ngay, theo yêu cầu của MediaPipe.
- **Panel webcam** (`drawWebcamPanel`, nhận `opts.background`): khi có matte, panel vẽ nền trước, rồi vẽ `person` lật gương với đúng phép chiếu của video. Khi không có matte (chưa có khung nào, hoặc mất người) thì panel chỉ vẽ nền.
- **Các nền có sẵn** (`webcamBg` trong Settings):
  - `off`: camera thật (mặc định);
  - `blur`: chính video, làm mờ 14px;
  - `neon`: lớp xa của sân phố neon (`stages/neon_street/far.jpg`), cắt vừa khung;
  - `studio`: gradient tối có lưới mờ, kiểu phòng tập.
- **Settings** có thêm dòng "Nền webcam". Có thể đổi trong trận bằng phím **B**, phím này cũng lưu lại lựa chọn.

## 3. Hiệu năng và lỗi

- Chi phí thêm cho mỗi khung: đọc mask từ GPU về (`getAsFloat32Array`), lặp khoảng 57k phần tử, và 2–3 lần `drawImage`. Mục tiêu là game vẫn ≥ 55 FPS và tracking không giảm quá 2 FPS so với khi tắt (đo bằng F3).
- Nếu `setOptions` lỗi, hoặc tracker không trả mask, thì tự quay về `off` và báo một lần.
- Motion Lab không đổi, vẫn dùng camera thật.

## 4. Kiểm thử

- Vitest:
  - `maskToAlpha(mask, w, h, step)` (hàm thuần) lấy mẫu đúng kích thước và giá trị;
  - `coverRect` vẫn khớp với phép chiếu video;
  - settings đọc và ghi `webcamBg`; giá trị lạ thì lấy mặc định;
  - `nextBg` chạy vòng qua 4 nền.
- Phần vẽ canvas được kiểm tra bằng tay: đổi qua 4 nền, đứng ra khỏi khung, rồi quay video bằng P.
