"""Trim rendered sprite frames and pack them into Phaser 3 multi-atlases (spec 4.4).

Usage: .venv\\Scripts\\python tools/sprites/pack.py [--scale 0.8]
Reads art/render/<fighter>/<clip>_<NNN>.png, writes public/sprites/<fighter>.json + <fighter>-<n>.png.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.sprites.timing import impact_sprite_index  # noqa: E402


@dataclass
class Trimmed:
    image: Image.Image
    x: int
    y: int
    source_w: int
    source_h: int


@dataclass
class Entry:
    key: str
    trimmed: Trimmed
    x: int = 0
    y: int = 0


@dataclass
class Page:
    index: int
    width: int = 0
    height: int = 0
    entries: list[Entry] = field(default_factory=list)


def trim(im: Image.Image) -> Trimmed:
    box = im.getchannel("A").getbbox() or (0, 0, 1, 1)
    return Trimmed(im.crop(box), box[0], box[1], im.width, im.height)


def pack(frames: dict[str, Image.Image], max_size: int = 4096, pad: int = 2) -> list[Page]:
    """Shelf packing of trimmed frames, tallest first; opens a new page when one is full."""
    entries = sorted((Entry(k, trim(im)) for k, im in frames.items()), key=lambda e: -e.trimmed.image.height)
    pages: list[Page] = []
    page = Page(0)
    shelf_y = shelf_h = cursor_x = 0
    for e in entries:
        w, h = e.trimmed.image.width + pad, e.trimmed.image.height + pad
        if cursor_x + w > max_size:
            shelf_y += shelf_h
            cursor_x = shelf_h = 0
        if shelf_y + h > max_size:
            pages.append(page)
            page = Page(len(pages))
            shelf_y = shelf_h = cursor_x = 0
        e.x, e.y = cursor_x, shelf_y
        page.entries.append(e)
        cursor_x += w
        shelf_h = max(shelf_h, h)
        page.width = max(page.width, e.x + e.trimmed.image.width)
        page.height = max(page.height, e.y + e.trimmed.image.height)
    if page.entries:
        pages.append(page)
    return pages


def write_phaser_multiatlas(pages: list[Page], out_dir: Path, name: str, meta: dict, fmt: str = "png", quality: int = 88) -> None:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    textures = []
    for p in pages:
        sheet = Image.new("RGBA", (p.width, p.height), (0, 0, 0, 0))
        frames = []
        for e in p.entries:
            t = e.trimmed
            sheet.paste(t.image, (e.x, e.y))
            frames.append({
                "filename": e.key,
                "rotated": False,
                "trimmed": True,
                "frame": {"x": e.x, "y": e.y, "w": t.image.width, "h": t.image.height},
                "spriteSourceSize": {"x": t.x, "y": t.y, "w": t.image.width, "h": t.image.height},
                "sourceSize": {"w": t.source_w, "h": t.source_h},
            })
        image = f"{name}-{p.index}.{fmt}"
        if fmt == "webp":
            sheet.save(out_dir / image, "WEBP", quality=quality, method=6, exact=False)
        else:
            sheet.save(out_dir / image, optimize=True)
        textures.append({"image": image, "format": "RGBA8888", "size": {"w": p.width, "h": p.height}, "scale": 1, "frames": frames})
    (out_dir / f"{name}.json").write_text(json.dumps({"textures": textures, "meta": meta}, separators=(",", ":")), encoding="utf8")


def feet_anchor(im: Image.Image) -> tuple[int, int]:
    """Bottom centre of the opaque pixels: where the fighter stands, in source-frame pixels."""
    box = im.getchannel("A").getbbox()
    if not box:
        return im.width // 2, im.height
    return (box[0] + box[2]) // 2, box[3]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", type=float, default=0.8)
    ap.add_argument("--max", type=int, default=4096)
    ap.add_argument("--format", default="webp", choices=["webp", "png"])
    ap.add_argument("--quality", type=int, default=88)
    a = ap.parse_args()
    config = json.loads((ROOT / "art" / "sprites.json").read_text(encoding="utf8"))
    pat = re.compile(r"^(?P<clip>[a-z_]+)_(?P<i>\d{3})\.png$")
    for fighter in config["fighters"]:
        src = ROOT / "art" / "render" / fighter
        frames: dict[str, Image.Image] = {}
        counts: dict[str, int] = {}
        for f in sorted(src.glob("*.png")):
            m = pat.match(f.name)
            if not m or m["clip"] not in config["clips"]:
                continue
            im = Image.open(f).convert("RGBA")
            if a.scale != 1:
                im = im.resize((round(im.width * a.scale), round(im.height * a.scale)), Image.LANCZOS)
            frames[f"{m['clip']}/{m['i']}"] = im
            counts[m["clip"]] = counts.get(m["clip"], 0) + 1
        idle0 = frames["idle/000"]
        ax, ay = feet_anchor(idle0)
        meta = {
            "anchor": {"x": ax / idle0.width, "y": ay / idle0.height},
            "frameHeight": idle0.height,
            "clips": counts,
            "impact": {k: impact_sprite_index(v) for k, v in config["clips"].items() if v["kind"] == "attack"},
            "kinds": {k: v["kind"] for k, v in config["clips"].items()},
        }
        pages = pack(frames, max_size=a.max)
        out = ROOT / "public" / "sprites"
        for old in out.glob(f"{fighter}*"):
            old.unlink()
        write_phaser_multiatlas(pages, out, fighter, meta, a.format, a.quality)
        size = sum(p.stat().st_size for p in out.glob(f"{fighter}*")) / 1e6
        print(f"{fighter}: {len(frames)} frames, {len(pages)} pages, {size:.1f} MB")


if __name__ == "__main__":
    main()
