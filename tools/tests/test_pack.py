import json
import random
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from tools.sprites.pack import feet_anchor, pack, trim, write_phaser_multiatlas  # noqa: E402


def make_frames(n: int, seed: int = 1) -> dict[str, Image.Image]:
    rnd = random.Random(seed)
    frames = {}
    for i in range(n):
        im = Image.new("RGBA", (300, 200), (0, 0, 0, 0))
        w, h = rnd.randint(20, 280), rnd.randint(20, 180)
        x, y = rnd.randint(0, 300 - w), rnd.randint(0, 200 - h)
        im.paste((255, 0, 0, 255), (x, y, x + w, y + h))
        frames[f"clip/{i:03d}"] = im
    return frames


def test_trim_keeps_the_offset_to_restore_the_source_frame():
    im = Image.new("RGBA", (100, 80), (0, 0, 0, 0))
    im.paste((0, 255, 0, 255), (10, 20, 40, 70))
    t = trim(im)
    assert t.image.size == (30, 50)
    assert (t.x, t.y, t.source_w, t.source_h) == (10, 20, 100, 80)


def test_packing_has_no_overlaps_and_respects_the_page_size():
    frames = make_frames(80)
    pages = pack(frames, max_size=1024, pad=2)
    placed = [(p.index, e) for p in pages for e in p.entries]
    assert sorted(e.key for _, e in placed) == sorted(frames)
    for p in pages:
        assert p.width <= 1024 and p.height <= 1024
        rects = [(e.x, e.y, e.x + e.trimmed.image.width, e.y + e.trimmed.image.height) for e in p.entries]
        for i, a in enumerate(rects):
            assert a[2] <= p.width and a[3] <= p.height
            for b in rects[i + 1:]:
                assert a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1], (a, b)


def test_multiatlas_json_is_in_phaser_format(tmp_path):
    frames = make_frames(10)
    pages = pack(frames, max_size=2048)
    write_phaser_multiatlas(pages, tmp_path, "fighter", {"clips": {"clip": 10}})
    data = json.loads((tmp_path / "fighter.json").read_text())
    tex = data["textures"][0]
    assert (tmp_path / tex["image"]).exists()
    f = tex["frames"][0]
    assert set(f) >= {"filename", "frame", "spriteSourceSize", "sourceSize", "trimmed", "rotated"}
    assert f["sourceSize"] == {"w": 300, "h": 200}
    assert data["meta"]["clips"] == {"clip": 10}


def test_feet_anchor_is_the_bottom_centre_of_the_opaque_pixels():
    im = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    im.paste((255, 255, 255, 255), (30, 10, 50, 90))  # x 30..49, bottom row 89
    assert feet_anchor(im) == (40, 90)
