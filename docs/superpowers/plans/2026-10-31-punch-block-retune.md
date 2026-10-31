# Punch & Block Retune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhận diện đúng đấm trái/phải và block khi người chơi đứng nghiêng, dựa trên dữ liệu thật đã ghi.

**Architecture:** Cú đấm chuyển từ ngưỡng tốc độ 3D tuyệt đối sang **độ tăng góc khuỷu** (so với mức thấp nhất trong 400 ms vừa qua) kết hợp **độ vươn 2D** cổ tay–vai. Block chuyển sang ngưỡng chặt hơn và tắt khi khuỷu duỗi (> 120°), thay vì so độ duỗi 3D tuyệt đối. Phiên thật có nhãn được đưa vào `fixtures/sessions/` làm dữ liệu hồi quy cho `npm run eval`.

**Tech Stack:** TypeScript, Vitest (giữ nguyên).

**Spec:** `docs/superpowers/specs/2026-10-31-body-fighter-design.md` mục 5.2, 5.3, 5.6, Phụ lục A (đã cập nhật).

## Global Constraints

- Ngưỡng nằm trong `src/motion/config.ts`, đúng giá trị spec 5.3: punch `elbowOnDeg 130, elbowRiseDeg 30, riseWindowMs 400, reachOn 0.5, extOn 0.95, elbowOffDeg 115, refractoryMs 180`; block `wristNoseMax 0.55, wristNoseSumMax 0.7, holdMs 150, releaseMs 120, armOutElbowDeg 120`.
- Không còn dùng `armExtVel` hay `extOff` cho punch.
- Bằng chứng nghiệm thu: `npm run eval` trên phiên thật. Mục tiêu: punch_l và punch_r precision ≥ 0.90, recall ≥ 0.85.

## Review Focus

1. Tay trước và tay sau di chuyển cùng lúc khi xoay người: không được phát cú đấm phụ ở tay kia. Kiểm tra bằng eval (FP của punch_r trong đoạn punch_l).
2. Thủ thế cao sát mặt: không được bật block (eval: số frame block trong đoạn idle ≤ 10).

---

### Task 1: Feature `reach2d`

**Files:** Modify `src/motion/features.ts`. Test `tests/motion/features.test.ts`.

**Interfaces:** Produces `Features.reach2d: LR<number>` = `dist2d(wrist, shoulder) / cal.torsoPx` trên ảnh đơn vị vuông.

- [ ] Test: `armL {ext:0.9, dir:'side'}` → `reach2d.l ≈ 0.9·0.54/0.5 = 0.97` (±0.02). `dir:'forward'` → `reach2d.l < 0.05`.
- [ ] Chạy → FAIL; cài đặt; chạy → PASS; commit.

### Task 2: PunchRecognizer theo góc khuỷu

**Files:** Modify `src/motion/recognizers/punch.ts`, `src/motion/config.ts`, `tests/motion/recognizers/punch.test.ts`, `tests/motion/motionEngine.test.ts` (nếu cần).

**Interfaces:** Chữ ký `update(f, frameId)` giữ nguyên. Confidence = `eventConfidence(vis, elbowRise, elbowRiseDeg, cfg.event)`.

- [ ] Test: các test punch hiện có vẫn đúng ý nghĩa (jab nhanh = 1 event, duỗi chậm 1.5 s = 0, giữ tay = 1, 3 cú = 3, vung tay xuống = 0). Thêm: **jab ngang 2D** (`dir:'side'`, kiểu đứng nghiêng) từ thủ thế = 1 event.
- [ ] Chạy → FAIL (jab 2D); cài đặt; chạy toàn bộ → PASS; commit.

### Task 3: Block chặt hơn

**Files:** Modify `src/motion/recognizers/states.ts`, `src/motion/config.ts`, `tests/motion/recognizers/states.test.ts`.

- [ ] Test: tay `cover` hai bên giữ 300 ms → block bật sau ≥ 150 ms (chưa bật ở 133 ms). Một tay duỗi `forward 0.95` → tắt ngay frame đó. Tay `guard` (thủ thế) → không bật.
- [ ] Chạy → FAIL; cài đặt; chạy → PASS; commit.

### Task 4: Dữ liệu hồi quy và nghiệm thu

**Files:** Create `fixtures/sessions/2026-10-31-side-quick.json.gz`. Modify spec Phụ lục A, `README.md` (tư thế khuyến nghị).

- [ ] Nén `guided-20261031-232323.json` vào fixtures. Chạy `npm run eval` và ghi số thật vào Phụ lục A.
- [ ] README: hướng dẫn đứng nghiêng khoảng 45°, calibrate ở đúng tư thế chơi.
- [ ] Commit.
