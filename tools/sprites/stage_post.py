"""Finish the rendered stage layers: neon bloom, floor cut-out, web formats (spec 4.5).

Reads art/render/stage/{full,far,mid}.png + stage.json, writes public/stages/neon_street/
{far.jpg, mid.webp, floor.webp, stage.json}.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art" / "render" / "stage"
OUT = ROOT / "public" / "stages" / "neon_street"


def bloom(im: Image.Image, threshold: int = 170, radius: int = 18, strength: float = 0.9) -> Image.Image:
    """Adds a soft glow around bright pixels (neon, lamps, lit windows)."""
    rgb = im.convert("RGB")
    bright = rgb.point(lambda v: 0 if v < threshold else int((v - threshold) * 255 / (255 - threshold) * strength))
    glow = bright.filter(ImageFilter.GaussianBlur(radius))
    out = ImageChops.add(rgb, glow)
    if im.mode == "RGBA":
        alpha = ImageChops.lighter(im.getchannel("A"), glow.convert("L"))
        out.putalpha(alpha)
    return out


def recede(im: Image.Image, brightness: float, blur: float) -> Image.Image:
    """Darken and soften a background layer so the fighters read in front of it (depth of field)."""
    alpha = im.getchannel("A") if im.mode == "RGBA" else None
    out = ImageEnhance.Brightness(im.convert("RGB")).enhance(brightness)
    out = ImageEnhance.Color(out).enhance(0.85)
    if blur:
        out = out.filter(ImageFilter.GaussianBlur(blur))
    if alpha is not None:
        out.putalpha(alpha.filter(ImageFilter.GaussianBlur(blur)) if blur else alpha)
    return out


def floor_layer(full: Image.Image, curb_row: int, fade: int = 8) -> Image.Image:
    """Everything below the curb from the full render (keeps the reflections), transparent above."""
    out = full.convert("RGBA")
    mask = Image.new("L", full.size, 0)
    for y in range(curb_row - fade, full.height):
        a = 255 if y >= curb_row else int(255 * (y - (curb_row - fade)) / fade)
        mask.paste(a, (0, y, full.width, y + 1))
    out.putalpha(mask)
    return out


def main() -> None:
    info = json.loads((SRC / "stage.json").read_text(encoding="utf8"))
    OUT.mkdir(parents=True, exist_ok=True)
    full = Image.open(SRC / "full.png")
    recede(bloom(Image.open(SRC / "far.png")), 0.45, 2.0).convert("RGB").save(OUT / "far.jpg", quality=86)
    recede(bloom(Image.open(SRC / "mid.png").convert("RGBA")), 0.6, 1.2).save(OUT / "mid.webp", quality=88)
    recede(bloom(floor_layer(full, info["curbRow"])), 0.8, 0).save(OUT / "floor.webp", quality=88)
    bloom(full.convert("RGB")).save(SRC / "preview.jpg", quality=86)
    (OUT / "stage.json").write_text(json.dumps(info), encoding="utf8")
    size = sum(p.stat().st_size for p in OUT.iterdir()) / 1e6
    print(f"stage layers written to {OUT} ({size:.1f} MB)")


if __name__ == "__main__":
    main()
