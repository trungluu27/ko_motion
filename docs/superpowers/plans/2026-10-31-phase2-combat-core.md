# Phase 2 – Combat Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trận đấu 2D chơi được bằng bàn phím: hai võ sĩ stick-fighter neon, frame data, va chạm, HP/stamina/special, combo, đồng hồ 99 giây. Đối thủ là "bao cát" có thể ra đòn có báo trước (AI thật là Phase 4).

**Architecture:** `src/game/sim/` là mô phỏng **thuần, tất định, fixed-step 60 Hz**: `stepMatch(match, [input0, input1])` đổi trạng thái và phát `SimEvent`. Input vào sim là `TickInput`, dựng từ `ControlFrame` (cùng kiểu Phase 1 dùng) qua `IntentBuilder`, nên bàn phím, cơ thể (Phase 3) và AI (Phase 4) chung một đường. Phaser chỉ đọc trạng thái sim để vẽ (`src/game/render/`) và chạy vòng lặp (`src/game/scenes/FightScene.ts`).

**Tech Stack:** Phaser 3.90 (spec chọn Phaser 3), TypeScript, Vitest, WebAudio.

**Spec:** `docs/superpowers/specs/2026-10-31-body-fighter-design.md` mục 2, 4, 6.

## Global Constraints

- `src/game/sim/*` và `src/game/input/{intent,keyboardMap,dummyInput}.ts` không import Phaser hay DOM. Phaser chỉ ở `src/game/render/*`, `src/game/scenes/*`, `src/main.ts`.
- 60 tick/giây; mọi thời lượng trong sim tính bằng frame. Sân 1000 đơn vị.
- Frame data đúng bảng spec 6.1: Punch L 4/3/10, 5 dmg, 6 stamina, tầm 110, high; Punch R 6/3/14, 8, 8, 120, high; Kick L 8/4/18, 10, 12, 150, mid; Kick R 10/4/20, 13, 14, 160, mid; Special 12/6/30, 25, 0 stamina, tốn 100 special, 220, mid.
- Hằng số spec 6.1/6.2: HP 100, stamina 100, hồi 15/s sau 0.5 s không tiêu stamina; block giảm 80%, tốn 5 stamina, blockstun 8; dodge miễn đòn 20 frame + hồi 12; hitstun 14; hitstop 4; trận 99 s; special +5 khi trúng đòn, +3 khi bị trúng; cửa sổ combo 700 ms (42 frame), Counter trong 1 s (60 frame); special = hai cú đấm trong 250 ms (15 frame) khi special = 100.
- Telegraph đòn NPC ≥ 400 ms: `extraStartup` 24 frame cho bao cát (spec 6.3).
- Bố cục: Phaser canvas 1280×720; trận đấu vẽ trong một viewport (Phase 2 dùng toàn khung; Phase 3 thu về 800 px bên phải).
- Commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `npm run check` xanh trước mỗi commit.

## Review Focus

1. **Hai bên ra đòn cùng frame (trade):** cả hai cùng trúng, không thiên vị bên nào xử lý trước. Test ở Task 3.
2. **Input khi đang hitstun/blockstun/KO hoặc trận đã kết thúc:** bị bỏ qua; sau KO không còn đòn, đồng hồ dừng. Test ở Task 3 và Task 6.
3. **Bị dồn tới mép sân hoặc đi xuyên qua nhau:** vị trí kẹp trong sân, hai võ sĩ không chồng lên nhau, hướng mặt luôn nhìn về đối thủ. Test ở Task 2.
4. **Tab bị ẩn rồi quay lại (delta thời gian rất lớn):** vòng lặp chỉ chạy tối đa 5 tick một khung hình, không treo. Test ở Task 8.
5. **Hết stamina giữa chuỗi đòn hoặc khi đang block:** không ra đòn (event `tired`), stamina không âm; block khi stamina < 5 thì **vỡ thế thủ** (nhận đủ sát thương, choáng 20 frame). Test ở Task 3 và Task 4.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/game/sim/types.ts` | `MoveId`, `Height`, `MoveData`, `Action`, `Fighter`, `TickInput`, `SimEvent`, `Match` |
| `src/game/sim/constants.ts` | Mọi hằng số sim |
| `src/game/sim/moves.ts` | Bảng `MOVES` |
| `src/game/sim/combo.ts` | Bảng combo, bộ đệm, `matchCombo` |
| `src/game/sim/match.ts` | `createMatch`, `stepMatch` (di chuyển, đòn, phòng thủ, kết thúc trận) |
| `src/game/input/keyboardMap.ts` | Phím → `ControlFrame` (thuần) |
| `src/game/input/intent.ts` | `IntentBuilder`: `ControlFrame` → `TickInput` |
| `src/game/input/dummyInput.ts` | Bao cát: đứng yên / ra jab định kỳ |
| `src/game/loop.ts` | `FixedStep` (tích luỹ thời gian, kẹp số tick) |
| `src/game/render/pose.ts` | `poseFor(fighter)` → góc khớp (thuần) |
| `src/game/render/hudModel.ts` | `hudModel(match)` (thuần) |
| `src/game/render/stickFighter.ts`, `effects.ts`, `hud.ts`, `sfx.ts` | Vẽ bằng Phaser / âm thanh WebAudio |
| `src/game/scenes/FightScene.ts`, `src/main.ts` | Vòng lặp trận, khởi động Phaser |

---

### Task 1: Phaser, kiểu dữ liệu sim, bảng đòn

**Files:** Create `src/game/sim/{types,constants,moves}.ts`. Test `tests/game/moves.test.ts`. Modify `package.json` (thêm `phaser@3.90`).

**Interfaces – Produces:**
```ts
type MoveId = 'punch_l' | 'punch_r' | 'kick_l' | 'kick_r' | 'special';
type Height = 'high' | 'mid';
type MoveData = { startup: number; active: number; recovery: number; damage: number; stamina: number; specialCost: number; range: number; height: Height };
const MOVES: Record<MoveId, MoveData>;
type ComboName = 'double_jab' | 'triple_attack' | 'counter' | 'power_combo';
type Action =
  | { kind: 'idle' } | { kind: 'walk' } | { kind: 'block' } | { kind: 'crouch' } | { kind: 'ko' }
  | { kind: 'attack'; move: MoveId; frame: number; hasHit: boolean; evaded: boolean; combo: ComboName | null }
  | { kind: 'dodge'; frame: number } | { kind: 'jump'; frame: number }
  | { kind: 'hitstun'; frames: number } | { kind: 'blockstun'; frames: number };
type Fighter = { x: number; facing: 1 | -1; hp: number; stamina: number; special: number; action: Action;
                 sinceSpend: number; extraStartup: number; history: { token: MoveId | 'block' | 'dodge'; frame: number }[] };
type TickInput = { attack: MoveId | null; block: boolean; crouch: boolean; dodge: boolean; move: -1 | 0 | 1; jump: boolean };
const NO_INPUT: TickInput;
type SimEvent = { type: 'attack' | 'hit' | 'blocked' | 'guard_break' | 'evaded' | 'tired' | 'combo' | 'ko'; fighter: 0 | 1; move?: MoveId; damage?: number; combo?: ComboName };
type Match = { frame: number; fighters: [Fighter, Fighter]; hitstop: number; framesLeft: number;
               result: null | { winner: 0 | 1 | null; reason: 'ko' | 'timeout' }; events: SimEvent[] };
```
`constants.ts` xuất: `ARENA_W 1000, EDGE 30, START_X [350, 650], MIN_GAP 60, WALK_SPEED 5, MAX_HP 100, MAX_STAMINA 100, REGEN_PER_FRAME 0.25, REGEN_DELAY 30, HITSTUN 14, KNOCKBACK 30, HITSTOP 4, BLOCK_REDUCTION 0.8, BLOCK_STAMINA 5, BLOCKSTUN 8, GUARD_BREAK_STUN 20, DODGE_INVULN 20, DODGE_RECOVERY 12, JUMP_FRAMES 30, JUMP_AIR_START 4, JUMP_AIR_END 26, MATCH_FRAMES 5940, SPECIAL_ON_HIT 5, SPECIAL_ON_HURT 3, SPECIAL_CANCEL_FRAMES 15, COMBO_GAP 42, COUNTER_SPAN 60, NPC_TELEGRAPH 24`.

- [ ] Test: `MOVES` khớp từng ô bảng spec (5 move × 8 trường); `MOVES.special.specialCost === 100`; `NO_INPUT` toàn false/0/null.
- [ ] FAIL → cài `phaser@3.90.0`, viết 3 file → PASS → commit `feat(sim): combat types, constants and move table`.

### Task 2: Di chuyển, hướng mặt, đẩy nhau, nhảy, cúi, hồi stamina

**Files:** Create `src/game/sim/match.ts`. Test `tests/game/movement.test.ts`.

**Interfaces – Produces:** `createMatch(opts?: { extraStartup?: [number, number] }): Match` (fighter 0 ở x 350 nhìn phải, fighter 1 ở 650 nhìn trái, đủ HP/stamina, special 0, `framesLeft = MATCH_FRAMES`); `stepMatch(m: Match, inputs: [TickInput, TickInput]): void` (xoá `m.events` đầu mỗi bước).

Quy tắc: walk chỉ từ idle/walk, vận tốc `move * WALK_SPEED`. Giữ crouch thì vào `crouch` (không đi). Jump từ idle/walk, kéo dài 30 frame. Sau khi di chuyển: nếu khoảng cách < `MIN_GAP` thì đẩy đều hai bên ra; kẹp x vào `[EDGE, ARENA_W − EDGE]`; mỗi bên quay mặt về phía bên kia. Stamina hồi `REGEN_PER_FRAME` khi `sinceSpend ≥ REGEN_DELAY` (**kiểm tra trước, rồi mới tăng `sinceSpend`** trong cùng tick), tối đa 100.

- [ ] Test: đi phải 10 tick → x = 400; hai bên cùng tiến vào nhau → khoảng cách không bao giờ < 60 **[RF3]**; fighter 0 đi trái 100 tick → x = 30 (kẹp mép) **[RF3]**; fighter 0 nhảy qua đầu (x đặt > x đối thủ) → `facing` hai bên đổi đúng **[RF3]**; giữ crouch → `action.kind === 'crouch'` và x không đổi khi có `move`; jump → `kind 'jump'` trong 30 frame rồi về idle; stamina 50 với `sinceSpend` 0 → sau 30 tick vẫn 50, sau 34 tick = 51.
- [ ] FAIL → cài đặt → PASS → commit `feat(sim): movement, facing, pushbox, jump, crouch, stamina regen`.

### Task 3: Ra đòn, trúng đòn, KO, hết stamina

**Files:** Modify `match.ts`. Test `tests/game/attacks.test.ts`.

Quy tắc: `attack` chỉ nhận từ idle/walk/crouch; thiếu stamina thì không ra đòn và phát `tired`; ra đòn thì trừ stamina, `sinceSpend = 0`, phát `attack`. Pha: `frame < startup + extraStartup` là khởi động, tiếp theo `active` frame là đòn có hiệu lực, rồi `recovery`, xong về idle. Mỗi tick, **trước** khi áp sát thương, thu thập mọi đòn trúng từ trạng thái đầu tick của cả hai bên rồi mới áp dụng (trade công bằng). Trúng khi đang active, `!hasHit`, và `0 ≤ (def.x − atk.x)·atk.facing ≤ range`. Trúng thì: HP −damage (không âm), `hitstun 14`, đẩy lùi 30 theo hướng đòn, `m.hitstop = 4`, special +5 cho bên đánh, +3 cho bên bị đánh (tối đa 100), phát `hit`. HP về 0 thì `ko`, phát `ko`, ghi `result {winner, reason:'ko'}`. Khi `hitstop > 0`: chỉ giảm hitstop, không cập nhật gì khác (kể cả đồng hồ).

- [ ] Test: jab ở khoảng cách 100 → `hit` đúng ở frame active đầu tiên (tick thứ 5), đối thủ HP 95, `hitstun`; jab ở khoảng cách 200 → không trúng; **trade**: cả hai jab cùng tick ở khoảng cách 100 → cả hai HP 95 **[RF1]**; trong hitstun nhấn đánh → không có `attack` **[RF2]**; đặt HP đối thủ 5 rồi jab → `ko`, `result.winner === 0`; sau KO, fighter 1 nhấn đánh → không có event **[RF2]**; stamina 3 → `tired`, stamina vẫn 3 **[RF5]**; hitstop: sau cú trúng, 4 tick tiếp theo `framesLeft` không đổi.
- [ ] FAIL → cài đặt → PASS → commit `feat(sim): attacks, hit resolution, trades, hitstop, KO, tired`.

### Task 4: Phòng thủ: block, vỡ thủ, dodge, cúi né đòn cao, nhảy né đòn giữa

**Files:** Modify `match.ts`. Test `tests/game/defense.test.ts`.

Quy tắc: giữ block (từ idle/walk/crouch/block) → `block`. Bị trúng khi block: nếu stamina ≥ 5 thì sát thương × 0.2, stamina −5, `blockstun 8`, phát `blocked`; ngược lại **vỡ thủ**: đủ sát thương, `hitstun 20`, phát `guard_break`. Dodge → `dodge` 32 frame, miễn đòn ở frame < 20. Đang `crouch` thì đòn `high` không trúng; đang `jump` ở frame 4–26 thì đòn `mid` không trúng. Né được thì đặt `evaded = true` và phát `evaded` một lần cho đòn đó.

- [ ] Test: block jab → HP 99, stamina 95, `blockstun`; block với stamina 4 → HP 95, `guard_break`, hitstun 20 **[RF5]**; dodge rồi jab trúng trong frame 0–19 → không mất HP, đúng một `evaded`; đang hồi dodge (frame 25) → trúng; crouch vs jab (high) → né, crouch vs kick (mid) → trúng; nhảy vs kick ở frame 10 → né.
- [ ] FAIL → cài đặt → PASS → commit `feat(sim): block, guard break, dodge, crouch and jump evasion`.

### Task 5: Combo và special

**Files:** Create `src/game/sim/combo.ts`; modify `match.ts`. Test `tests/game/combo.test.ts`.

**Interfaces – Produces:**
```ts
const COMBOS: { name: ComboName; seq: (MoveId | 'block' | 'dodge')[]; damageMult: number; specialBonus: number; maxSpan?: number }[];
// double_jab [punch_l,punch_r] 1.2 +10; triple_attack [punch_l,punch_r,kick_r] 1.4 +20;
// counter [block,dodge,punch_r] 1.5 +25 maxSpan 60; power_combo [punch_r,kick_l,kick_r] 1.5 +25
function matchCombo(history: Fighter['history'], frame: number): (typeof COMBOS)[number] | null;
```
`matchCombo` thử combo dài trước. Combo khớp khi đuôi `history` trùng `seq`, mỗi khoảng cách giữa hai bước ≤ `COMBO_GAP` (42), và nếu có `maxSpan` thì tổng ≤ `maxSpan`. Ghi vào `history` khi ra đòn, khi bắt đầu block, khi bắt đầu dodge (giữ 6 mục gần nhất). Khi ra đòn, `action.combo = matchCombo(...)?.name`. Nếu đòn đó trúng thì sát thương × `damageMult`, special + `specialBonus`, phát `combo`. Special: khi đang ở punch_l/punch_r chưa quá 15 frame mà nhận cú đấm còn lại và special = 100 thì chuyển ngay thành đòn `special` (frame 0), special về 0.

- [ ] Test (bắt đầu ở khoảng cách 80, vì jab đẩy lùi 30 và cross có tầm 120): jab rồi cross ngay khi jab hồi xong (frame 17), cả hai trúng → cú thứ hai gây 8 × 1.2 = 9.6 và có event `combo double_jab`; jab rồi cross cách 50 frame → không combo; block → dodge → cross trong 60 frame → `counter` (×1.5); cùng chuỗi kéo dài 70 frame → không; special 100, jab rồi cross sau 5 frame → `action.move === 'special'`, special 0; special 90 → cross bình thường.
- [ ] FAIL → cài đặt → PASS → commit `feat(sim): combos and double-punch special`.

### Task 6: Đồng hồ, hết giờ, telegraph

**Files:** Modify `match.ts`. Test `tests/game/match.test.ts`.

Quy tắc: `framesLeft` giảm 1 mỗi tick (trừ khi hitstop hoặc đã có kết quả). Về 0 thì `result = { winner: bên HP cao hơn | null nếu bằng, reason: 'timeout' }`. Có kết quả rồi thì `stepMatch` không đổi gì. `extraStartup` của fighter cộng vào startup mọi đòn.

- [ ] Test: hết 5940 tick không ai đánh → hoà (`winner null`); HP 90 vs 100 lúc hết giờ → bên 100 thắng; sau khi có kết quả, `stepMatch` với input đánh → không event, `framesLeft` không đổi **[RF2]**; `createMatch({ extraStartup: [0, 24] })`: jab của fighter 1 trúng ở tick 29 thay vì tick 5.
- [ ] FAIL → cài đặt → PASS → commit `feat(sim): match timer, timeout result, telegraph startup`.

### Task 7: Input: bàn phím, IntentBuilder, bao cát

**Files:** Create `src/game/input/{keyboardMap,intent,dummyInput}.ts`. Test `tests/game/input.test.ts`.

**Interfaces – Produces:**
```ts
// keyboardMap.ts — A/D move, S crouch, W jump, J/K punch L/R, U/I kick L/R, Space block, Q/E dodge (spec 6.4)
type KeyState = { down: ReadonlySet<string>; pressed: ReadonlySet<string> };   // KeyboardEvent.code, pressed = vừa nhấn tick này
function keyboardControl(k: KeyState, t: number): ControlFrame;     // tracking 'ok'; events cho J/K/U/I/W vừa nhấn
// intent.ts
class IntentBuilder { push(c: ControlFrame): void; next(): TickInput; }   // gộp mọi ControlFrame tới trước tick
// dummyInput.ts
type DummyMode = 'idle' | 'jab' | 'block';
class DummyInput { constructor(mode: DummyMode); next(frame: number): TickInput }   // 'jab': ra punch_l mỗi 120 frame
```
Ánh xạ `ControlFrame` → `TickInput`: event punch/kick đầu tiên chưa tiêu thụ → `attack` (event còn lại giữ cho tick sau); event `jump` → `jump: true`; `state.block/crouch` giữ nguyên; `dodge ≠ 0` → `dodge: true`; `move` giữ nguyên dấu (dương = sang phải màn hình). D → `move 1`, A → `move −1`; Q hoặc E → dodge.

- [ ] Test: giữ D → `move 1`; nhấn J → đúng một tick có `attack 'punch_l'`; J và K cùng tick → tick 1 `punch_l`, tick 2 `punch_r`; giữ Space → `block true`; dummy `'jab'` → `attack` ở frame 120, 240; dummy `'block'` → luôn block.
- [ ] FAIL → cài đặt → PASS → commit `feat(input): keyboard mapping, intent builder, sparring dummy`.

### Task 8: Vòng lặp fixed-step, pose, HUD model

**Files:** Create `src/game/loop.ts`, `src/game/render/{pose,hudModel}.ts`. Test `tests/game/loop.test.ts`, `tests/game/pose.test.ts`.

**Interfaces – Produces:**
```ts
class FixedStep { constructor(stepMs = 1000 / 60, maxSteps = 5); advance(dtMs: number): number }
type Limb = { a: number; b: number };          // góc khớp gốc và khớp giữa (radian, 0 = duỗi xuống)
type Pose = { lean: number; lift: number; crouch: number; armFront: Limb; armBack: Limb; legFront: Limb; legBack: Limb; lying: boolean };
function poseFor(f: Fighter): Pose;            // keyframe theo action; attack nội suy guard → impact → guard theo pha
type HudModel = { hp: [number, number]; stamina: [number, number]; special: [number, number]; seconds: number; result: string | null };
function hudModel(m: Match): HudModel;         // giá trị 0..1; seconds = ceil(framesLeft / 60)
```
- [ ] Test: `advance(16.7)` → 1; `advance(5000)` → 5 và phần dư bị bỏ (lần sau `advance(0)` → 0) **[RF4]**; `poseFor` idle → tay trước gập (`b` > 1.2); punch_l ở frame active → `armFront` duỗi (`b` < 0.2); crouch → `crouch > 0`; ko → `lying`; `hudModel` ở trận mới → hp [1,1], seconds 99.
- [ ] FAIL → cài đặt → PASS → commit `feat(game): fixed-step loop, fighter poses, HUD model`.

### Task 9: Màn đánh Phaser

**Files:** Create `src/game/render/{stickFighter,effects,hud,sfx}.ts`, `src/game/scenes/FightScene.ts`; modify `src/main.ts`, `index.html`.

- `stickFighter.ts`: `drawFighter(g: Phaser.GameObjects.Graphics, f: Fighter, pose: Pose, color: number, toScreen: (x: number) => number, groundY: number, telegraph: boolean)`. Nét dày 6 px, đầu tròn, glow (vẽ 2 lớp: lớp mờ dày 14 px alpha 0.25). Màu: người chơi `0x22d3ee`, đối thủ `0xf472b6`. `telegraph` (đang trong `extraStartup`) → tay ra đòn nhấp nháy vàng `0xfacc15`.
- `effects.ts`: tia lửa 12 hạt tại điểm trúng, rung camera 120 ms (4 px) khi `hit`, popup chữ bay lên 600 ms: `HIT`, `BLOCK`, `GUARD BREAK`, `DODGE`, `COMBO: <tên>`, `TIRED`, `K.O.`.
- `hud.ts`: thanh HP hai bên (đỏ → vàng), stamina (xanh lá), special (tím, sáng khi đầy), đồng hồ ở giữa, banner kết quả "YOU WIN" / "YOU LOSE" / "DRAW" kèm "Nhấn R để đấu lại".
- `sfx.ts`: WebAudio tổng hợp: whoosh (noise lọc thông dải 120 ms), hit (sine 120→60 Hz 100 ms + noise), block (square 600 Hz 60 ms), ko (sweep 400→80 Hz 600 ms). Chỉ tạo `AudioContext` sau thao tác đầu tiên của người dùng.
- `FightScene`: mỗi `update(dt)` → `FixedStep.advance` → n lần (`IntentBuilder` từ `keyboardControl`, `DummyInput`, `stepMatch`, đẩy `events` sang effects/sfx). Vẽ sàn neon, sân 1000 đơn vị ánh xạ vào viewport. Phím `1/2/3` đổi chế độ bao cát (idle/jab/block), `R` đấu lại. Bao cát dùng `extraStartup NPC_TELEGRAPH`.
- `main.ts`: `new Phaser.Game({ width: 1280, height: 720, backgroundColor: '#020617', scene: [FightScene], parent: 'app' })`; giữ link "Motion Lab".

- [ ] `npm run check` và `npm run build` xanh.
- [ ] Kiểm tra thủ công (`npm run dev` → `http://localhost:5173/`): đi lại, nhảy, cúi; jab/cross/kick trúng bao cát có tia lửa, rung, âm thanh, HP giảm; combo J→K hiện "COMBO: DOUBLE JAB"; chế độ 2 (bao cát ra jab có báo trước màu vàng) → giữ Space đỡ được ("BLOCK"), Q né được ("DODGE"); hết stamina hiện "TIRED"; KO hiện banner và R đấu lại.
- [ ] Commit `feat(game): playable keyboard fight scene with neon stick fighters`.

### Task 10: Tài liệu

**Files:** Modify `README.md`.

- [ ] Thêm mục "Chơi thử (bàn phím)": bảng phím, phím 1/2/3 cho bao cát, R đấu lại. Cập nhật dòng trạng thái thành Phase 2.
- [ ] Commit `docs: keyboard fight instructions`.
