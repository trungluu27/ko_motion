"""Which source animation frames to render for each clip (spec 4.2).

Attacks get one sprite per 2 game frames, laid out so the sprite shown on the first
active game frame is the clip's `impact` frame. Other clips are sampled at 30 sprites/s
from 60 fps sources.
"""
from __future__ import annotations

import math

LOOP_STEP = 2  # 60 fps source -> 30 sprites/s


def _spread(a: float, b: float, n: int, include_end: bool) -> list[int]:
    """n evenly spaced integer frames from a towards b (b excluded unless include_end)."""
    if n <= 0:
        return []
    shift = 1 if include_end else 0
    return [round(a + (b - a) * (i + shift) / n) for i in range(n)]


def sample_frames(clip: dict) -> list[int]:
    start, end, kind = clip["start"], clip["end"], clip["kind"]
    if kind == "attack":
        s, a, r = clip["frames"]
        impact = clip["impact"]
        startup = _spread(start, impact, math.ceil(s / 2), include_end=False)
        active = [impact] * math.ceil(a / 2)
        recovery = _spread(impact, end, math.ceil(r / 2), include_end=True)
        return startup + active + recovery
    frames = list(range(start, end, LOOP_STEP))
    if kind in ("hold", "once") and (not frames or frames[-1] != end):
        frames.append(end)
    return frames


def impact_sprite_index(clip: dict) -> int:
    return math.ceil(clip["frames"][0] / 2)
