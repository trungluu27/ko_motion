# BODY FIGHTER

Game đối kháng võ thuật 2D điều khiển bằng chuyển động toàn thân qua webcam (MediaPipe Pose). Chạy hoàn toàn trên trình duyệt.

**▶ Chơi ngay:** https://trungluu27.github.io/ko_motion/ (Chrome hoặc Edge, cần webcam nếu muốn chơi bằng cơ thể; bàn phím chơi được ngay)

## Demo

<!-- Thay bằng GIF/video thật: trong game bấm P (hoặc nút ⏺) để quay cả webcam lẫn trận đấu ra file .webm,
     chuyển sang GIF (vd. ffmpeg -i demo.webm -vf "fps=15,scale=960:-1" demo.gif) rồi đặt vào docs/demo.gif -->
![Demo: người chơi đấm đá trước webcam, nhân vật trong game đánh theo](docs/demo.gif)

> Trạng thái: **đủ 5 phase**: menu, đấu với AI 3 cấp độ bằng bàn phím hoặc cơ thể, training (drill, bao cát), màn kết quả, nhạc nền, quay video, deploy GitHub Pages. Thiết kế đầy đủ: [`docs/superpowers/specs/2026-10-31-body-fighter-design.md`](docs/superpowers/specs/2026-10-31-body-fighter-design.md).

## Chạy

Yêu cầu: Node 20+, Chrome hoặc Edge, webcam.

```bash
npm install
npm run setup     # tải model MediaPipe vào public/models và copy WASM
npm run dev       # game: http://localhost:5173/ · Motion Lab: http://localhost:5173/lab.html
```

Các lệnh khác:

| Lệnh | Việc |
|---|---|
| `npm run check` | Type-check + toàn bộ unit test |
| `npm run eval` | Phát lại mọi phiên trong `fixtures/sessions/` và in precision/recall |
| `npm run eval -- --dump out` | Như trên, đồng thời xuất feature ra CSV cho Python |
| `npm run build` | Build tĩnh vào `dist/` |

## Menu

Mở game là vào menu (chuột hoặc ↑/↓ + Enter, Esc quay lại):

- **Quick Fight**: chọn AI Easy / Normal / Hard. Hết trận có màn kết quả: đòn trúng, combo dài nhất, đòn đỡ được, số cú đấm/đá, sát thương, kcal ước tính cho vui. Enter đấu lại, M về menu.
- **Training**: **Drill** gọi tên ngẫu nhiên 12 động tác (đấm/đá trái phải, block), chấm đúng/sai và thời gian phản ứng; **Bao cát** không đánh trả, tự hồi máu, không giới hạn giờ, hiện số combo.
- **Cài đặt** (lưu lại giữa các lần mở): bàn phím hay cơ thể, bố cục webcam, camera, model Full/Lite, âm lượng, nhạc nền.
- **Hướng dẫn & an toàn**: bảng phím, động tác, cách đặt camera. Lần đầu vào trận game hiện màn an toàn một lần.

## Chơi thử bằng bàn phím

Chọn Quick Fight trong menu. Bạn là võ sĩ màu cyan, đối thủ màu hồng là AI (mặc định Normal). Đòn của đối thủ có báo trước bằng nhấp nháy vàng: khoảng 0.2 giây khi chơi bằng bàn phím, 0.4 giây khi chơi bằng cơ thể. Riêng đòn phạt lúc bạn đang hồi sau một đòn hụt hay bị đỡ thì không có báo trước.

| Phím | Hành động |
|---|---|
| A / D | Đi trái / phải |
| W | Nhảy (né đòn đá) |
| S (giữ) | Cúi (né đòn đấm) |
| J / K | Đấm trái / phải |
| U / I | Đá trái / phải |
| Space (giữ) | Block (giảm 80% sát thương, tốn stamina) |
| Q / E | Né (miễn đòn trong 1/3 giây) |
| J rồi K thật nhanh khi thanh tím đầy | Special: Power Blast |
| 1 / 2 / 3 | Đấu với AI Easy / Normal / Hard (đấu lại từ đầu) |
| 0 | Bao cát (không đánh trả, luyện combo) |
| R | Đấu lại |
| N | Bật/tắt nhạc nền |
| Esc | Về menu |

Combo: J→K (Double Jab), J→K→I (Triple Attack), K→U→I (Power Combo), Block→Né→K (Counter).

AI: Easy nghỉ nhiều, hiếm khi phòng thủ. Normal và Hard đứng ngay ngoài tầm đòn của bạn, giơ thủ khi bạn bước vào tầm, đỡ xong thì phạt ngay, dùng đá ở tầm trung và đấm hoặc combo ở tầm gần. Hard phản xạ nhanh (220 ms), combo 3 đòn và gần như luôn phạt đòn hụt; spam một nút sẽ thua. Bạn vẫn luôn kịp đỡ hoặc né các đòn AI chủ động ra. Normal và Hard còn **thích nghi theo thói quen của bạn** trong 20 giây gần nhất: hay đấm thì AI thủ nhiều hơn, hay đá thì nó né và giữ khoảng cách, hay block thì nó đánh mạnh để làm cạn stamina của bạn.

## Chơi bằng cơ thể

1. Trong **Cài đặt** chọn *Điều khiển: Cơ thể* rồi vào Quick Fight/Training (hoặc nhấn **C** ngay trong trận).
2. Màn **Calibration** mở webcam. Đứng nghiêng khoảng 45° (vai trái hướng về camera), cách 2,5–3 m, đứng thủ thế yên khoảng 2 giây cho tới khi hiện "Sẵn sàng!". Nếu đã calibrate trước đó (ở game hoặc Motion Lab), nhấn **Enter** là vào trận ngay; **K** để calibrate lại.
3. Trong trận: đấm, đá, che mặt (block), cúi, nghiêng người (né), dịch người sang trái/phải (đi). Bàn phím vẫn dùng được song song.
4. Bước ra khỏi khung hình thì trận tự tạm dừng; đứng lại vào khung 1 giây thì đếm ngược 3-2-1 rồi chạy tiếp.

| Phím | Việc |
|---|---|
| C | Đổi bàn phím ↔ cơ thể |
| V | Đổi hiển thị: chia đôi (webcam \| trận) → webcam góc → chỉ game |
| P hoặc nút ⏺ | Bắt đầu/dừng quay video `.webm` (gồm webcam, trận đấu, âm thanh) |
| F3 | Hiện FPS game, FPS tracking, độ trễ |

## Đặt camera và đứng

```
   (camera)                                       ┌───────────┐
   ngang hông–ngực   ◄──────── 2,5 – 3 m ───────► │  2 × 2 m  │  người chơi
   nhìn thẳng                                     │ trống,    │  đứng nghiêng 45°,
                                                  │ sàn không │  thấy cả đầu và chân
   ánh sáng chiếu từ phía sau camera ──►          │ trơn      │
                                                  └───────────┘
```

- **Đứng nghiêng khoảng 45°** so với camera (ví dụ vai trái hướng về camera), giống tư thế võ sĩ. Đấm thẳng vào camera khi đứng đối diện gần như không đo được, vì webcam không thấy được chiều sâu.
- **Calibrate ở đúng tư thế bạn sẽ chơi.** Đổi tư thế thì bấm Calibrate lại.
- Block là **hai tay che kín mặt**, sát hơn tư thế thủ thế bình thường.
- Camera cao khoảng ngang hông, nhìn thẳng. Đứng cách camera **2,5–3 m**, phải thấy cả đầu lẫn bàn chân.
- Ánh sáng chiếu từ phía trước, tránh đứng ngược sáng cửa sổ.
- Dọn sạch khoảng trống khoảng 2 × 2 m. Đi giày hoặc chân trần trên sàn không trơn.

## An toàn

Game bắt bạn vận động thật: chừa khoảng trống 2 × 2 m, đi chân trần trên sàn không trơn hoặc mang giày thể thao, khởi động 1 phút, đá vừa sức, nghỉ sau mỗi 2–3 trận và dừng ngay nếu đau hoặc chóng mặt.

## Deploy

Push lên `main` sẽ chạy `.github/workflows/pages.yml`: cài, `npm run setup` (tải model + WASM), `npm run check`, build rồi đăng `dist/` lên GitHub Pages. Lần đầu cần bật **Settings → Pages → Source: GitHub Actions** trong repo.

## Motion Lab

Màn hình 1280×720 chia đôi: **trái** là webcam lật gương, skeleton và tên động tác; **phải** là FPS, độ trễ, biểu đồ feature kèm ngưỡng và log sự kiện.

1. Bấm **🎯 Calibrate**, đứng thủ thế yên khoảng 2 giây cho tới khi hiện "Sẵn sàng!". Calibration được lưu lại cho lần sau.
2. Thử các động tác:

| Động tác thật | Nhận diện |
|---|---|
| Đấm tay trái / phải từ thủ thế (duỗi khuỷu rõ ràng) | LEFT / RIGHT PUNCH |
| Đá nhanh chân trái / phải (chân kia trụ đất) | LEFT / RIGHT KICK |
| Bật nhảy | JUMP |
| Hai tay che kín mặt | BLOCK |
| Hạ thấp hông | CROUCH |
| Nghiêng thân, hông giữ yên | DODGE ◄ / ► |
| Dịch cả người sang trái / phải khỏi vị trí giữa | MOVE ◄ / ► |

3. Thanh công cụ:
   - **⏺ Record video** (phím `R`): quay toàn bộ canvas thành file `bodyfighter-YYYYMMDD-HHmmss.webm`.
   - **💾 Ghi phiên**: ghi landmark ra file JSON để phát lại hoặc phân tích.
   - **⚡ Quick capture**: thu nhanh khoảng 1 phút (đấm trái, đấm phải, block, thủ thế) có nhãn.
   - **🎯 Guided capture**: kịch bản thu dữ liệu có nhãn đầy đủ, khoảng 7 phút (phím `N` để bỏ qua bước). Kết thúc sẽ tải về `guided-*.json`.
   - **▶ Phát lại**: chọn hoặc kéo thả file phiên vào canvas. Nếu file có nhãn, bảng precision/recall hiện ở panel phải.

## Đo độ trễ glass-to-glass

Bảng debug chỉ đo từ lúc frame được capture tới lúc ra event. Muốn đo toàn bộ (camera → màn hình), dùng điện thoại quay slow-mo 240 fps cảnh bạn đấm, có màn hình trong khung hình. Đếm số frame từ lúc tay duỗi hết tới lúc chữ "PUNCH" hiện lên, rồi chia cho 240 để ra giây.

## Đồ hoạ: nhân vật và sân đấu

Nhân vật và animation lấy từ **Mixamo (Adobe)**, render thành sprite 2D bằng Blender. Sân phố đêm neon được dựng hoàn toàn bằng script. Sprite và nền đã render nằm sẵn trong `public/`, nên chơi không cần Blender.

Muốn render lại (ví dụ sau khi đổi animation):

1. Cài Blender (bản LTS). Đặt file Mixamo vào `art/raw/characters/fighter_a.fbx`, `fighter_b.fbx` và `art/raw/anims/<tên>.fbx` (danh sách trong `art/sprites.json`). Thư mục `art/raw/` không được đưa lên git, vì điều khoản Mixamo không cho phát tán file gốc.
2. `npm run render:sprites`: render mọi clip ra `art/render/` (khoảng 3 phút). Thêm `-- --only fighter_a --clips punch_l` để render riêng.
3. `npm run preview:sprites`: ảnh xem trước `art/render/<fighter>/_preview.png`, khung "chạm" của mỗi đòn có viền đỏ.
4. `.venv\Scripts\python tools/sprites/pack.py`: ghép atlas WebP vào `public/sprites/`.
5. `npm run render:stage`: dựng và render sân vào `public/stages/neon_street/`.

Mốc khung của mỗi clip (`start`, `impact`, `end`) nằm trong `art/sprites.json`. Thêm `-- --scan 4` vào lệnh render rồi chạy `tools/sprites/scan_sheet.py <fighter> <clip>` để xem toàn bộ clip có đánh số khung.

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
