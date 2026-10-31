# Công cụ phân tích (Python)

Python luôn chạy trong virtualenv `.venv` ở gốc repo.

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r tools/requirements.txt
```

## Vẽ feature của một phiên đã ghi

1. Ghi phiên trong Motion Lab (nút 🎯 Guided capture hoặc 💾 Ghi phiên), rồi lưu file vào `fixtures/sessions/`.
2. Xuất feature ra CSV: `npm run eval -- --dump out`
3. Vẽ biểu đồ:

```powershell
.venv\Scripts\python tools/analyze_session.py out/<tên>.features.csv out/<tên>.labels.json --out out/<tên>.png
```

Tuỳ chọn `--cols armExt_l,armExtVel_l,...` để chọn các cột cần vẽ. Vùng tô màu là nhãn ground truth, đường đỏ đứt là ngưỡng trong `src/motion/config.ts`, vạch xanh lá là event đã nhận diện.

## Test

```powershell
.venv\Scripts\python -m pytest tools/tests -q
```
