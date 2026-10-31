# BODY FIGHTER

Game đối kháng võ thuật 2D điều khiển bằng chuyển động toàn thân qua webcam (MediaPipe Pose). Chạy hoàn toàn trên trình duyệt.

> Trạng thái: **Phase 1 – Motion Lab**: nhận diện chuyển động, ghi/phát lại phiên, quay video. Thiết kế đầy đủ: [`docs/superpowers/specs/2026-10-31-body-fighter-design.md`](docs/superpowers/specs/2026-10-31-body-fighter-design.md).

## Chạy

Yêu cầu: Node 20+, Chrome hoặc Edge, webcam.

```bash
npm install
npm run setup     # tải model MediaPipe vào public/models và copy WASM
npm run dev       # mở http://localhost:5173/lab.html
```

Các lệnh khác:

| Lệnh | Việc |
|---|---|
| `npm run check` | Type-check + toàn bộ unit test |
| `npm run eval` | Phát lại mọi phiên trong `fixtures/sessions/` và in precision/recall |
| `npm run eval -- --dump out` | Như trên, đồng thời xuất feature ra CSV cho Python |
| `npm run build` | Build tĩnh vào `dist/` |

## Đặt camera và đứng

- Camera cao khoảng ngang hông, nhìn thẳng. Đứng cách camera **2,5–3 m**, phải thấy cả đầu lẫn bàn chân.
- Ánh sáng chiếu từ phía trước, tránh đứng ngược sáng cửa sổ.
- Dọn sạch khoảng trống khoảng 2 × 2 m. Đi giày hoặc chân trần trên sàn không trơn.

## Motion Lab

Màn hình 1280×720 chia đôi: **trái** là webcam lật gương, skeleton và tên động tác; **phải** là FPS, độ trễ, biểu đồ feature kèm ngưỡng và log sự kiện.

1. Bấm **🎯 Calibrate**, đứng thủ thế yên khoảng 2 giây cho tới khi hiện "Sẵn sàng!". Calibration được lưu lại cho lần sau.
2. Thử các động tác:

| Động tác thật | Nhận diện |
|---|---|
| Đấm nhanh tay trái / phải | LEFT / RIGHT PUNCH |
| Đá nhanh chân trái / phải (chân kia trụ đất) | LEFT / RIGHT KICK |
| Bật nhảy | JUMP |
| Hai tay che mặt | BLOCK |
| Hạ thấp hông | CROUCH |
| Nghiêng thân, hông giữ yên | DODGE ◄ / ► |
| Dịch cả người sang trái / phải khỏi vị trí giữa | MOVE ◄ / ► |

3. Thanh công cụ:
   - **⏺ Record video** (phím `R`): quay toàn bộ canvas thành file `bodyfighter-YYYYMMDD-HHmmss.webm`.
   - **💾 Ghi phiên**: ghi landmark ra file JSON để phát lại hoặc phân tích.
   - **🎯 Guided capture**: kịch bản thu dữ liệu có nhãn, khoảng 7 phút (phím `N` để bỏ qua bước). Kết thúc sẽ tải về `guided-*.json`.
   - **▶ Phát lại**: chọn hoặc kéo thả file phiên vào canvas. Nếu file có nhãn, bảng precision/recall hiện ở panel phải.

## Đo độ trễ glass-to-glass

Bảng debug chỉ đo từ lúc frame được capture tới lúc ra event. Muốn đo toàn bộ (camera → màn hình), dùng điện thoại quay slow-mo 240 fps cảnh bạn đấm, có màn hình trong khung hình. Đếm số frame từ lúc tay duỗi hết tới lúc chữ "PUNCH" hiện lên, rồi chia cho 240 để ra giây.

## Python (phân tích dữ liệu)

Python chạy trong virtualenv `.venv` ở gốc repo. Xem [`tools/README.md`](tools/README.md).

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r tools/requirements.txt
```

## Cấu trúc

- `src/motion/`: lõi nhận diện. TypeScript thuần, có unit test: lọc One Euro, calibration, feature, recognizer, `MotionEngine`, định dạng phiên.
- `src/view/webcamPanel.ts`: vẽ webcam + skeleton + nhãn (dùng chung cho game).
- `src/recording/videoRecorder.ts`: quay canvas ra WebM.
- `src/lab/`: trang Motion Lab.
- `tests/`: Vitest, gồm bộ sinh pose giả lập `tests/helpers/synthPose.ts`.
- `tools/`: script Python phân tích phiên.
