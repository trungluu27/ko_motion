# BODY FIGHTER – Nâng cấp đồ hoạ: nhân vật Mixamo và sân phố đêm neon (Design Spec)

> Ngày: 2026-11-01 · Spec gốc: `2026-10-31-body-fighter-design.md` (mục 6.4 phần render)
> Trạng thái: Draft chờ review

## 1. Mục tiêu

Thay võ sĩ stick-fighter và nền lưới neon bằng **nhân vật chân thực** (model 3D cùng animation motion-capture từ Mixamo, render thành sprite 2D) và **sân phố đêm neon**, theo phong cách game đối kháng 2D hiện đại. Nhân vật và bối cảnh là **nguyên bản**, không dùng tài sản của Street Fighter.

**Thành công khi:**
1. Hai nhân vật khác ngoại hình (người chơi và AI) có đủ animation cho mọi trạng thái của sim.
2. Khung "chạm" của mỗi đòn trùng frame active đầu tiên trong frame data (spec gốc 6.1), sai lệch ≤ 1 frame game.
3. Sân phố đêm neon có 3 lớp thị sai, ánh sáng nhân vật ăn khớp với nền.
4. Game vẫn chạy (vẽ stick-fighter) khi chưa có sprite.
5. Game giữ ≥ 55 FPS ở chế độ bàn phím trên máy người dùng.

**Ngoài phạm vi:** màn chọn nhân vật, nhiều sân đấu, animation đứng dậy sau KO, block khi cúi, âm thanh mới.

## 2. Phân công

| Ai | Việc |
|---|---|
| Người dùng | Cài Blender (bản LTS mới nhất); tạo tài khoản Adobe miễn phí; tải 2 nhân vật và 17 animation từ Mixamo theo mục 3; đặt đúng tên file |
| Claude | Script Blender render nhân vật và sân đấu; công cụ ghép atlas; mã game; chạy Blender ở chế độ nền trên máy người dùng để render |

## 3. Asset đầu vào (`art/raw/`, không commit)

Điều khoản Mixamo cho phép dùng nhân vật và animation trong game, nhưng không cho phát tán file gốc. Vì vậy `art/raw/` nằm trong `.gitignore`, chỉ sprite đã render mới được commit.

**Nhân vật** (`art/raw/characters/`): tải với *Format: FBX Binary (.fbx)*, *Pose: T-pose*.
- `fighter_a.fbx`: người chơi
- `fighter_b.fbx`: đối thủ (ngoại hình khác hẳn A)

**Animation** (`art/raw/anims/`): chọn một nhân vật bất kỳ trên Mixamo rồi tải với *Format: FBX Binary*, *Skin: Without Skin*, *Frames per Second: 60*, *Keyframe Reduction: none*, và **bật "In Place"** nếu animation có tuỳ chọn này. Mọi nhân vật Mixamo dùng chung tên xương `mixamorig:*`, nên một file animation dùng được cho cả hai nhân vật.

| Tên file | Từ khoá tìm trên Mixamo | Yêu cầu |
|---|---|---|
| `idle.fbx` | fight idle / boxing idle | Thủ thế tại chỗ, lặp được |
| `walk_fwd.fbx` | boxing step forward / fight walk forward | Tiến (In Place) |
| `walk_back.fbx` | boxing step backward / fight walk back | Lùi (In Place) |
| `jump.fbx` | jump (in place) | Bật nhảy tại chỗ |
| `crouch.fbx` | crouch / crouching idle | Ngồi thấp thủ thế |
| `punch_l.fbx` | lead jab / jab | Đấm nhanh tay trước |
| `punch_r.fbx` | cross punch / punching | Đấm thẳng tay sau |
| `kick_l.fbx` | front kick / mma kick | Đá chân trước |
| `kick_r.fbx` | roundhouse kick | Đá vòng chân sau |
| `special.fbx` | hurricane kick / power punch / uppercut | Đòn mạnh, có thể xoay người |
| `block.fbx` | body block / boxing block | Hai tay che mặt |
| `dodge.fbx` | dodging / dodge back | Né người ra sau |
| `hit_high.fbx` | head hit / hit reaction | Bị đấm vào mặt |
| `hit_mid.fbx` | stomach hit / body hit | Bị đá vào thân |
| `knockdown.fbx` | knocked down / dying | Ngã xuống sàn |
| `victory.fbx` | victory / cheering | Ăn mừng |
| `defeat.fbx` | defeated / disappointed | Thất vọng (dùng khi thua lúc hết giờ) |

## 4. Pipeline render (`tools/blender/`, `tools/sprites/`)

### 4.1. Cấu hình `art/sprites.json` (commit)

Với mỗi clip: file nguồn, đoạn khung dùng (`start`, `end`, tính theo khung 60 fps của file), kiểu (`loop` / `once` / `hold`), và với đòn đánh thêm **`impact`**: khung trong clip mà nắm tay hoặc chân duỗi hết. Người dùng không cần sửa file này. Claude điền giá trị ban đầu, rồi chỉnh theo ảnh xem trước (contact sheet) do script xuất ra.

### 4.2. Lấy mẫu khớp frame data (thuần, có test)

- Clip đòn đánh có `S` frame khởi động, `A` frame active, `R` frame hồi (spec gốc 6.1). Clip được lấy mẫu **1 sprite cho mỗi 2 frame game**: `[start, impact]` chia đều cho khởi động, `impact` giữ trong pha active, `[impact, end]` chia đều cho pha hồi. Nhờ vậy khung sprite tại frame active đầu tiên chính là `impact`.
- Clip lặp (idle, walk) lấy mẫu 30 sprite/giây. Clip `hold` (crouch, block) dừng ở khung cuối. Clip `once` (knockdown, victory, defeat) dừng ở khung cuối.
- Hàm `sampleFrames(clip, timing) → number[]` (Python, `tools/sprites/timing.py`) trả về danh sách khung nguồn cần render.

### 4.3. Render (`tools/blender/render_sprites.py`, chạy `blender -b -P … -- --config art/sprites.json --out art/render`)

- Nạp `fighter_*.fbx` và gắn từng animation (theo tên xương `mixamorig`) cho armature.
- Camera **orthographic**, nhìn ngang có xoay 3/4 khoảng 20° kiểu game đối kháng 2.5D. Nhân vật quay mặt về **bên phải**.
- Ánh sáng: key trắng ấm phía trước, rim **cyan** bên trái, rim **hồng/magenta** bên phải (ăn khớp phố neon). Engine **EEVEE**, nền trong suốt (*Film > Transparent*), 384 px chiều cao khung.
- Xuất `art/render/<fighter>/<clip>_<NNN>.png` và một contact sheet `art/render/<fighter>/_preview.png` để kiểm tra bằng mắt.

### 4.4. Ghép atlas (`tools/sprites/pack.py`, Python + Pillow, có test)

- Cắt viền trong suốt từng khung, ghép thành **multi-atlas** (mỗi trang ≤ 4096×4096) theo định dạng JSON của Phaser (`public/sprites/<fighter>.json` + `…-N.png`).
- Ghi kèm **anchor chân** (điểm giữa hai bàn chân ở khung idle) để đặt nhân vật đúng mặt sàn, cùng số khung mỗi clip.

### 4.5. Sân phố đêm neon (`tools/blender/build_stage.py`)

- Dựng hoàn toàn bằng script, không tải thêm asset: dãy nhà hộp nhiều độ cao, cửa sổ phát sáng ngẫu nhiên, biển hiệu neon (cyan, hồng, tím, chữ ngắn tự đặt, không dùng thương hiệu thật), cột đèn, mặt đường bóng ướt phản chiếu (EEVEE screen-space reflections), sương nhẹ.
- Render ra 3 lớp, mỗi lớp 2560×720: `stage/far.jpg` (trời và toà nhà xa), `stage/mid.png` (mặt phố, alpha), `stage/floor.png` (mặt đường, alpha). Lưu ở `public/stages/neon_street/`.

## 5. Trong game

### 5.1. Chọn khung hình (`src/game/render/spriteAnim.ts`, thuần, có test)

`spriteFrame(f: Fighter, ctx: { prevX: number; lastHitMove: MoveId | null; result: MatchResult | null; frameCount: number; clips: ClipInfo }) → { clip: ClipName; index: number }`

| Trạng thái sim | Clip |
|---|---|
| `idle` | `idle` (lặp theo thời gian) |
| `walk` | `walk_fwd` nếu đi về phía đối thủ, ngược lại `walk_back` |
| `crouch` | `crouch` |
| `jump` | `jump`, chỉ số = `frame / JUMP_FRAMES` |
| `attack` | clip theo `move`; chỉ số = `(frame − telegraph đã trừ) / 2`. Telegraph (`extraStartup`) giãn đều pha khởi động |
| `block`, `blockstun` | `block` |
| `dodge` | `dodge` |
| `hitstun` | `hit_high` nếu đòn trúng gần nhất là đấm, `hit_mid` nếu là đá hoặc special |
| `ko` | `knockdown` (dừng khung cuối) |
| Sau khi có kết quả | người thắng `victory`; người thua khi hết giờ `defeat` |

### 5.2. Vẽ (`src/game/render/fighterSprite.ts`)

- Phaser `Sprite` từ multi-atlas, `flipX` khi `facing = −1`, kích thước theo `bodyScale` của bố cục (cao khoảng 300 px ở chế độ toàn khung), đặt theo anchor chân.
- Bóng elip mờ dưới chân. Chớp trắng 2 frame khi trúng đòn. **Phủ vàng nhấp nháy khi đang telegraph** (giữ cơ chế 0.4 giây của spec gốc 6.3).
- Sân: 3 lớp ảnh. Camera dịch nhẹ theo trung điểm hai võ sĩ (tối đa ±80 px), lớp xa 0.2, lớp giữa 0.5, sàn 1.0, tạo chiều sâu.
- **Dự phòng:** nếu `public/sprites/fighter_a.json` không tải được thì dùng stick-fighter như cũ (log cảnh báo một lần).

## 6. Hiệu năng

- Sprite và nền là texture tĩnh nên tốn ít GPU. Multi-atlas mỗi nhân vật dự kiến 2–4 trang 4096².
- Đo lại FPS bằng F3 sau khi tích hợp. Nếu < 55 FPS ở chế độ cơ thể thì giảm chiều cao khung xuống 320 px hoặc dùng WebP.

## 7. Kiểm thử

- **Python (pytest, `.venv`):** `sampleFrames` (impact rơi đúng frame active đầu tiên với cả 5 đòn), packer (mọi khung có mặt trong atlas, không chồng lấn, trang ≤ 4096).
- **Vitest:** bảng ánh xạ ở 5.1, gồm walk tiến/lùi theo hướng mặt, telegraph giãn pha khởi động, hitstun cao/giữa, victory/defeat.
- **Thủ công:** contact sheet từng nhân vật, chạy game xem đồ hoạ và đo F3.

## 8. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Animation Mixamo không đúng tên hoặc không có "In Place" | Danh sách từ khoá có phương án thay thế; script tự khoá vị trí gốc (root) theo trục ngang |
| Hai nhân vật khác tỉ lệ khiến animation lệch | Mixamo đã retarget sẵn; script chuẩn hoá chiều cao về cùng 384 px |
| Blender chưa có trong PATH | Script tìm ở `C:\Program Files\Blender Foundation\*\blender.exe` hoặc nhận đường dẫn qua biến `BLENDER` |
| Repo to lên | Chỉ commit atlas đã tối ưu (PNG cắt viền; nền dùng JPG khi không cần alpha) |
