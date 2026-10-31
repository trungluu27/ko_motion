import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from tools.sprites.timing import impact_sprite_index, sample_frames  # noqa: E402

CONFIG = json.loads((ROOT / "art" / "sprites.json").read_text(encoding="utf8"))
ATTACKS = ["punch_l", "punch_r", "kick_l", "kick_r", "special"]
FRAME_DATA = {"punch_l": [4, 3, 10], "punch_r": [6, 3, 14], "kick_l": [8, 4, 18], "kick_r": [10, 4, 20], "special": [12, 6, 30]}


def test_config_lists_every_clip_and_matches_frame_data():
    clips = CONFIG["clips"]
    expected = {"idle", "walk_fwd", "walk_back", "jump", "crouch", *ATTACKS, "block", "dodge",
                "hit_high", "hit_mid", "knockdown", "victory", "defeat"}
    assert set(clips) == expected
    for name in ATTACKS:
        assert clips[name]["kind"] == "attack"
        assert clips[name]["frames"] == FRAME_DATA[name]


def test_impact_sprite_lands_on_the_first_active_frame():
    for name in ATTACKS:
        clip = CONFIG["clips"][name]
        s, a, r = clip["frames"]
        frames = sample_frames(clip)
        idx = impact_sprite_index(clip)
        assert idx == math.ceil(s / 2)
        assert frames[idx] == clip["impact"]
        # runtime shows sprite floor(gameFrame / 2): the first active game frame is s
        assert s // 2 == idx
        assert len(frames) == math.ceil(s / 2) + math.ceil(a / 2) + math.ceil(r / 2)


def test_samples_never_leave_the_clip_range():
    for clip in CONFIG["clips"].values():
        frames = sample_frames(clip)
        assert frames, clip
        assert all(clip["start"] <= f <= clip["end"] for f in frames), clip


def test_loop_samples_thirty_per_second_and_hold_ends_on_the_last_frame():
    assert len(sample_frames({"kind": "loop", "start": 1, "end": 61})) == 30
    held = sample_frames({"kind": "hold", "start": 1, "end": 30})
    assert held[-1] == 30
    once = sample_frames({"kind": "once", "start": 5, "end": 6})
    assert once == [5, 6]
