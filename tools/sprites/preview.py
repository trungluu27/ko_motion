"""Contact sheet of rendered sprites: one row per clip, impact sprite outlined in red.

Usage: .venv\\Scripts\\python tools/sprites/preview.py [art/render] [--clips idle,punch_l]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.sprites.timing import impact_sprite_index  # noqa: E402

THUMB_W, THUMB_H = 144, 96
MAX_COLS = 24


def contact_sheet(fighter_dir: Path, clips: dict, only: set[str]) -> Image.Image:
    rows = []
    for name, spec in clips.items():
        if only and name not in only:
            continue
        files = sorted(fighter_dir.glob(f"{name}_*.png"))
        if files:
            rows.append((name, spec, files))
    sheet = Image.new("RGBA", (THUMB_W * MAX_COLS + 110, THUMB_H * max(1, len(rows))), (40, 40, 52, 255))
    draw = ImageDraw.Draw(sheet)
    for r, (name, spec, files) in enumerate(rows):
        y = r * THUMB_H
        draw.text((6, y + 40), name, fill=(255, 255, 255, 255))
        impact = impact_sprite_index(spec) if spec["kind"] == "attack" else -1
        for c, f in enumerate(files[:MAX_COLS]):
            im = Image.open(f).convert("RGBA")
            im.thumbnail((THUMB_W, THUMB_H))
            x = 110 + c * THUMB_W
            sheet.alpha_composite(im, (x, y))
            draw.line([(x, y + THUMB_H - 4), (x + THUMB_W, y + THUMB_H - 4)], fill=(90, 90, 110, 255))
            if c == impact:
                draw.rectangle([x, y, x + THUMB_W - 1, y + THUMB_H - 1], outline=(255, 40, 40, 255), width=3)
    return sheet


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("render_dir", nargs="?", default=str(ROOT / "art" / "render"))
    p.add_argument("--clips", default="")
    a = p.parse_args()
    config = json.loads((ROOT / "art" / "sprites.json").read_text(encoding="utf8"))
    only = {c for c in a.clips.split(",") if c}
    for fighter in config["fighters"]:
        d = Path(a.render_dir) / fighter
        if not d.exists():
            continue
        out = d / "_preview.png"
        contact_sheet(d, config["clips"], only).save(out)
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
