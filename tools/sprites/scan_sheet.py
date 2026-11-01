"""Labelled grid of scanned frames for one clip (helps pick start / impact / end).

Usage: .venv\\Scripts\\python tools/sprites/scan_sheet.py <fighter> <clip> [--cols 12] [--from N] [--to M]
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("fighter")
    p.add_argument("clip")
    p.add_argument("--cols", type=int, default=12)
    p.add_argument("--from", dest="lo", type=int, default=0)
    p.add_argument("--to", dest="hi", type=int, default=10_000)
    a = p.parse_args()
    d = ROOT / "art" / "render" / "_scan" / a.fighter
    pat = re.compile(rf"^{re.escape(a.clip)}_f(\d+)\.png$")
    items = sorted((int(m.group(1)), f) for f in d.iterdir() if (m := pat.match(f.name)))
    items = [(n, f) for n, f in items if a.lo <= n <= a.hi]
    tw, th = 192, 128
    rows = (len(items) + a.cols - 1) // a.cols
    sheet = Image.new("RGBA", (tw * a.cols, th * rows), (45, 45, 60, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (n, f) in enumerate(items):
        im = Image.open(f).convert("RGBA")
        im.thumbnail((tw, th))
        x, y = (i % a.cols) * tw, (i // a.cols) * th
        sheet.alpha_composite(im, (x, y))
        draw.text((x + 4, y + 4), str(n), fill=(255, 230, 80, 255))
        draw.rectangle([x, y, x + tw - 1, y + th - 1], outline=(80, 80, 100, 255))
    out = ROOT / ".superpowers" / f"scan_{a.fighter}_{a.clip}.png"
    out.parent.mkdir(exist_ok=True)
    sheet.save(out)
    print(out)


if __name__ == "__main__":
    main()
