"""Render Mixamo fighter animations to transparent sprite frames (spec 4.3).

Run through `npm run render:sprites -- [--only fighter_a] [--clips idle,punch_l]`, which calls:
    blender -b --factory-startup -P tools/blender/render_sprites.py -- --config art/sprites.json ...
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time

import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)
from tools.sprites.timing import sample_frames  # noqa: E402

STANDING_HEIGHT = 1.8          # every fighter is scaled to this height (world units)
FRAME_W, FRAME_H = 576, 384    # wide frame so kicks are not cropped
FILL = 0.88                    # standing height as a fraction of the frame height
GROUND_MARGIN = 0.04           # feet sit this fraction above the bottom edge
YAW_DEG = 20                   # 3/4 view toward the fighter's front
HIPS = "mixamorig:Hips"


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--config", default=os.path.join(ROOT, "art", "sprites.json"))
    p.add_argument("--raw", default=os.path.join(ROOT, "art", "raw"))
    p.add_argument("--out", default=os.path.join(ROOT, "art", "render"))
    p.add_argument("--only", default="")
    p.add_argument("--clips", default="")
    p.add_argument("--scan", type=int, default=0, help="render every Nth source frame of each clip to <out>/_scan for picking ranges")
    return p.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_fbx(path: str) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    return [o for o in bpy.data.objects if o not in before]


def armature_of(objs: list[bpy.types.Object]) -> bpy.types.Object:
    return next(o for o in objs if o.type == "ARMATURE")


def assign_action(arm: bpy.types.Object, action: bpy.types.Action) -> None:
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = action
    slots = getattr(action, "slots", None)
    if slots and hasattr(ad, "action_slot") and ad.action_slot is None:
        ad.action_slot = slots[0]


def load_action(path: str) -> bpy.types.Action:
    """Imports an animation FBX, keeps its action, deletes the imported objects."""
    before = set(bpy.data.actions)
    objs = import_fbx(path)
    actions = [a for a in bpy.data.actions if a not in before]
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    action = actions[0]
    action.use_fake_user = True
    return action


def setup_render(scene: bpy.types.Scene) -> None:
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.film_transparent = True
    scene.render.resolution_x = FRAME_W
    scene.render.resolution_y = FRAME_H
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.fps = 60
    eevee = getattr(scene, "eevee", None)
    if eevee and hasattr(eevee, "taa_render_samples"):
        eevee.taa_render_samples = 16


def add_light(name: str, kind: str, loc: Vector, color: tuple, energy: float, size: float = 1.0) -> None:
    data = bpy.data.lights.new(name, kind)
    data.color = color
    data.energy = energy
    if kind == "AREA":
        data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector((0, 0, 0.9)) - loc).to_track_quat("-Z", "Y").to_euler()


def setup_camera_and_lights() -> None:
    """Fighters face -Y after import; a camera on the -X side sees them facing screen-right."""
    scene = bpy.context.scene
    yaw = math.radians(YAW_DEG)
    dist = 10.0
    height_world = STANDING_HEIGHT / FILL
    width_world = height_world * FRAME_W / FRAME_H
    cam_z = height_world / 2 - GROUND_MARGIN * height_world
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = width_world
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = Vector((-dist * math.cos(yaw), -dist * math.sin(yaw), cam_z))
    target = Vector((0, 0, cam_z))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    # warm key from the camera side, cyan and magenta rims behind (neon street)
    add_light("key", "AREA", Vector((-4, -4, 3)), (1.0, 0.92, 0.85), 1600, size=3)
    add_light("fill", "AREA", Vector((-5, 2, 1.5)), (0.75, 0.8, 1.0), 400, size=4)
    add_light("rim_cyan", "AREA", Vector((2, 3, 2.5)), (0.2, 0.9, 1.0), 700, size=2)
    add_light("rim_pink", "AREA", Vector((2, -3, 2.5)), (1.0, 0.25, 0.75), 500, size=2)
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.02, 0.02, 0.05, 1)
        bg.inputs[1].default_value = 0.3
    scene.world = world


def soften_materials(meshes: list[bpy.types.Object]) -> None:
    """Mixamo materials often come out glossy like plastic; make them read as cloth and skin."""
    for m in meshes:
        for slot in m.material_slots:
            mat = slot.material
            if not mat or not mat.use_nodes:
                continue
            links = mat.node_tree.links
            for node in mat.node_tree.nodes:
                if node.type != "BSDF_PRINCIPLED":
                    continue
                for key, value in (("Roughness", 0.7), ("Specular IOR Level", 0.25), ("Specular", 0.25), ("Coat Weight", 0.0)):
                    sock = node.inputs.get(key)
                    if sock is None:
                        continue
                    for link in list(sock.links):
                        links.remove(link)
                    sock.default_value = value


def normalize_height(arm: bpy.types.Object, meshes: list[bpy.types.Object]) -> None:
    bpy.context.view_layer.update()
    zs = [(m.matrix_world @ Vector(c)).z for m in meshes for c in m.bound_box]
    height = max(zs) - min(zs)
    factor = STANDING_HEIGHT / height
    arm.scale = arm.scale * factor
    bpy.context.view_layer.update()
    zs = [(m.matrix_world @ Vector(c)).z for m in meshes for c in m.bound_box]
    arm.location.z -= min(zs)


def body_yaw(arm: bpy.types.Object) -> float:
    """Heading of the hips (left-to-right leg axis) in the ground plane."""
    v = (arm.matrix_world @ arm.pose.bones["mixamorig:LeftUpLeg"].head) - (arm.matrix_world @ arm.pose.bones["mixamorig:RightUpLeg"].head)
    return math.atan2(v.y, v.x)


def hips_world(arm: bpy.types.Object) -> Vector:
    return arm.matrix_world @ arm.pose.bones[HIPS].head


def render_clip(arm: bpy.types.Object, frames: list[int], out_dir: str, clip: str, label_frames: bool = False, lock_vertical: bool = False) -> None:
    scene = bpy.context.scene
    base = arm.location.copy()
    arm.location = base
    scene.frame_set(frames[0])
    bpy.context.view_layer.update()
    ref = hips_world(arm)
    for i, f in enumerate(frames):
        arm.location = base
        scene.frame_set(f)
        bpy.context.view_layer.update()
        h = hips_world(arm)
        # lock horizontal root motion so every sprite is centred on the same spot
        # jumps are rendered in place (the game lifts the sprite along the sim's jump arc) so they never leave the frame
        arm.location = base - Vector((h.x - ref.x, h.y - ref.y, (h.z - ref.z) if lock_vertical else 0))
        bpy.context.view_layer.update()
        scene.render.filepath = os.path.join(out_dir, f"{clip}{f:03d}.png" if label_frames else f"{clip}_{i:03d}.png")
        bpy.ops.render.render(write_still=True)
    arm.location = base


def render_fighter(name: str, config: dict, raw: str, out: str, only_clips: set[str], scan: int = 0) -> None:
    reset_scene()
    scene = bpy.context.scene
    setup_render(scene)
    objs = import_fbx(os.path.join(raw, "characters", f"{name}.fbx"))
    arm = armature_of(objs)
    meshes = [o for o in objs if o.type == "MESH"]
    if arm.animation_data:
        arm.animation_data.action = None
    normalize_height(arm, meshes)
    soften_materials(meshes)
    setup_camera_and_lights()
    out_dir = os.path.join(out, name)
    os.makedirs(out_dir, exist_ok=True)
    # clips marked "align" are turned so their first frame faces like the idle stance (some Mixamo clips rotate the body)
    base_matrix = arm.matrix_world.copy()
    idle = config["clips"]["idle"]
    assign_action(arm, load_action(os.path.join(raw, "anims", idle["file"])))
    bpy.context.scene.frame_set(idle["start"])
    bpy.context.view_layer.update()
    ref_yaw = body_yaw(arm)
    for clip, spec in config["clips"].items():
        if only_clips and clip not in only_clips:
            continue
        t0 = time.time()
        action = load_action(os.path.join(raw, "anims", spec["file"]))
        assign_action(arm, action)
        arm.matrix_world = base_matrix
        bpy.context.scene.frame_set(spec["start"])
        bpy.context.view_layer.update()
        if spec.get("align"):
            arm.matrix_world = Matrix.Rotation(ref_yaw - body_yaw(arm), 4, "Z") @ base_matrix
        bpy.context.view_layer.update()
        if scan:
            last = int(action.frame_range[1])
            scan_dir = os.path.join(out, "_scan", name)
            os.makedirs(scan_dir, exist_ok=True)
            frames = list(range(1, last + 1, scan))
            for f in frames:
                bpy.context.scene.frame_set(f)
            render_clip(arm, frames, scan_dir, f"{clip}_f", label_frames=True)
            print(f"SCANNED {name}/{clip}: frames 1-{last} step {scan}", flush=True)
            continue
        frames = sample_frames(spec)
        for old in os.listdir(out_dir):
            if old.startswith(f"{clip}_") and old.endswith(".png"):
                os.remove(os.path.join(out_dir, old))
        render_clip(arm, frames, out_dir, clip, lock_vertical=bool(spec.get("lock_vertical")))
        print(f"RENDERED {name}/{clip}: {len(frames)} frames in {time.time() - t0:.1f}s", flush=True)


def main() -> None:
    args = parse_args()
    with open(args.config, encoding="utf8") as fh:
        config = json.load(fh)
    fighters = [f for f in config["fighters"] if not args.only or f in args.only.split(",")]
    clips = {c for c in args.clips.split(",") if c}
    for name in fighters:
        render_fighter(name, config, args.raw, args.out, clips, args.scan)


main()
