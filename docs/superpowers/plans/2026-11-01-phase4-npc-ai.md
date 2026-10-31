# Phase 4 – NPC AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay bao cát bằng đối thủ AI biết tiếp cận, tấn công theo combo, thủ thế, né, phản đòn, lùi khi mệt và dùng special, với 3 cấp độ Easy / Normal / Hard và khả năng thích nghi theo thói quen người chơi.

**Architecture:** AI là một nguồn input trả về `TickInput` mỗi tick, đi qua đúng `stepMatch` và luật như người chơi; telegraph 24 frame vẫn do `extraStartup` của sim đảm nhiệm. AI nhìn **bản thân theo thời gian thực** nhưng nhìn **đối thủ trễ `reactionMs`** (bộ đệm `Perception`). Máy trạng thái (`fsm.ts`) ra quyết định mỗi 6 tick (100 ms). Mọi ngẫu nhiên đi qua RNG có seed, nên test tất định.

**Tech Stack:** TypeScript, Vitest (không thêm thư viện).

**Spec:** `docs/superpowers/specs/2026-10-31-body-fighter-design.md` mục 8 (cùng 6.3 về telegraph).

## Global Constraints

- `src/game/ai/*` và `src/shared/rng.ts` là TS thuần (không Phaser/DOM). Mọi ngẫu nhiên lấy từ `Rng` truyền vào; không dùng `Math.random`.
- Bảng `DIFFICULTIES` đúng spec 8: reactionMs 600/400/250; aggression 0.25/0.45/0.6; blockChance 0.15/0.4/0.55; dodgeChance 0.05/0.15/0.25; counterChance 0/0.3/0.6; comboLen 1/2/3; idlePauseMs 1200/700/400.
- Quyết định mỗi `DECISION_FRAMES = 6` tick. Đổi ms sang frame: `Math.round(ms * 60 / 1000)`.
- Thích nghi chỉ bật ở Normal/Hard; mỗi hệ số nhân nằm trong `[0.7, 1.3]`; xác suất sau khi nhân kẹp ≤ 0.95. Cửa sổ thống kê 20 s = 1200 tick.
- AI không được đọc input của người chơi, chỉ đọc trạng thái sim đã trễ.

## Review Focus

1. **Chạy cả trận AI vs AI hoặc AI vs người đứng yên:** không ném lỗi, trận kết thúc bằng KO hoặc hết giờ, AI không kẹt mãi ở một trạng thái. Test ở Task 6.
2. **AI hết stamina:** không spam đòn vô ích (`tired` liên tục). Nó lùi lại hồi sức. Test ở Task 4.
3. **AI ở mép sân:** vẫn thoát ra được, không đứng yên mãi khi lùi bị chặn. Test ở Task 4.
4. **Đổi cấp độ giữa trận hoặc đấu lại:** AI mới không mang theo trạng thái cũ (thống kê, kế hoạch dở dang). Test ở Task 6.
5. **Trận đã có kết quả:** AI vẫn trả input hợp lệ, không lỗi. Test ở Task 6.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/shared/rng.ts` | `createRng(seed)` (mulberry32) |
| `src/game/ai/difficulty.ts` | `DifficultyParams`, `DIFFICULTIES`, `msToFrames` |
| `src/game/ai/perception.ts` | Bộ đệm trạng thái đối thủ, trả về bản trễ `reactionFrames` |
| `src/game/ai/adaptive.ts` | Thống kê 20 s và hệ số nhân thích nghi |
| `src/game/ai/fsm.ts` | `AiBrain`: các state và quyết định |
| `src/game/ai/aiInput.ts` | `AiInput`: ghép perception, adaptive và brain thành `next(match): TickInput` |
| `src/game/scenes/FightScene.ts` | Chọn cấp độ, thay bao cát bằng AI |

---

### Task 1: RNG và bảng độ khó

**Files:** Create `src/shared/rng.ts`, `src/game/ai/difficulty.ts`. Test `tests/game/ai/difficulty.test.ts`.

**Interfaces – Produces:**
```ts
type Rng = () => number;                       // [0, 1)
function createRng(seed: number): Rng;         // mulberry32
type Difficulty = 'easy' | 'normal' | 'hard';
type DifficultyParams = { reactionMs: number; aggression: number; blockChance: number; dodgeChance: number;
                          counterChance: number; comboLen: 1 | 2 | 3; idlePauseMs: number; adaptive: boolean };
const DIFFICULTIES: Record<Difficulty, DifficultyParams>;   // adaptive: easy false, normal/hard true
const DECISION_FRAMES = 6;
function msToFrames(ms: number): number;
```
- [ ] Test: bảng đúng từng giá trị spec; `createRng(42)` hai lần cho cùng 5 số đầu, mọi số trong [0, 1); `createRng(1)` khác `createRng(2)`; `msToFrames(250) === 15`, `msToFrames(600) === 36`.
- [ ] FAIL → cài đặt → PASS → commit `feat(ai): seeded rng and difficulty table`.

### Task 2: Perception (phản xạ trễ)

**Files:** Create `src/game/ai/perception.ts`. Test `tests/game/ai/perception.test.ts`.

**Interfaces – Produces:**
```ts
type Seen = { x: number; action: Action; hp: number; stamina: number; special: number };
class Perception {
  constructor(reactionFrames: number);
  observe(opponent: Fighter): void;   // gọi mỗi tick, lưu bản sao sâu của action
  seen(): Seen | null;                // trạng thái cách đây reactionFrames tick; null khi chưa đủ lịch sử
}
```
- [ ] Test: reaction 3 → sau 2 lần `observe` thì `seen()` null; sau 4 lần trả về bản của lần thứ 1. Đổi `action` của fighter sau khi observe không làm đổi bản đã lưu. Bộ đệm không phình quá `reactionFrames + 1`.
- [ ] FAIL → cài đặt → PASS → commit `feat(ai): delayed perception of the opponent`.

### Task 3: Thích nghi

**Files:** Create `src/game/ai/adaptive.ts`. Test `tests/game/ai/adaptive.test.ts`.

**Interfaces – Produces:**
```ts
type Multipliers = { block: number; dodge: number; aggression: number; counter: number; kickBias: number };
class PlayerStats {
  observe(events: SimEvent[], player: Fighter, playerIndex: 0 | 1, frame: number): void;   // đếm attack theo move, block/dodge theo frame bắt đầu
  multipliers(frame: number): Multipliers;   // chỉ tính dữ liệu trong 1200 frame gần nhất; mỗi hệ số trong [0.7, 1.3]
}
const NEUTRAL: Multipliers;   // tất cả 1
```
Quy tắc (concept doc 5.3), với `n` = tổng số đòn của người chơi trong cửa sổ, chỉ áp dụng khi `n ≥ 5`:
1. Tỉ lệ đấm > 0.6 → `block` 1.3.
2. Tỉ lệ đá > 0.4 → `dodge` 1.3 và `kickBias` 0.7 (AI giữ khoảng cách, ít áp sát).
3. Số lần block ≥ 30% số đòn của AI trong cửa sổ, hoặc block ≥ 5 lần → `aggression` 1.3 và `kickBias` 1.3 (đòn nặng để rút stamina, gây vỡ thủ).
4. Hơn 1 đòn/giây → `counter` 1.3.

- [ ] Test: không có dữ liệu → `NEUTRAL`; 10 cú đấm trong 5 s → `block` 1.3; 6 cú đá + 2 cú đấm → `dodge` 1.3, `kickBias` 0.7; dữ liệu cũ hơn 1200 frame không được tính; mọi hệ số luôn trong [0.7, 1.3].
- [ ] FAIL → cài đặt → PASS → commit `feat(ai): adaptive player statistics`.

### Task 4: Máy trạng thái: tiếp cận, tấn công, lùi, special

**Files:** Create `src/game/ai/fsm.ts`. Test `tests/game/ai/fsm.test.ts`.

**Interfaces – Produces:**
```ts
type AiState = 'idle' | 'approach' | 'attack' | 'block' | 'dodge' | 'counter' | 'retreat' | 'special';
type BrainContext = { self: Fighter; seen: Seen | null; frame: number; params: DifficultyParams; mult: Multipliers };
class AiBrain {
  constructor(rng: Rng);
  get state(): AiState;
  next(ctx: BrainContext): TickInput;   // gọi mỗi tick; quyết định lại mỗi DECISION_FRAMES tick hoặc khi kế hoạch xong
}
```
Hành vi (Task 4 phần tấn công; phòng thủ ở Task 5):
- Khoảng cách `d = |seen.x − self.x|`. Đòn có thể dùng là các đòn có `range ≥ d`. Chuỗi tấn công lấy từ danh sách theo `comboLen`: 1 → một đòn trong tầm; 2 → `[punch_l, punch_r]`; 3 → `[punch_l, punch_r, kick_r]` hoặc `[punch_r, kick_l, kick_r]`. Chọn ngẫu nhiên; nếu `kickBias > 1` thì ưu tiên chuỗi có đá. Đòn tiếp theo được ra ngay khi AI rảnh.
- `approach`: đi về phía đối thủ khi `d > 150 · kickBias` (giữ xa hơn khi `kickBias < 1`).
- Tại mỗi lần quyết định, khi trong tầm: với xác suất `aggression · mult.aggression` thì `attack`, ngược lại `idle` trong `idlePauseMs`.
- `retreat`: khi stamina < 20, đi ra xa tới khi stamina ≥ 50. Nếu bị kẹt mép sân (x ≤ 35 hoặc ≥ 965) thì đổi sang `approach`/`attack` thay vì đứng yên.
- `special`: khi special = 100 và `d ≤ 220` thì `punch_l`, tick sau `punch_r` (sim tự huỷ thành special).
- Mặt nhìn và hướng đi tính theo dấu `seen.x − self.x`.

- [ ] Test (seed cố định, `params` tuỳ biến):
  - Đứng xa (d = 400) → `move` hướng về đối thủ, state `approach`.
  - Trong tầm, aggression 1 → trong 6 tick có `attack` khác null.
  - comboLen 2, aggression 1, đối thủ đứng yên trong tầm → chuỗi gồm `punch_l` rồi `punch_r`.
  - Stamina 10 → state `retreat`, `move` hướng ra xa.
  - Stamina 10 và x = 30 (kẹt mép) → không giữ `retreat` quá 1 quyết định.
  - Special 100, d = 150 → `punch_l` rồi `punch_r` ở hai tick liên tiếp.
- [ ] FAIL → cài đặt → PASS → commit `feat(ai): approach, attack combos, retreat and special`.

### Task 5: Máy trạng thái: thủ thế, né, phản đòn

**Files:** Modify `fsm.ts`. Test `tests/game/ai/defense.test.ts`.

Hành vi:
- **Thủ thế phòng bị** (`block`): tại mỗi lần quyết định, nếu đối thủ (theo `seen`) đang `attack` hoặc rảnh mà `d ≤ 170`, thì với xác suất `blockChance · mult.block` giữ block 18–36 frame (ngẫu nhiên). Thả block sớm nếu đối thủ ra xa > 220.
- **Né** (`dodge`): nếu không block, với xác suất `dodgeChance · mult.dodge` khi `seen.action` là `attack` ở pha khởi động và trong tầm của đòn đó → bấm dodge một tick.
- **Phản đòn** (`counter`): nếu `seen.action` là `attack` ở pha recovery (`frame ≥ startup + active`, không tính telegraph của người chơi vì `extraStartup` người chơi = 0), hoặc đang `blockstun`, và có đòn trong tầm, thì với xác suất `counterChance · mult.counter` ra ngay đòn nhanh nhất trong tầm (punch_l, rồi punch_r, kick_l, kick_r). Mỗi đòn của đối thủ chỉ tung xúc xắc một lần (nhớ `frame` bắt đầu).
- Thứ tự ưu tiên khi quyết định: counter > special > dodge > block > retreat > attack > approach > idle.

- [ ] Test:
  - blockChance 1, aggression 0, đối thủ rảnh ở d = 120 → AI giữ `block` trong các tick tiếp theo; d = 400 → không block.
  - counterChance 1, `seen` là kick_r đang recovery ở d = 100 → `attack` ngay tick quyết định đó, move là `punch_l`.
  - counterChance 0 → không phản đòn.
  - dodgeChance 1, blockChance 0, `seen` là kick_l ở frame 2 trong tầm → `dodge: true`.
  - Cùng một đòn của đối thủ, counterChance 0.5 → chỉ tung xúc xắc một lần (dùng RNG giả trả về chuỗi số cố định để kiểm tra số lần gọi).
- [ ] FAIL → cài đặt → PASS → commit `feat(ai): anticipatory guard, dodge and recovery punishes`.

### Task 6: AiInput và test tích hợp

**Files:** Create `src/game/ai/aiInput.ts`. Test `tests/game/ai/aiInput.test.ts`.

**Interfaces – Produces:**
```ts
class AiInput {
  constructor(difficulty: Difficulty, self: 0 | 1, seed?: number);   // seed mặc định 1
  readonly difficulty: Difficulty;
  next(m: Match): TickInput;   // observe → (adaptive nếu bật) → brain.next; trả NO_INPUT khi m.result != null
}
```
- [ ] Test:
  - AI Normal (fighter 1, telegraph 24) vs người chơi đứng yên, 60 s → người chơi mất HP > 0, không lỗi **[RF1]**.
  - AI Hard vs AI Easy (cả hai telegraph 24), tối đa 99 s → trận có `result`, mỗi bên ra ít nhất 5 đòn (không kẹt) **[RF1]**.
  - Cùng seed, hai lần chạy 600 tick → chuỗi `TickInput` giống hệt (tất định).
  - Hard thắng Easy ở ít nhất 7/10 seed (AI vs AI, `result.winner` hoặc HP cao hơn).
  - AI mới tạo cho trận mới không mang thống kê cũ (`new AiInput` là sạch; scene tạo mới khi đổi cấp độ hoặc đấu lại) **[RF4]**.
  - Sau khi có `result`, `next` trả `NO_INPUT` **[RF5]**.
  - Bị dồn vào mép (x = 30) và stamina 5, trong 300 tick AI vẫn ra khỏi mép hoặc ra đòn **[RF3]**.
- [ ] FAIL → cài đặt → PASS → commit `feat(ai): AI input source with integration tests`.

### Task 7: Đưa AI vào màn đánh

**Files:** Modify `src/game/scenes/FightScene.ts`, `README.md`.

- Phím `1/2/3` = AI Easy/Normal/Hard (mặc định Normal); phím `0` = bao cát ra jab (để luyện). Đổi chế độ thì đấu lại với AI mới (seed = `Date.now()`).
- Dòng hướng dẫn dưới màn hình hiện cấp độ hiện tại.
- README: cập nhật bảng phím và trạng thái Phase 4.
- [ ] `npm run check` và `npm run build` xanh.
- [ ] Kiểm tra thủ công: Easy dễ thắng, Hard khó hơn rõ rệt; AI tiến lại, ra combo, thủ thế khi bạn áp sát, phạt cú đá hụt (Hard), lùi khi mệt, dùng special khi đầy thanh tím.
- [ ] Commit `feat(game): fight the AI at three difficulty levels`.
