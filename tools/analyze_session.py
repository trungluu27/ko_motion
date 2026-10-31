"""Plot motion features of a recorded session against its ground-truth labels.

Usage (inside the project venv):
    npm run eval -- --dump out
    .venv\Scripts\python tools/analyze_session.py out/<name>.features.csv out/<name>.labels.json --out plot.png
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

# Mirrors src/motion/config.ts DEFAULT_CONFIG trigger thresholds.
THRESHOLDS: dict[str, float] = {
    "armExt_l": 0.80,
    "armExt_r": 0.80,
    "armExtVel_l": 2.5,
    "armExtVel_r": 2.5,
    "ankleLift_l": 0.35,
    "ankleLift_r": 0.35,
    "ankleLiftVel_l": 1.5,
    "ankleLiftVel_r": 1.5,
    "lean": 15.0,
    "hipDx": 0.45,
    "hipDy": 0.25,
}

DEFAULT_COLS = ["armExt_l", "armExt_r", "armExtVel_l", "armExtVel_r", "ankleLift_l", "ankleLift_r", "lean", "hipDx", "hipDy"]

ACTION_COLORS = {
    "punch_l": "tab:blue", "punch_r": "tab:cyan", "kick_l": "tab:orange", "kick_r": "tab:red", "jump": "tab:green",
    "block": "tab:purple", "crouch": "tab:brown", "dodge_l": "tab:pink", "dodge_r": "tab:pink",
    "move_l": "tab:olive", "move_r": "tab:olive", "idle": "tab:gray",
}


def load(csv: Path, labels: Path) -> tuple[pd.DataFrame, list[dict]]:
    df = pd.read_csv(csv, keep_default_na=False, na_values=[])
    return df, json.loads(Path(labels).read_text(encoding="utf8"))


def plot(df: pd.DataFrame, labels: list[dict], cols: list[str], out: Path) -> None:
    cols = [c for c in cols if c in df.columns]
    fig, axes = plt.subplots(len(cols), 1, figsize=(14, 2.2 * len(cols)), sharex=True, squeeze=False)
    events = df[df.get("events", pd.Series([""] * len(df))).astype(str) != ""] if "events" in df.columns else df.iloc[0:0]
    for ax, col in zip(axes[:, 0], cols):
        ax.plot(df["t"], df[col], lw=1, color="black")
        ax.set_ylabel(col, rotation=0, ha="right")
        for lab in labels:
            ax.axvspan(lab["tStart"], lab["tEnd"], color=ACTION_COLORS.get(lab["action"], "tab:gray"), alpha=0.15)
        if col in THRESHOLDS:
            ax.axhline(THRESHOLDS[col], color="red", ls="--", lw=0.8)
            if col in ("lean", "hipDx"):
                ax.axhline(-THRESHOLDS[col], color="red", ls="--", lw=0.8)
        for _, row in events.iterrows():
            ax.axvline(row["t"], color="green", lw=0.8, alpha=0.6)
    axes[-1, 0].set_xlabel("t (ms)")
    fig.tight_layout()
    fig.savefig(out, dpi=100)
    plt.close(fig)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("csv", type=Path)
    p.add_argument("labels", type=Path)
    p.add_argument("--out", type=Path, default=Path("plot.png"))
    p.add_argument("--cols", default=",".join(DEFAULT_COLS))
    a = p.parse_args()
    df, labels = load(a.csv, a.labels)
    plot(df, labels, a.cols.split(","), a.out)
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
