# AI khó hơn – Implementation Plan

**Goal:** AI Normal/Hard không còn thua bot spam một nút, và có dùng cú đá.

**Spec:** `docs/superpowers/specs/2026-11-01-ai-difficulty-design.md`

## Global Constraints
- Sim vẫn phải tất định. AI chỉ dùng RNG có seed.
- Telegraph ở chế độ cơ thể vẫn là 24 frame.
- 224 test hiện có phải còn xanh. Test cũ nào cố định hành vi cũ (ví dụ "Normal luôn combo 2 đấm") thì sửa cho khớp spec mới, và ghi lại thành Ruling.

## Review Focus
- Đòn trừng phạt bỏ telegraph không được kích hoạt khi đối thủ đang startup/active, chỉ khi đang recovery.
- Đổi chế độ điều khiển giữa trận không được làm hỏng đòn đang ra (telegraph đã được ghi vào action).
- AI đang đi tới để counter phải dừng khi hết thời gian recovery dự tính.
- AI không được kẹt ở mép sân khi giữ khoảng cách.

### Task 1: Ladder test (RED)
- Tạo `tests/game/ai/ladder.test.ts` từ `tests/bench/bench.test.ts`, dùng các tiêu chí ở spec mục 3, rồi xoá `tests/bench`.
- Chạy `npx vitest run tests/game/ai/ladder.test.ts`. Kỳ vọng: FAIL.

### Task 2: Telegraph theo đòn (sim) và theo kiểu điều khiển
- `types.ts`: `telegraph?: number` trên action attack.
- `match.ts`: `startAttack` ghi telegraph (bằng 0 khi đối thủ đang recovery); `startupOf(f, action)` đọc giá trị này.
- `constants.ts`: `NPC_TELEGRAPH_KEYBOARD = 12` và `telegraphFor(control)`.
- `spriteAnim.ts` và `fighterSprite.ts` đọc telegraph từ action.
- `FightScene`: dùng `telegraphFor` khi tạo trận và khi đổi control.
- Test: `tests/game/telegraph.test.ts` gồm: punish khi đối thủ recovery thì telegraph 0; khi đối thủ đang startup thì telegraph đầy đủ; `telegraphFor` trả về 24 cho body và 12 cho keyboard.

### Task 3: AI ước lượng, trừng phạt, giữ khoảng cách, đá
- `fsm.ts`: thêm `reactionFrames` vào `BrainContext` (aiInput truyền vào). Thêm `predictedFrame`, `punishMove`, counter có bước tới kèm hạn, block rồi punish, hover ở `threat + 15`, chọn kick ở tầm 121–160, `COMBO_2`.
- `difficulty.ts`: bảng mới.
- Test đơn vị trong `tests/game/ai/fsm.test.ts`: chọn punish theo recovery còn lại; hover ngoài tầm; kick ở tầm 140.
- Chạy toàn bộ suite cùng ladder: xanh hết.

### Task 4: Cập nhật spec chính mục 8 và README nếu có bảng độ khó, rồi commit.
