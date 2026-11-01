# Sửa lỗi: đá không nhận, đá bị nhận thành né

**Spec:** spec chính, mục 5.2 (kick) và 5.3 (dodge). Phần này không đổi spec, chỉ sửa cách tính.

## Nguyên nhân (đã đo trên session `2026-10-31-side-quick`)

`KickRecognizer` đang yêu cầu ba điều kiện, và cả ba so với **vị trí tuyệt đối lúc calibrate**:
- chân trụ phải có `ankleLift` < 0.10;
- hông không được nâng lên: `hipDy > −0.06`;
- `ankleLift = (ankleY lúc calibrate − ankleY hiện tại) / legPx`.

Người chơi chỉ cần đứng nhỏ hơn 5% trong khung hình so với lúc calibrate (lùi khoảng 15 cm), hoặc dùng lại calibration cũ, là cả hai điều kiện đầu đều sai: `hipDy` −0.079, chân trụ lift 0.163. Khi đó **không cú đá nào được nhận**.

Né bị bật nhầm khi đá vì `dodge` chỉ xét độ nghiêng thân trên (> 15°). Lúc đá, thân trên tự nhiên ngả ra sau, nên dodge bật.

## Thay đổi

1. **Feature mới `footRaise[s]`:** độ nâng của chân `s` so với **chân kia**, trừ đi độ lệch giữa hai chân đo lúc calibrate (đứng nghiêng thì chân trước nằm thấp hơn trong ảnh). Kết quả chia cho `legPx × torsoScale`, nên không đổi khi người chơi tịnh tiến hay đứng xa/gần hơn. `footRaiseVel` là vận tốc của nó.
2. **`KickRecognizer` dùng `footRaise` và `footRaiseVel`.** Bỏ hai điều kiện "chân trụ < 0.10" và "hông không nâng":
   - Khi nhảy, hai chân cùng lên nên `footRaise` ≈ 0, tự nhiên không bị tính là đá.
   - Giữ nguyên các ngưỡng `liftOn` 0.35, `velOn` 1.5, `liftOff` 0.15.
   - Xoá `otherFootMax` và `hipRiseMax` khỏi config.
3. **Dodge bị chặn khi đang đá:** không bật dodge (và tắt dodge đang bật) nếu có chân với `footRaise` > `liftOff`, hoặc vừa có trong 300 ms gần nhất (`dodge.kickGuardMs`).
4. `ankleLift` tuyệt đối vẫn giữ nguyên cho Jump. Jump cũng có cùng điểm yếu (dùng `hipDy` tuyệt đối); việc này ghi lại để làm sau.

## Test (viết trước, phải fail trước khi sửa)
- Cú đá phải vẫn được nhận khi người chơi đứng nhỏ hơn 6% và lệch 0.05 so với lúc calibrate, và khi đứng lớn hơn 6%.
- Nhảy (hai chân cùng lên) không sinh ra cú đá.
- Đá kèm thân nghiêng 20° thì dodge vẫn tắt suốt cú đá và 300 ms sau đó.
- Các test kick, dodge và features cũ vẫn phải qua.
