import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from analyze_session import load, plot  # noqa: E402


def make_inputs(tmp_path: Path) -> tuple[Path, Path]:
    csv = tmp_path / "s.features.csv"
    rows = ["t,armExt_l,armExtVel_l,events"]
    for i in range(30):
        rows.append(f"{i * 33.3},{0.45 + 0.01 * i},{0.1 * i},{'punch_l' if i == 15 else ''}")
    csv.write_text("\n".join(rows), encoding="utf8")
    labels = tmp_path / "s.labels.json"
    labels.write_text(json.dumps([{"action": "punch_l", "tStart": 300, "tEnd": 700}]), encoding="utf8")
    return csv, labels


def test_load_returns_frame_with_time_column(tmp_path: Path) -> None:
    csv, labels = make_inputs(tmp_path)
    df, lab = load(csv, labels)
    assert "t" in df.columns
    assert len(df) == 30
    assert lab[0]["action"] == "punch_l"


def test_plot_writes_png(tmp_path: Path) -> None:
    csv, labels = make_inputs(tmp_path)
    df, lab = load(csv, labels)
    out = tmp_path / "plot.png"
    plot(df, lab, ["armExt_l", "armExtVel_l"], out)
    assert out.exists() and out.stat().st_size > 0
