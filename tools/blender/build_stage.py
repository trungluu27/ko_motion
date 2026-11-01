"""Procedural neon street stage rendered to parallax layers (spec 4.5).

Run: npm run render:stage   (blender -b --factory-startup -P tools/blender/build_stage.py -- [--out art/render/stage])
Writes full.png, far.png, mid.png and stage.json to the out dir; tools/sprites/stage_post.py finishes the layers.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
W, H = 2560, 720
FIGHTER_Y = 2.0       # depth of the line the fighters stand on
CURB_Y = 7.5          # where the road meets the sidewalk
NEON = [(0.1, 0.95, 1.0), (1.0, 0.2, 0.7), (0.65, 0.3, 1.0), (1.0, 0.55, 0.15)]
WORDS = ["RAMEN", "KO BAR", "ARCADE", "24H", "DOJO", "NOODLE", "HOTEL", "FIGHT"]


def args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=os.path.join(ROOT, "art", "render", "stage"))
    p.add_argument("--seed", type=int, default=7)
    return p.parse_args(argv)


def collection(name: str) -> bpy.types.Collection:
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def material(name: str, base=(0.02, 0.02, 0.03), rough=0.6, emit=None, strength=0.0, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return m


def window_material(name: str, warm: bool) -> bpy.types.Material:
    """Dark facade whose emission is a brick-texture grid: randomly lit windows."""
    m = material(name, base=(0.015, 0.015, 0.025), rough=0.8)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    # facades face -Y: map (x, z) onto the texture so windows form a grid on the front
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(coord.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["X"], comb.inputs["X"])
    nt.links.new(sep.outputs["Z"], comb.inputs["Y"])
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.inputs["Scale"].default_value = 2.0
    brick.inputs["Mortar Size"].default_value = 0.08
    brick.inputs["Brick Width"].default_value = 0.6
    brick.inputs["Row Height"].default_value = 0.45
    brick.offset = 0.0
    lit = (1.0, 0.75, 0.4, 1) if warm else (0.55, 0.75, 1.0, 1)
    brick.inputs["Color1"].default_value = lit
    brick.inputs["Color2"].default_value = (0.02, 0.02, 0.03, 1)
    brick.inputs["Mortar"].default_value = (0, 0, 0, 1)
    brick.inputs["Bias"].default_value = 0.6  # mostly dark windows, some lit
    nt.links.new(comb.outputs[0], brick.inputs["Vector"])
    nt.links.new(brick.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.2
    return m


def box(coll, name, loc, size, mat):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = loc
    obj.data.materials.append(mat)
    return obj


def text(coll, body, loc, size, mat, rot_x=math.pi / 2):
    curve = bpy.data.curves.new(body, "FONT")
    curve.body = body
    curve.size = size
    curve.extrude = 0.03
    curve.align_x = "CENTER"
    obj = bpy.data.objects.new(body, curve)
    coll.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (rot_x, 0, 0)
    obj.data.materials.append(mat)
    return obj


def build(seed: int) -> dict:
    rnd = random.Random(seed)
    scene = bpy.context.scene
    far, mid, floor = collection("far"), collection("mid"), collection("floor")

    # road (wet, glossy) and sidewalk
    road = material("road", base=(0.012, 0.012, 0.016), rough=0.08)
    box(floor, "road", (0, 20, -0.05), (120, 60, 0.1), road)
    box(mid, "sidewalk", (0, CURB_Y + 1.2, 0.08), (120, 2.4, 0.16), material("walk", base=(0.05, 0.05, 0.06), rough=0.35))

    # near facade row with neon signs and lamps
    x = -46.0
    i = 0
    while x < 46:
        w = rnd.uniform(4.5, 9.0)
        h = rnd.uniform(6, 11)
        b = box(mid, f"b{i}", (x + w / 2, CURB_Y + 2.4 + 3, h / 2), (w - 0.2, 6, h), window_material(f"win{i}", rnd.random() < 0.6))
        b.data.materials[0].node_tree.nodes["Brick Texture"].inputs["Scale"].default_value = rnd.uniform(1.6, 2.4)
        if rnd.random() < 0.75:
            col = rnd.choice(NEON)
            sign_mat = material(f"neon{i}", emit=col, strength=rnd.uniform(5, 8))
            word = rnd.choice(WORDS)
            text(mid, word, (x + w / 2, CURB_Y + 2.35, rnd.uniform(3.4, min(h - 1.2, 6.5))), rnd.uniform(0.8, 1.2), sign_mat)
            if rnd.random() < 0.5:  # vertical blade sign
                blade = material(f"blade{i}", emit=rnd.choice(NEON), strength=6)
                box(mid, f"blade{i}", (x + 0.4, CURB_Y + 1.6, rnd.uniform(4, 6)), (0.12, 0.9, rnd.uniform(2, 3.5)), blade)
            box(mid, f"bar{i}", (x + w / 2, CURB_Y + 2.38, 2.6), (w * 0.8, 0.05, 0.08), sign_mat)
        x += w
        i += 1
    lamp_light = material("lamp", emit=(1.0, 0.85, 0.6), strength=12)
    pole = material("pole", base=(0.03, 0.03, 0.035), rough=0.4, metallic=0.8)
    for lx in range(-40, 41, 14):
        box(mid, f"pole{lx}", (lx, CURB_Y + 0.6, 2.2), (0.12, 0.12, 4.4), pole)
        box(mid, f"lamp{lx}", (lx, CURB_Y + 0.3, 4.4), (0.9, 0.35, 0.15), lamp_light)
        light = bpy.data.lights.new(f"l{lx}", "POINT")
        light.energy = 900
        light.color = (1.0, 0.8, 0.55)
        lo = bpy.data.objects.new(f"l{lx}", light)
        mid.objects.link(lo)
        lo.location = (lx, CURB_Y + 0.3, 4.2)

    # far skyline
    for j in range(40):
        w = rnd.uniform(4, 10)
        h = rnd.uniform(14, 45)
        bx = rnd.uniform(-90, 90)
        box(far, f"far{j}", (bx, rnd.uniform(40, 70), h / 2), (w, 6, h), window_material(f"fwin{j}", rnd.random() < 0.4))

    # neon spill on the street
    for k, col in enumerate(NEON):
        a = bpy.data.lights.new(f"spill{k}", "AREA")
        a.energy = 1200
        a.color = col
        a.size = 8
        ao = bpy.data.objects.new(f"spill{k}", a)
        mid.objects.link(ao)
        ao.location = (-30 + k * 20, CURB_Y + 1, 6)
        ao.rotation_euler = (math.radians(110), 0, 0)

    # world: deep night blue
    world = bpy.data.worlds.new("night")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.01, 0.012, 0.04, 1)
    bg.inputs[1].default_value = 1.0
    scene.world = world

    # camera: street-level, looking along +Y
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 18
    cam_data.sensor_width = 36
    cam_data.sensor_fit = "HORIZONTAL"
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, -10, 2.0)
    cam.rotation_euler = (math.radians(92.5), 0, 0)
    scene.camera = cam

    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    ee = scene.eevee
    for attr, value in (("use_raytracing", True), ("taa_render_samples", 64), ("use_shadows", True)):
        if hasattr(ee, attr):
            setattr(ee, attr, value)
    scene.render.resolution_x, scene.render.resolution_y = W, H
    scene.view_settings.view_transform = "Standard"  # keep neon colours saturated (AgX washes them to white)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    bpy.context.view_layer.update()

    def row(y: float) -> int:
        p = world_to_camera_view(scene, cam, Vector((0, y, 0)))
        return round((1 - p.y) * H)

    return {"width": W, "height": H, "fighterRow": row(FIGHTER_Y), "curbRow": row(CURB_Y)}


def render(path: str, transparent: bool, visible: set[str]) -> None:
    scene = bpy.context.scene
    for c in scene.collection.children:
        c.hide_render = c.name not in visible
    scene.render.film_transparent = transparent
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main() -> None:
    a = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    info = build(a.seed)
    os.makedirs(a.out, exist_ok=True)
    render(os.path.join(a.out, "full.png"), False, {"far", "mid", "floor"})
    render(os.path.join(a.out, "far.png"), False, {"far"})
    render(os.path.join(a.out, "mid.png"), True, {"mid"})
    with open(os.path.join(a.out, "stage.json"), "w", encoding="utf8") as fh:
        json.dump(info, fh)
    print("STAGE", json.dumps(info), flush=True)


main()
