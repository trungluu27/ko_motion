# AI khó hơn – Thiết kế

Ngày: 2026-11-01. Bổ sung cho spec chính (`2026-10-31-body-fighter-design.md`), mục 6.3 và 8.

## 1. Vấn đề (đo được)

Bench tất định: 20 seed cho mỗi cặp, bot dùng bàn phím đấu với AI có telegraph 24 frame.

| AI | Bot chỉ spam kick_r | Bot chỉ spam kick_l | Bot chỉ spam punch_l | Người chơi đứng im |
|---|---|---|---|---|
| Easy | AI thắng 0/20 | 0/20 | 0/20 | 20/20 |
| Normal | 0/20 | 0/20 | 0/20 | 20/20, **0 cú đá** (chỉ punch_l/punch_r/special) |
| Hard | 0/20 | 0/20 | 7/20 | 20/20 |

Nguyên nhân:
1. **Telegraph 24 frame cộng vào mọi đòn**, kể cả đòn trừng phạt. Vì vậy AI không trừng phạt kịp lúc người chơi đang recovery. Đòn nhanh nhất của AI cũng cần 28 frame startup.
2. **AI đọc trạng thái đối thủ đã trễ `reactionMs`, nhưng không ước lượng hiện tại.** Khi AI "thấy" người chơi đang recovery thì thực tế người chơi đã hồi xong.
3. **AI luôn tiến tới khoảng cách 85 rồi mới ra đòn.** Nó đi xuyên qua tầm đá 150–160 của người chơi và bị đá.
4. **Không có cú đá nào trong combo của Normal** (`comboLen 2` ⇒ luôn là `punch_l, punch_r`). Ở khoảng cách 85 thì AI chỉ chọn combo, nên Normal không bao giờ đá.

## 2. Thay đổi

### 2.1 Sim: telegraph theo đòn
- Thêm vào action `attack` trường tuỳ chọn `telegraph?: number`. `startAttack` ghi giá trị này lúc đòn bắt đầu: bằng `0` nếu đối thủ **đang recovery của một đòn** (frame ≥ startup + active), nếu không thì bằng `f.extraStartup`. `startupOf` và phần render đọc `action.telegraph ?? f.extraStartup`.
- Ý nghĩa: telegraph tồn tại để người chơi kịp block hoặc né. Khi người chơi đang recovery thì họ không làm được gì, nên trừng phạt là hợp lệ (đây là luật chung của thể loại game này).

### 2.2 Telegraph theo kiểu điều khiển
- Chế độ cơ thể vẫn là `NPC_TELEGRAPH = 24` (400 ms, theo spec 6.3, vì input cơ thể trễ khoảng 150 ms).
- Chế độ bàn phím dùng `NPC_TELEGRAPH_KEYBOARD = 12` (200 ms). Vẫn có nhấp nháy vàng nhưng bàn phím không cần 400 ms.
- `telegraphFor(control)` được gọi khi tạo trận và khi chuyển C/bàn phím giữa trận (gán lại `extraStartup` của NPC).

### 2.3 AI
- **Ước lượng hiện tại:** frame hiện tại của đòn đối thủ = `seen.frame + reactionFrames`. Dùng giá trị này để biết còn bao nhiêu frame recovery. AI vẫn chỉ *biết* có đòn sau `reactionMs`.
- **Trừng phạt (counter):** chọn đòn sao cho `max(0, (d − range)/WALK_SPEED) + startup ≤ recovery còn lại`. Thứ tự ưu tiên: đòn mạnh nhất kịp trúng. Nếu cần bước tới thì AI đi tới rồi đánh, thay vì huỷ.
- **Block rồi trừng phạt:** sau blockstun của chính mình, AI biết ngay đối thủ vừa ra đòn (không có trễ cảm nhận) và lăn xúc xắc counter.
- **Giữ khoảng cách (footsies):** khi không tấn công, AI đứng ở `tầm xa nhất của đối thủ + 15` (tầm xa nhất của đối thủ là 160 nếu đủ stamina cho kick_r). Đối thủ bước vào tầm thì AI giơ thủ theo `blockChance`. Khi `aggression` cho phép tấn công, AI chọn tiến vào tầm punch (85) hoặc chỉ tới tầm kick (145) theo xác suất 50/50.
- **Cú đá:** ở tầm 121–160 AI chỉ chọn kick. Combo 2 đòn có thêm `punch_l→kick_r` và `punch_r→kick_l`.
- **Dodge phản xạ** chỉ khi đòn theo ước lượng vẫn chưa hết active.
- **Thủ thấp:** với người chơi thiên về đấm (adaptive `block > 1`), 60% số lần thủ là ngồi xuống (né được đòn high) thay vì block.
- **Thủ cả khi đang áp sát:** khi vào tầm của đối thủ và đối thủ không ở recovery, AI vẫn lăn `blockChance`, kể cả khi đang tiến vào để đánh.
- **Đòn trừng phạt:** ưu tiên đấm (hồi nhanh hơn hitstun của đối thủ), chỉ dùng đá khi đấm không kịp. Được phép trúng trễ hơn lúc hồi của đối thủ tối đa 3 frame (`PUNISH_SLACK`), vì đòn nhanh nhất của họ cũng cần 4 frame.

### 2.4 Bảng độ khó mới (thay bảng ở spec 8)

| Tham số | Easy | Normal | Hard |
|---|---|---|---|
| reactionMs | 600 | 300 | 220 |
| aggression | 0.25 | 0.5 | 0.65 |
| blockChance / dodgeChance | 0.15 / 0.05 | 0.55 / 0.15 | 0.65 / 0.25 |
| counterChance | 0 | 0.65 | 0.85 |
| comboLen | 1 | 2 | 3 |
| idlePauseMs | 1200 | 600 | 300 |

## 3. Tiêu chí đạt (test `tests/game/ai/ladder.test.ts`, 20 seed, bàn phím)

- Hard thắng ít nhất 16/20 trước mỗi bot spam (kick_r, kick_l, punch_l).
- Normal thắng ít nhất 5/20 trước mỗi bot spam và ít nhất 25/60 tổng cộng. (Ban đầu đặt 10/20 cho mỗi bot. Muốn đạt mức đó với bot spam punch_l thì Normal phải phản xạ nhanh như Hard, nên mục tiêu đã được hạ xuống.)
- Easy thắng ít hơn Normal trước tổng các bot spam, để vẫn dễ.
- Normal và Hard: khi đấu với người chơi đứng im, cú đá chiếm ít nhất 25% số đòn AI ra.
- Chế độ cơ thể (telegraph 24): Hard vẫn thắng ít nhất 10/20 trước bot spam kick_r.

## 4. Ngoài phạm vi
Không thêm đòn hay luật combat mới, không đổi frame data của người chơi. Không đụng tới cân bằng nhận diện bằng cơ thể.
