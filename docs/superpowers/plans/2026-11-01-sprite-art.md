# Sprite Art (Mixamo fighters + neon street) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the two Mixamo fighters and a procedural neon-street stage with Blender, pack them into Phaser atlases, and draw them in the fight instead of stick figures, with attack impacts aligned to the sim's frame data.

**Architecture:** Offline pipeline: `art/sprites.json` (clip config) → `tools/sprites/timing.py` (which source frames to render) → `tools/blender/render_sprites.py` (headless Blender, EEVEE, transparent PNGs + contact sheet) → `tools/sprites/pack.py` (trim + multi-atlas JSON for Phaser) → `public/sprites/`. Stage: `tools/blender/build_stage.py` → `public/stages/neon_street/`. Runtime: pure `spriteFrame()` maps sim state to clip/index; `FighterSprite` and a parallax `Stage` draw it; the stick fighter remains the fallback.

**Tech Stack:** Blender 5.2 (bpy, EEVEE), Python 3.11 `.venv` (Pillow, pytest), Phaser 3.90 multi-atlas, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-sprite-art-design.md`

## Global Constraints

- Raw Mixamo files stay in `art/raw/` (git-ignored); only rendered/packed output is committed.
- One sprite per **2 game frames** for attacks; loops at 30 sprites/s; frame height 384 px; atlas pages ≤ 4096×4096.
- The sprite shown on the first active game frame of every attack is the clip's `impact` frame (spec 4.2).
- Characters face **right** in renders; the game flips for facing −1.
- Blender found at `$BLENDER`, else `C:\Program Files\Blender Foundation\*\blender.exe` (newest).
- `npm run check` and `.venv\Scripts\python -m pytest tools/tests -q` green before each commit; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Missing or failed sprite load** (fresh clone without renders, 404, decode error): the fight still runs with stick fighters. Test in Task 6.
2. **AI telegraph (24 extra startup frames):** the startup animation stretches over the telegraph and the impact still lands on the first active frame. Test in Task 6.
3. **Walking backwards vs forwards when facing flips** (fighters swap sides): `walk_fwd` always means toward the opponent. Test in Task 6.
4. **Clips shorter or longer than their sampled length:** sampling never reads outside `[start, end]`. Test in Task 1.
5. **Frame-rate regression:** keyboard mode still ≥ 55 FPS with sprites + stage (F3). Manual check in Task 7.

---

### Task 1: Clip config and frame sampling

**Files:** Create `art/sprites.json`, `tools/sprites/__init__.py`, `tools/sprites/timing.py`, `tools/tests/test_timing.py`. Modify `tools/requirements.txt` (+ `Pillow`).

**Interfaces – Produces:**
```python
# art/sprites.json: {"fighters": ["fighter_a", "fighter_b"], "height_px": 384,
#   "clips": {name: {"file": str, "start": int, "end": int, "kind": "loop"|"once"|"hold"|"attack",
#                    "impact"?: int, "frames"?: [startup, active, recovery]}}}
def sample_frames(clip: dict) -> list[int]:
    """Source frame numbers to render, in playback order.
    attack: one sprite per 2 game frames: ceil(S/2) sprites over [start, impact) ending just before impact,
            then impact for ceil(A/2) sprites, then ceil(R/2) sprites over (impact, end].
    loop: 30 sprites/s over [start, end) (step 2 at 60 fps). hold/once: same step, last frame = end."""
def impact_sprite_index(clip: dict) -> int:   # index of the first sprite showing `impact`
```
Attack frame data copied from spec 6.1: punch_l [4,3,10], punch_r [6,3,14], kick_l [8,4,18], kick_r [10,4,20], special [12,6,30].

- [ ] Test: for each of the 5 attacks, `sample_frames(c)[impact_sprite_index(c)] == c["impact"]` and `impact_sprite_index(c) == ceil(S/2)`; every sampled frame lies in `[start, end]` **[RF4]**; loop of 60 source frames → 30 sprites; `hold` last sample == end.
- [ ] FAIL → implement (initial `start/end/impact` guesses from clip lengths measured in the inspection: refined in Task 3) → PASS → commit `feat(art): clip config and frame sampling aligned to frame data`.

### Task 2: Blender sprite renderer

**Files:** Create `tools/blender/render_sprites.py`, `scripts/blender.ts` (find Blender, run a script), `package.json` scripts `render:sprites`, `render:stage`.

Behaviour: for each fighter, import `art/raw/characters/<f>.fbx`; for each clip import the animation FBX, transfer its action to the fighter armature (same `mixamorig:` bones), lock root horizontal translation (`mixamorig:Hips` X/Y location keys zeroed relative to frame `start`) so attacks stay in place; scale so standing height = 90 % of the frame; camera orthographic, yaw so the fighter faces screen-right at a 3/4 angle of 20°; lights: warm key front, cyan rim left, magenta rim right; EEVEE, transparent film, 384×384; render the frames from `sample_frames` to `art/render/<f>/<clip>_<NNN>.png`; build `art/render/<f>/_preview.png` (grid of every clip, impact sprite outlined red) with Pillow-free Blender image ops or by a follow-up Python step.

- [ ] `npm run render:sprites -- --only fighter_a --clips idle,punch_l` renders without errors (log lists frame counts).
- [ ] Look at the preview image: fighter visible, faces right, feet on the same baseline, not cropped.
- [ ] Commit `feat(art): headless Blender sprite renderer`.

### Task 3: Render everything and tune impact frames

- [ ] Render all clips for both fighters. For each attack, inspect the preview and adjust `start/impact/end` in `art/sprites.json` so the impact sprite shows full extension; adjust loop ranges so idle/walk loop without a jump; trim long clips (victory, defeat, special) to their best 1–2 s.
- [ ] Re-run Task 1 tests (still green) and re-render.
- [ ] Commit `chore(art): tuned clip ranges and impact frames` (config only; renders stay in `art/render/`).

### Task 4: Atlas packer

**Files:** Create `tools/sprites/pack.py`, `tools/tests/test_pack.py`. Output `public/sprites/<f>.json`, `public/sprites/<f>-<n>.png`.

**Interfaces – Produces:**
```python
def pack(frames: dict[str, Image], max_size: int = 4096, pad: int = 2) -> list[Page]   # shelf packing of trimmed frames
def write_phaser_multiatlas(pages, out_dir, name, meta) -> None   # Phaser 3 multiatlas JSON ("textures": [...])
```
Frame key `<clip>/<NNN>`; each frame keeps `spriteSourceSize`/`sourceSize` so trimmed frames align; JSON `meta.anchor = {x, y}` (feet point, from the idle frame's lowest opaque pixel row, in source-frame pixels) and `meta.clips = {name: count}`.

- [ ] Test: 50 random-size frames pack with no overlaps, every page ≤ 4096², every frame key present, trimmed offsets restore the original frame size.
- [ ] FAIL → implement → PASS; run on the real renders; commit packer + `public/sprites/*` `feat(art): multi-atlas packer and packed fighter sprites`.

### Task 5: Neon street stage

**Files:** Create `tools/blender/build_stage.py`. Output `public/stages/neon_street/{far.jpg, mid.png, floor.png}` (2560×720).

Procedural scene: two rows of box buildings with emissive window grids, 6–8 neon signs (emissive planes with short invented words, cyan/pink/violet), street lamps, wet glossy road with screen-space reflections, light fog; camera matching the sprite camera's angle. Render each layer with the others hidden (alpha for mid/floor).
- [ ] `npm run render:stage` produces the three files; view them; commit `feat(art): procedural neon street stage`.

### Task 6: Sprite animation mapping and game rendering

**Files:** Create `src/game/render/spriteAnim.ts`, `src/game/render/fighterSprite.ts`, `src/game/render/stage.ts`, `tests/game/spriteAnim.test.ts`. Modify `src/game/scenes/FightScene.ts` (preload + use), `src/game/render/stickFighter.ts` (unchanged, fallback).

**Interfaces – Produces:**
```ts
type ClipName = 'idle' | 'walk_fwd' | 'walk_back' | 'jump' | 'crouch' | 'punch_l' | 'punch_r' | 'kick_l' | 'kick_r' | 'special'
  | 'block' | 'dodge' | 'hit_high' | 'hit_mid' | 'knockdown' | 'victory' | 'defeat';
type ClipInfo = Record<ClipName, { count: number; impact?: number }>;   // from atlas meta (impact = ceil(S/2))
type AnimCtx = { opponentX: number; lastHitMove: MoveId | null; result: MatchResult | null; self: 0 | 1; tick: number; clips: ClipInfo };
function spriteFrame(f: Fighter, ctx: AnimCtx): { clip: ClipName; index: number };
```
Rules (spec 5.1): walk_fwd when moving toward `opponentX`; attack index = startup part stretched over `startup + extraStartup` so `index == impact` exactly at the first active frame, then `floor((frame − extra)/2)` afterwards, clamped to `count − 1`; loops use `tick`; hold/once clamp to last.
- `FighterSprite`: Phaser Sprite from multiatlas, origin at anchor, `flipX` when facing −1, scale `300 / 384 · bodyScale`, shadow ellipse, white tint flash 2 frames on hit, yellow pulse while telegraphing.
- `Stage`: three images, camera-follow offset `clamp((midX − 500) · 0.16, −80, 80)` with factors 0.2/0.5/1.
- FightScene `preload()` loads both multiatlases and stage images; on `loaderror` for a fighter or missing texture → stick fighters for both (warn once).
- [ ] Test: idle loops; walk toward opponent → walk_fwd for both facings **[RF3]**; jab with extraStartup 0 → index 2 at frame 4 (impact); jab with extraStartup 24 → impact index at frame 28 **[RF2]**; hitstun after kick → hit_mid; after a KO the winner shows victory, loser knockdown last frame; timeout loser shows defeat.
- [ ] FAIL → implement → PASS → `npm run build` → manual: fight shows sprites and stage; delete `public/sprites` temporarily → stick fallback **[RF1]** → commit `feat(game): Mixamo fighter sprites and neon street stage`.

### Task 7: Performance and docs

- [ ] F3 in keyboard and body mode; record FPS in the spec appendix. If < 55 FPS, lower `height_px` to 320 and re-pack **[RF5]**.
- [ ] README: credit "Characters and animations: Mixamo (Adobe)", how to re-render (`npm run render:sprites`, `npm run render:stage`), note that `art/raw` is not distributed.
- [ ] Commit `docs: sprite pipeline usage and performance notes`.
