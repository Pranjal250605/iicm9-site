"""
IICM 9.0 snow village generator.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/build_village.py -- --out public/models/village.glb
Flags: --no-render (skip preview PNGs), --no-bake (skip ambient-occlusion bake, faster iteration)

Builds a stylized Himalayan village (vertex-coloured, a handful of materials so the web scene stays at
few draw calls), bakes ambient occlusion into the vertex colours with Cycles, exports a Draco GLB,
renders preview PNGs and saves village.blend next to this script.

Named nodes the website relies on:
  Cam_00..Cam_12 / Look_00..Look_12   camera rail (edit these to retune the flight)
  Cup_01..Cup_13, CupWin_XX, Sign_XX  the 13 cup cabins, their windows and sign faces
  GateSign, StageScreen               text panels (textured at runtime)
  FireAnchor, Lamp_XX, Chimney_XX     anchors for lights / particles
  Bulbs                               festive lights (vertex-coloured, unlit + bloom at runtime)
"""

import bpy
import math
import numpy as np
import os
import random
import sys

from mathutils import Matrix, Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(argv[argv.index("--out") + 1]) if "--out" in argv else os.path.join(HERE, "village.glb")
SKIP_RENDER = "--no-render" in argv
SKIP_BAKE = "--no-bake" in argv

rng = random.Random(9)
jrng = random.Random(3)  # colour jitter only, so layout stays stable

# ---------------------------------------------------------------- palette (sRGB)
SNOW = (0.93, 0.96, 1.0)
SNOW_SHADE = (0.80, 0.86, 0.95)
PACKED = (0.74, 0.79, 0.88)
ROCK = (0.27, 0.28, 0.33)
ROCK_DARK = (0.17, 0.18, 0.23)
ICE = (0.52, 0.66, 0.80)
ICICLE = (0.80, 0.90, 1.0)
WOODS = [(0.36, 0.22, 0.14), (0.42, 0.27, 0.16), (0.30, 0.19, 0.14), (0.47, 0.31, 0.19)]
ACCENTS = [(0.55, 0.12, 0.10), (0.12, 0.30, 0.24), (0.15, 0.24, 0.42), (0.62, 0.42, 0.16)]
WOOD_DARK = (0.16, 0.10, 0.07)
ROOF_UNDER = (0.20, 0.13, 0.10)
STONE = (0.40, 0.41, 0.46)
STONE_DARK = (0.28, 0.29, 0.34)
PINE = (0.07, 0.19, 0.18)
PINE_2 = (0.09, 0.24, 0.21)
PINE_3 = (0.06, 0.16, 0.17)
BARK = (0.22, 0.14, 0.10)
IRON = (0.10, 0.10, 0.13)
CARROT = (0.95, 0.45, 0.15)
WREATH = (0.08, 0.28, 0.14)
RIBBON = (0.78, 0.10, 0.10)
CANVAS_W = (0.92, 0.90, 0.86)
CORAL = (0.89, 0.38, 0.29)
BULB_COLS = [(1.0, 0.86, 0.58), (1.0, 0.62, 0.30), (0.95, 0.42, 0.36), (0.62, 0.80, 1.0)]

MAT_BASE, MAT_WINDOW, MAT_LAMP, MAT_SIGN, MAT_BULB = "Base", "Window", "Lamp", "Sign", "Bulb"
NO_BAKE = ("Sign_", "GateSign", "StageScreen", "CupWin_", "VillageWindows", "LampGlow", "SquareGlow", "GateLamps", "Bulbs")


def shade(c, k):
    return tuple(min(1.0, max(0.0, x * k)) for x in c)


def jitter(c, amt):
    k = 1 + (jrng.random() - 0.5) * 2 * amt
    return shade(c, k)


# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def make_material(name, color=(1, 1, 1), emission=None, strength=0.0, vcol=False, rough=0.9):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    if vcol:
        attr = nt.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Color"
        nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
        if emission:
            nt.links.new(attr.outputs["Color"], bsdf.inputs["Emission Color"])
    if emission:
        if not vcol:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


MATS = {
    MAT_BASE: make_material(MAT_BASE, vcol=True),
    MAT_WINDOW: make_material(MAT_WINDOW, (1.0, 0.62, 0.28), emission=(1.0, 0.62, 0.28), strength=5.0),
    MAT_LAMP: make_material(MAT_LAMP, (1.0, 0.78, 0.48), emission=(1.0, 0.78, 0.48), strength=9.0),
    MAT_SIGN: make_material(MAT_SIGN, (0.35, 0.22, 0.13)),
    MAT_BULB: make_material(MAT_BULB, emission=(1, 1, 1), strength=8.0, vcol=True),
}


# ---------------------------------------------------------------- mesh builder
class MB:
    """Accumulates low-poly primitives with per-face colour + material slot."""

    def __init__(self, mats=(MAT_BASE,), jit=0.04):
        self.mats = list(mats)
        self.jit = jit
        self.v, self.f, self.fc, self.fm, self.uv = [], [], [], [], []

    def _slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def face(self, pts, color, mat=MAT_BASE, uvs=None):
        base = len(self.v)
        self.v.extend(Vector(p) for p in pts)
        self.f.append(tuple(range(base, base + len(pts))))
        self.fc.append(jitter(color, self.jit) if (self.jit and mat == MAT_BASE) else color)
        self.fm.append(self._slot(mat))
        self.uv.append(uvs)

    def box(self, center, size, color, M=Matrix.Identity(4), R=Matrix.Identity(3), mat=MAT_BASE, top=None, skip_bottom=True):
        c = Vector(center)
        sx, sy, sz = (s / 2 for s in size)
        corners = []
        for i in range(8):
            local = Vector((sx if i & 1 else -sx, sy if i & 2 else -sy, sz if i & 4 else -sz))
            corners.append(M @ (c + R @ local))
        faces = [((4, 5, 7, 6), top or color), ((0, 1, 5, 4), color), ((2, 6, 7, 3), color),
                 ((0, 4, 6, 2), color), ((1, 3, 7, 5), color)]
        if not skip_bottom:
            faces.append(((0, 2, 3, 1), color))
        for idx, col in faces:
            self.face([corners[i] for i in idx], col, mat)

    def prism(self, center, r, length, seg, color, M=Matrix.Identity(4), R=Matrix.Identity(3), cap=None, mat=MAT_BASE):
        """Cylinder along local Z (rotate with R)."""
        c = Vector(center)
        lo, hi = [], []
        for k in range(seg):
            a = k / seg * math.tau
            p = Vector((math.cos(a) * r, math.sin(a) * r, 0))
            lo.append(M @ (c + R @ (p + Vector((0, 0, -length / 2)))))
            hi.append(M @ (c + R @ (p + Vector((0, 0, length / 2)))))
        for k in range(seg):
            n = (k + 1) % seg
            self.face([lo[k], lo[n], hi[n], hi[k]], color, mat)
        self.face(hi, cap or color, mat)
        self.face(lo[::-1], cap or color, mat)

    def tier_cone(self, base, r, h, seg, low, tip, frac=0.55, M=Matrix.Identity(4), wobble=0.0):
        b = Vector(base)
        ring0, ring1 = [], []
        off = rng.random() * math.tau
        for k in range(seg):
            a = off + k * math.tau / seg
            rr = r * (1 + (rng.random() - 0.5) * wobble)
            droop = -0.12 * r * (rng.random())
            ring0.append(M @ (b + Vector((math.cos(a) * rr, math.sin(a) * rr, droop))))
            ring1.append(M @ (b + Vector((math.cos(a) * rr * (1 - frac), math.sin(a) * rr * (1 - frac), h * frac))))
        apex = M @ (b + Vector((0, 0, h)))
        for k in range(seg):
            n = (k + 1) % seg
            self.face([ring0[k], ring0[n], ring1[n], ring1[k]], low)
            self.face([ring1[k], ring1[n], apex], tip)

    def icicle(self, top, length, r, M=Matrix.Identity(4)):
        t = Vector(top)
        ring = [M @ (t + Vector((math.cos(a) * r, math.sin(a) * r, 0))) for a in (0, math.pi / 2, math.pi, 1.5 * math.pi)]
        apex = M @ (t - Vector((0, 0, length)))
        for k in range(4):
            self.face([ring[(k + 1) % 4], ring[k], apex], ICICLE)

    def sphere(self, center, r, color, seg=8, rings=5, M=Matrix.Identity(4), squash=1.0, mat=MAT_BASE, top_only=False, cols=None):
        c = Vector(center)
        pts = []
        last = rings // 2 if top_only else rings
        for i in range(last + 1):
            t = math.pi * i / rings
            pts.append([M @ (c + Vector((math.sin(t) * math.cos(math.tau * k / seg) * r,
                                         math.sin(t) * math.sin(math.tau * k / seg) * r,
                                         math.cos(t) * r * squash))) for k in range(seg)])
        for i in range(last):
            for k in range(seg):
                n = (k + 1) % seg
                col = cols(i, k) if cols else color
                self.face([pts[i][k], pts[i + 1][k], pts[i + 1][n], pts[i][n]], col, mat)

    def mound(self, center, rx, ry, hz, color=SNOW, M=Matrix.Identity(4)):
        """Low half-ellipsoid of snow."""
        S = Matrix.Diagonal((rx, ry, hz, 1.0))
        self.sphere((0, 0, 0), 1.0, color, seg=10, rings=6, M=M @ Matrix.Translation(center) @ S, top_only=True)

    def build(self, name, parent=None):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.v], [], self.f)
        me.update()
        for m in self.mats:
            me.materials.append(MATS[m])
        col = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
        has_uv = any(u is not None for u in self.uv)
        uvl = me.uv_layers.new(name="UVMap") if has_uv else None
        for poly, c, m, uvs in zip(me.polygons, self.fc, self.fm, self.uv):
            poly.material_index = m
            for j, li in enumerate(poly.loop_indices):
                col.data[li].color_srgb = (*c, 1.0)
                if uvl is not None:
                    uvl.data[li].uv = uvs[j] if uvs else (0.0, 0.0)
        me.color_attributes.active_color = col
        for p in me.polygons:
            p.use_smooth = False
        ob = bpy.data.objects.new(name, me)
        scene.collection.objects.link(ob)
        if parent:
            ob.parent = parent
        return ob


def empty(name, loc, size=0.5):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    e.location = loc
    scene.collection.objects.link(e)
    return e


# ---------------------------------------------------------------- layout constants
GATE_Y = 74.0
STREET_HALF = 3.4
CUP_Y0, CUP_STEP, CUP_X = 58.0, 8.2, 11.5
SQUARE = Vector((0.0, -66.0, 0.0))
SQUARE_R = 13.0
STAGE_Y = -82.0
VALLEY_CENTER = Vector((0.0, -20.0, 0.0))
TREE_SPOT = SQUARE + Vector((math.cos(math.radians(218)) * 10.5, math.sin(math.radians(218)) * 10.5, 0))


def river_x(y):
    return -31.0 + 5.0 * math.sin(y * 0.035)


def terrain_h(x, y):
    v = max(0.0, abs(x) - 16.0)
    h = (v ** 1.6) * 0.06
    h += max(0.0, -y - 95.0) ** 1.5 * 0.08
    h += max(0.0, y - 150.0) ** 1.4 * 0.05
    ramp = min(1.0, v / 18.0)
    h += noise.noise(Vector((x * 0.025, y * 0.025, 1.3))) * 6.0 * ramp
    h += noise.noise(Vector((x * 0.12, y * 0.12, 4.1))) * 0.7 * ramp
    h += noise.noise(Vector((x * 0.08, y * 0.08, 7.7))) * 0.25
    dx = abs(x - river_x(y))
    if dx < 6.0 and -140 < y < 160:
        h -= 1.6 * (1 - (dx / 6.0) ** 2)
    return h


def on_street(x, y):
    return abs(x) < STREET_HALF and STAGE_Y + 6 < y < GATE_Y + 70


def near_river(x, y, pad=7.0):
    return abs(x - river_x(y)) < pad


# ---------------------------------------------------------------- terrain
def build_terrain():
    mb = MB(jit=0.015)
    size, step = 420.0, 2.5
    n = int(size / step)
    half = size / 2
    grid = [[Vector((-half + i * step, -half + j * step - 10, 0)) for i in range(n + 1)] for j in range(n + 1)]
    for row in grid:
        for p in row:
            p.z = terrain_h(p.x, p.y)
    for j in range(n):
        for i in range(n):
            a, b, c, d = grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]
            cx, cy = (a.x + c.x) / 2, (a.y + c.y) / 2
            nrm = (b - a).cross(d - a).normalized()
            slope = 1 - nrm.z
            nz = noise.noise(Vector((cx * 0.07, cy * 0.07, 2.0)))
            if (Vector((cx, cy, 0)) - SQUARE).length < SQUARE_R:
                col = PACKED
            elif on_street(cx, cy):
                col = PACKED if abs(cx) < 2.6 else SNOW_SHADE
            elif abs(cx - river_x(cy)) < 3.0 and -140 < cy < 160:
                col = ICE if nz > -0.3 else shade(ICE, 0.85)
            elif slope > 0.32 + nz * 0.12:
                col = ROCK if nz > -0.2 else ROCK_DARK
            elif slope > 0.2 + nz * 0.1:
                col = SNOW_SHADE
            else:
                col = SNOW
            mb.face([a, b, c, d], col)
    return mb.build("Terrain")


def build_mountains():
    mb = MB(jit=0.03)

    def ring(count, dmin, dmax, rmin, rmax, hmin, hmax, rings, seg, snowline):
        for k in range(count):
            ang = k / count * math.tau + rng.uniform(-0.08, 0.08)
            # leave the camera's starting sky (+Y) open
            if abs(math.atan2(math.sin(ang - math.pi / 2), math.cos(ang - math.pi / 2))) < 0.5:
                continue
            dist = rng.uniform(dmin, dmax)
            c = VALLEY_CENTER + Vector((math.cos(ang) * dist, math.sin(ang) * dist, -8))
            R, H = rng.uniform(rmin, rmax), rng.uniform(hmin, hmax)
            seed = rng.random() * 100
            pts = []
            for i in range(rings):
                t = i / rings
                row = []
                for s in range(seg):
                    a = s / seg * math.tau
                    rr = R * (1 - t) ** 1.15
                    rr *= 1 + noise.noise(Vector((math.cos(a) * 1.6 + seed, math.sin(a) * 1.6, t * 3))) * 0.3
                    z = H * t + noise.noise(Vector((a * 2 + seed, t * 4, 0.5))) * 6 * (1 - t)
                    row.append(c + Vector((math.cos(a) * rr, math.sin(a) * rr, z)))
                pts.append(row)
            apex = c + Vector((rng.uniform(-4, 4), rng.uniform(-4, 4), H + rng.uniform(4, 12)))
            for i in range(rings - 1):
                for s in range(seg):
                    n2 = (s + 1) % seg
                    t = (i + 0.5) / rings
                    nz = noise.noise(Vector((s * 0.6 + seed, i * 0.9, 3.3)))
                    if t > snowline + nz * 0.2:
                        col = SNOW if nz > -0.35 else SNOW_SHADE
                    else:
                        col = ROCK if nz > 0.05 else ROCK_DARK
                    mb.face([pts[i][s], pts[i][n2], pts[i + 1][n2], pts[i + 1][s]], col)
            for s in range(seg):
                mb.face([pts[rings - 1][s], pts[rings - 1][(s + 1) % seg], apex], SNOW)

    ring(22, 175, 235, 55, 95, 80, 170, 12, 30, 0.38)
    ring(16, 300, 380, 100, 160, 170, 290, 10, 30, 0.25)
    return mb.build("Mountains")


# ---------------------------------------------------------------- cabins
def window(mb, win, M, x, z, ww, wh, accent, y, shutters=True, flowers=True):
    pts = [M @ Vector((x - ww / 2, y, z - wh / 2)), M @ Vector((x + ww / 2, y, z - wh / 2)),
           M @ Vector((x + ww / 2, y, z + wh / 2)), M @ Vector((x - ww / 2, y, z + wh / 2))]
    win.face(pts[::-1], (1, 0.7, 0.4), MAT_WINDOW)
    fy = y + 0.04
    light = (0.55, 0.40, 0.27)
    mb.box((x, fy, z + wh / 2 + 0.05), (ww + 0.2, 0.1, 0.1), light, M, top=SNOW)
    mb.box((x - ww / 2 - 0.05, fy, z), (0.1, 0.1, wh), light, M)
    mb.box((x + ww / 2 + 0.05, fy, z), (0.1, 0.1, wh), light, M)
    mb.box((x, fy, z), (0.06, 0.06, wh), WOOD_DARK, M)
    mb.box((x, fy, z), (ww, 0.06, 0.06), WOOD_DARK, M)
    mb.box((x, fy + 0.06, z - wh / 2 - 0.06), (ww + 0.34, 0.24, 0.1), light, M, top=SNOW)
    if shutters:
        for s in (-1, 1):
            mb.box((x + s * (ww / 2 + 0.32), y + 0.03, z), (0.46, 0.06, wh + 0.08), accent, M)
            mb.box((x + s * (ww / 2 + 0.32), y + 0.07, z), (0.36, 0.02, 0.05), shade(accent, 0.7), M)
    if flowers:
        mb.box((x, y + 0.2, z - wh / 2 - 0.26), (ww + 0.15, 0.3, 0.26), WOOD_DARK, M, top=SNOW)


def cabin(mb, win, glow, M, w, d, h, r, wood, accent, chimney_name=None, balcony=False, woodpile=False):
    """Alpine log cabin. Local frame: front faces +Y, ridge runs along Y (gable to the front)."""
    ov = 0.75
    groove = shade(wood, 0.6)
    endgrain = shade(wood, 1.35)
    # stone plinth (extends down to hide slopes)
    mb.box((0, 0, -0.9), (w + 0.5, d + 0.5, 2.6), STONE_DARK, M, top=STONE)
    mb.box((0, 0, 0.4 + (h - 0.4) / 2), (w, d, h - 0.4), wood, M)
    # log courses: grooves on the walls, notched log ends at the corners
    z = 0.62
    while z < h - 0.15:
        for sy in (1, -1):
            mb.box((0, sy * (d / 2 + 0.012), z), (w, 0.04, 0.05), groove, M)
        for sx in (1, -1):
            mb.box((sx * (w / 2 + 0.012), 0, z), (0.04, d, 0.05), groove, M)
        for sx in (1, -1):
            for sy in (1, -1):
                mb.box((sx * w / 2, sy * d / 2, z + 0.2), (0.6, 0.6, 0.36), endgrain, M, top=SNOW if z + 0.42 >= h - 0.15 else endgrain)
        z += 0.42
    # gable triangles front/back + battens
    for sy in (1, -1):
        y = sy * d / 2
        tri = [M @ Vector((-w / 2, y, h)), M @ Vector((w / 2, y, h)), M @ Vector((0, y, h + r))]
        mb.face(tri[::-1] if sy > 0 else tri, shade(wood, 1.08))
        for bx in (-w * 0.3, -w * 0.15, w * 0.15, w * 0.3):
            top = h + r * (1 - abs(bx) / (w / 2))
            mb.box((bx, y + sy * 0.03, (h + top) / 2), (0.08, 0.05, top - h - 0.1), groove, M)
    # roof slabs, snow blanket, fascia, eave lip, icicles
    ang = math.atan2(r, w / 2)
    run = w / 2 + ov
    slab_len = run / math.cos(ang)
    eave_z = h - ov * math.tan(ang)
    for sx in (1, -1):
        Rr = Matrix.Rotation(sx * ang, 3, "Y")
        mid = Vector((sx * run / 2, 0, h + r - (run / 2) * math.tan(ang)))
        nrm = Rr @ Vector((0, 0, 1))
        mb.box(mid + nrm * 0.15, (slab_len, d + 2 * ov, 0.3), ROOF_UNDER, M, Rr, top=ROOF_UNDER)
        mb.box(mid + nrm * 0.5 + Rr @ Vector((0, 0, 0)), (slab_len + 0.25, d + 2 * ov + 0.2, 0.42), SNOW, M, Rr, top=SNOW)
        # pillowy snow ridges
        for k in range(3):
            mb.box(mid + nrm * 0.74 + Rr @ Vector((sx * (k - 1) * slab_len * 0.28, 0, 0)),
                   (slab_len * 0.22, d + 2 * ov - 0.3, 0.12), SNOW, M, Rr)
        # fascia boards on the gable ends
        for sy in (1, -1):
            mb.box(mid + nrm * 0.12 + Vector((0, sy * (d / 2 + ov + 0.06), 0)), (slab_len, 0.1, 0.32), WOOD_DARK, M, Rr)
        ex = sx * (w / 2 + ov * 0.9)
        mb.box((ex, 0, eave_z + 0.08), (0.5, d + 2 * ov + 0.2, 0.36), SNOW_SHADE, M)
        yy = -(d / 2 + ov)
        while yy < d / 2 + ov:
            L = rng.uniform(0.15, 0.85) if rng.random() < 0.8 else rng.uniform(0.9, 1.4)
            mb.icicle((ex + sx * 0.1, yy, eave_z - 0.08), L, rng.uniform(0.04, 0.08), M)
            yy += rng.uniform(0.22, 0.45)
    # door, frame, wreath, step, porch canopy, lantern
    dy = d / 2
    mb.box((0, dy + 0.04, 1.15), (1.2, 0.08, 2.1), WOOD_DARK, M)
    for bx in (-0.66, 0.66):
        mb.box((bx, dy + 0.06, 1.15), (0.12, 0.1, 2.2), endgrain, M)
    mb.box((0, dy + 0.06, 2.27), (1.44, 0.1, 0.14), endgrain, M, top=SNOW)
    for k in range(10):
        a = k / 10 * math.tau
        mb.box((math.cos(a) * 0.24, dy + 0.12, 1.55 + math.sin(a) * 0.24), (0.15, 0.08, 0.15), WREATH, M)
    mb.box((0, dy + 0.15, 1.33), (0.16, 0.05, 0.12), RIBBON, M)
    mb.box((0, dy + 0.55, 0.15), (2.2, 1.0, 0.3), STONE, M, top=SNOW)
    for s in (-1, 1):
        Rc = Matrix.Rotation(s * 0.45, 3, "Y")
        mb.box((s * 0.55, dy + 0.55, 2.75), (1.25, 1.2, 0.12), ROOF_UNDER, M, Rc, top=SNOW)
        mb.box((s * 0.55, dy + 0.55, 2.86), (1.2, 1.15, 0.1), SNOW, M, Rc)
        mb.box((s * 0.9, dy + 0.7, 2.35), (0.08, 0.08, 0.6), WOOD_DARK, M)
    glow.box((0.95, dy + 0.22, 1.95), (0.2, 0.2, 0.28), (1, 0.8, 0.5), M, mat=MAT_LAMP)
    mb.box((0.95, dy + 0.22, 2.13), (0.28, 0.28, 0.08), IRON, M, top=SNOW)
    # front windows
    wy = d / 2 + 0.05
    for x in (-w * 0.3, w * 0.3):
        window(mb, win, M, x, 1.7, 1.0, 1.1, accent, wy)
        if h > 4.0:
            window(mb, win, M, x, 3.35, 0.9, 0.9, accent, wy, flowers=False)
    if balcony:
        bz = h + 0.05
        mb.box((0, dy + 0.55, bz), (w * 0.72, 1.1, 0.16), endgrain, M, top=SNOW)
        bw = w * 0.72
        n = int(bw / 0.42)
        for k in range(n + 1):
            mb.box((-bw / 2 + k * bw / n, dy + 1.05, bz + 0.45), (0.07, 0.07, 0.8), WOOD_DARK, M)
        mb.box((0, dy + 1.05, bz + 0.88), (bw + 0.1, 0.12, 0.1), endgrain, M, top=SNOW)
        mb.box((0, dy + 1.05, bz + 0.99), (bw + 0.1, 0.16, 0.08), SNOW, M)
        for s in (-1, 1):
            mb.box((s * bw / 2, dy + 0.55, bz + 0.45), (0.07, 1.0, 0.07), WOOD_DARK, M)
            mb.box((s * bw * 0.4, dy + 0.35, bz - 0.4), (0.1, 0.1, 0.9), WOOD_DARK, M, Matrix.Rotation(0.6, 3, "X"))
        window(mb, win, M, 0, h + 1.0, 0.9, 1.5, accent, wy, shutters=False, flowers=False)
    else:
        window(mb, win, M, 0, h + r * 0.38, 0.8, 0.8, accent, wy, shutters=False, flowers=False)
    # side windows
    for sx in (1, -1):
        for y in (-d * 0.2, d * 0.2):
            x = sx * (w / 2 + 0.05)
            pts = [M @ Vector((x, y - 0.45, 1.2)), M @ Vector((x, y + 0.45, 1.2)),
                   M @ Vector((x, y + 0.45, 2.2)), M @ Vector((x, y - 0.45, 2.2))]
            win.face(pts if sx > 0 else pts[::-1], (1, 0.7, 0.4), MAT_WINDOW)
            mb.box((x + sx * 0.04, y, 2.27), (0.1, 1.1, 0.1), (0.55, 0.40, 0.27), M, top=SNOW)
            mb.box((x + sx * 0.08, y, 1.12), (0.22, 1.2, 0.1), (0.55, 0.40, 0.27), M, top=SNOW)
            mb.box((x + sx * 0.04, y, 1.7), (0.06, 0.06, 1.0), WOOD_DARK, M)
    # chimney
    cx = -w * 0.22
    cz = h + r - abs(cx) * math.tan(ang)
    mb.box((cx, -d * 0.2, cz + 0.6), (0.8, 0.8, 2.4), STONE, M, top=SNOW)
    mb.box((cx, -d * 0.2, cz + 1.4), (0.86, 0.86, 0.12), STONE_DARK, M)
    mb.box((cx, -d * 0.2, cz + 1.9), (1.0, 1.0, 0.16), STONE_DARK, M, top=SNOW)
    mb.box((cx, -d * 0.2, cz + 2.02), (0.9, 0.9, 0.12), SNOW, M)
    if chimney_name:
        empty(chimney_name, M @ Vector((cx, -d * 0.2, cz + 2.2)), 0.3)
    # woodpile against the +X wall
    if woodpile:
        Rl = Matrix.Rotation(math.pi / 2, 3, "Y")
        for row in range(3):
            for k in range(6 - row):
                yy = -d * 0.35 + k * 0.3 + row * 0.15
                mb.prism((w / 2 + 0.4, yy, 0.17 + row * 0.27), 0.14, 0.7, 6, BARK, M, Rl, cap=(0.62, 0.45, 0.30))
        mb.box((w / 2 + 0.4, -d * 0.35 + 0.75, 0.95), (0.8, 2.0, 0.12), SNOW, M)
    # snow drifts against the walls
    for sx in (1, -1):
        mb.mound((sx * (w / 2 + 0.2), 0, 0.0), 0.7, d * 0.45, 0.45, SNOW, M)
    mb.mound((0, -(d / 2 + 0.2), 0.0), w * 0.45, 0.7, 0.4, SNOW, M)
    for sx in (1, -1):
        mb.mound((sx * w * 0.32, d / 2 + 0.35, 0.0), w * 0.18, 0.55, 0.32, SNOW, M)


def ground_z(x, y, w, d):
    return min(terrain_h(x + sx * w / 2, y + sy * d / 2) for sx in (-1, 1) for sy in (-1, 1))


CHIMNEYS = []


# ---------------------------------------------------------------- cup props: one themed set-piece per cup cabin
RED = (0.74, 0.12, 0.12)
GOLD = (0.95, 0.72, 0.25)
BLACK = (0.06, 0.06, 0.08)
CHROME = (0.72, 0.76, 0.84)
PURPLE = (0.45, 0.25, 0.65)
TEAL = (0.15, 0.62, 0.66)
PINK = (0.93, 0.42, 0.62)
SKY = (0.35, 0.6, 0.95)
BRICK = [(0.55, 0.2, 0.14), (0.62, 0.25, 0.17), (0.48, 0.17, 0.12)]

BULBS = MB((MAT_BULB,), jit=0)


def T(x, y, z):
    return Matrix.Translation((x, y, z))


def Rx(a):
    return Matrix.Rotation(a, 3, "X")


def Ry(a):
    return Matrix.Rotation(a, 3, "Y")


def Rz(a):
    return Matrix.Rotation(a, 3, "Z")


def glow_box(center, size, color, M, R=Matrix.Identity(3)):
    BULBS.box(center, size, color, M, R, mat=MAT_BULB, skip_bottom=False)


def prop_music(mb, glow, P):
    G = P @ T(-0.6, 0.0, 0.0) @ Matrix.Rotation(-0.22, 4, "X")
    body = Rx(-math.pi / 2)
    mb.prism((0, 0, 0.62), 0.58, 0.26, 14, (0.62, 0.18, 0.10), G, body, cap=(0.92, 0.55, 0.22))
    mb.prism((0, 0, 1.25), 0.44, 0.26, 14, (0.62, 0.18, 0.10), G, body, cap=(0.92, 0.55, 0.22))
    mb.prism((0, 0.14, 1.0), 0.14, 0.02, 10, BLACK, G, body)
    mb.box((0, 0.14, 0.45), (0.5, 0.04, 0.1), BLACK, G)
    mb.box((0, 0.05, 2.25), (0.13, 0.09, 1.7), WOOD_DARK, G)
    mb.box((0, 0.05, 3.2), (0.24, 0.09, 0.38), BLACK, G, top=SNOW)
    for k in range(3):
        mb.box((-0.09 + k * 0.09, 0.11, 2.0), (0.012, 0.012, 2.2), CHROME, G)
    A = P @ T(0.75, -0.1, 0)
    mb.box((0, 0, 0.4), (1.0, 0.65, 0.8), BLACK, A, top=BLACK)
    mb.box((0, 0.33, 0.4), (0.86, 0.02, 0.66), (0.18, 0.18, 0.2), A)
    mb.box((0, 0, 1.03), (1.0, 0.55, 0.46), BLACK, A, top=SNOW)
    mb.box((0, 0.28, 1.1), (0.86, 0.02, 0.12), GOLD, A)
    for nx, nz in ((-0.2, 1.9), (0.35, 2.35)):
        BULBS.sphere((nx, 0, nz), 0.13, GOLD, seg=8, rings=4, M=A, mat=MAT_BULB)
        glow_box((nx + 0.11, 0, nz + 0.3), (0.04, 0.04, 0.6), GOLD, A)
        glow_box((nx + 0.2, 0, nz + 0.56), (0.2, 0.04, 0.07), GOLD, A)


def prop_dance(mb, glow, P):
    cols = [PINK, TEAL, GOLD, PURPLE]
    for ix in range(4):
        for iy in range(3):
            glow_box((-0.95 + ix * 0.63, -0.6 + iy * 0.63, 0.04), (0.58, 0.58, 0.06), cols[(ix + iy * 2) % 4], P)
    mb.box((0, 0, 0.0), (2.7, 2.1, 0.06), BLACK, P)
    mb.box((1.55, -0.6, 1.6), (0.12, 0.12, 3.2), IRON, P, top=SNOW)
    mb.box((0.8, -0.6, 3.15), (1.6, 0.1, 0.1), IRON, P, top=SNOW)
    mb.box((0.15, -0.6, 2.9), (0.02, 0.02, 0.5), IRON, P)
    BULBS.sphere((0.15, -0.6, 2.35), 0.38, CHROME, seg=12, rings=8, M=P, mat=MAT_BULB,
                 cols=lambda i, k: (0.95, 0.97, 1.0) if (i + k) % 2 else (0.55, 0.62, 0.8))


def prop_theatre(mb, glow, P):
    mb.box((0, 0, 0.22), (2.8, 1.6, 0.44), WOOD_DARK, P, top=(0.32, 0.2, 0.14))
    for sx in (-1, 1):
        mb.box((sx * 1.35, -0.6, 1.5), (0.14, 0.14, 2.6), (0.35, 0.22, 0.12), P)
        for k in range(5):
            x = sx * (1.25 - k * 0.12)
            mb.box((x, -0.45 + (k % 2) * 0.05, 1.5), (0.13, 0.08, 2.1 - k * 0.12), shade(RED, 1.0 - k * 0.06), P)
    mb.box((0, -0.55, 2.75), (2.9, 0.2, 0.42), RED, P)
    mb.box((0, -0.43, 2.75), (2.9, 0.02, 0.06), GOLD, P)
    mb.box((0, -0.55, 3.0), (3.0, 0.28, 0.1), SNOW, P)
    for mx, col in ((-0.35, GOLD), (0.35, CANVAS_W)):
        mb.sphere((mx, -0.38, 3.35), 0.28, col, seg=10, rings=6, M=P, squash=1.2)
        mb.box((mx - 0.09, -0.12, 3.42), (0.07, 0.04, 0.05), BLACK, P)
        mb.box((mx + 0.09, -0.12, 3.42), (0.07, 0.04, 0.05), BLACK, P)
        mb.box((mx, -0.12, 3.2), (0.16, 0.04, 0.04), BLACK, P)
    glow.box((0, 0.7, 0.6), (0.3, 0.3, 0.3), (1, 0.8, 0.5), P, mat=MAT_LAMP)


def prop_quiz(mb, glow, P):
    mb.box((0, 0, 0.25), (1.2, 0.8, 0.5), STONE, P, top=SNOW)
    Q = P @ T(0, 0, 0.5)
    rad, cz = 0.62, 2.55
    for k in range(14):
        a = math.pi * 1.05 - k * (math.pi * 1.55 / 13)
        glow_box((math.cos(a) * rad, 0, cz + math.sin(a) * rad), (0.3, 0.3, 0.3), GOLD, Q, Ry(-a))
    glow_box((0.0, 0, 1.6), (0.3, 0.3, 0.55), GOLD, Q)
    glow_box((0.0, 0, 0.75), (0.34, 0.34, 0.34), GOLD, Q)
    B = P @ T(1.35, 0.3, 0)
    mb.box((0, 0, 0.5), (0.7, 0.55, 1.0), (0.14, 0.24, 0.45), B, top=WOOD_DARK)
    BULBS.sphere((0, 0, 1.0), 0.2, (1.0, 0.25, 0.2), seg=10, rings=6, M=B, mat=MAT_BULB, top_only=True)


def prop_literary(mb, glow, P):
    covers = [(0.18, 0.3, 0.55), RED, (0.15, 0.4, 0.3), GOLD, PURPLE]
    z = 0.0
    for k, c in enumerate(covers):
        hgt = 0.28
        R = Rz(rng.uniform(-0.25, 0.25))
        mb.box((-0.5, 0, z + hgt / 2), (1.5 - k * 0.08, 1.05 - k * 0.04, hgt), c, P, R, top=c if k < 4 else SNOW)
        mb.box((-0.5, 0, z + hgt / 2), (1.42 - k * 0.08, 1.08 - k * 0.04, hgt - 0.07), CANVAS_W, P, R)
        z += hgt
    I = P @ T(0.95, 0.2, 0)
    mb.prism((0, 0, 0.3), 0.32, 0.6, 10, BLACK, I, cap=(0.03, 0.03, 0.05))
    F = I @ T(0, 0, 0.55) @ Matrix.Rotation(-0.35, 4, "Y") @ Matrix.Rotation(0.15, 4, "X")
    mb.box((0, 0, 0.9), (0.04, 0.04, 1.8), (0.85, 0.8, 0.7), F)
    mb.sphere((0, 0, 1.45), 0.5, CANVAS_W, seg=8, rings=6, M=F @ Matrix.Diagonal((0.42, 0.08, 1.6, 1)))


def prop_speaking(mb, glow, P):
    M2 = P @ T(-0.4, 0.2, 0) @ Matrix.Rotation(0.12, 4, "X")
    mb.prism((0, 0, 0.06), 0.45, 0.12, 14, BLACK, M2)
    mb.box((0, 0, 1.25), (0.08, 0.08, 2.3), CHROME, M2)
    mb.prism((0, 0, 2.35), 0.2, 0.12, 12, BLACK, M2, Rx(math.pi / 2))
    mb.sphere((0, 0, 2.75), 0.36, CHROME, seg=12, rings=8, M=M2, squash=1.25,
              cols=lambda i, k: CHROME if (i + k) % 2 else (0.45, 0.48, 0.55))
    mb.prism((0, 0, 2.72), 0.38, 0.1, 14, GOLD, M2)
    mb.box((0, 0, 3.22), (0.3, 0.3, 0.06), SNOW, M2)
    L = P @ T(1.2, -0.1, 0)
    mb.box((0, 0, 0.55), (0.8, 0.6, 1.1), WOODS[1], L)
    mb.box((0, 0.31, 0.6), (0.6, 0.02, 0.6), CORAL, L)
    mb.box((0, -0.05, 1.18), (0.95, 0.75, 0.08), WOOD_DARK, L, Rx(-0.25), top=SNOW)


def prop_comedy(mb, glow, P):
    W = P @ T(0, -0.7, 0)
    rows = 9
    for r in range(rows):
        off = 0.0 if r % 2 == 0 else 0.15
        for c in range(9):
            x = -1.25 + off + c * 0.3
            if x > 1.3:
                continue
            mb.box((x, 0, 0.13 + r * 0.26), (0.28, 0.22, 0.24), rng.choice(BRICK), W)
    mb.box((0, 0, 2.42), (2.7, 0.3, 0.1), SNOW, W)
    cx, cz = 0.0, 1.45
    for k in range(18):
        a = k / 18 * math.tau
        BULBS.sphere((cx + math.cos(a) * 0.55, 0.16, cz + math.sin(a) * 0.55), 0.05, PINK, seg=6, rings=3, M=W, mat=MAT_BULB)
    for ex in (-0.2, 0.2):
        BULBS.sphere((ex, 0.16, cz + 0.18), 0.07, PINK, seg=6, rings=3, M=W, mat=MAT_BULB)
    for k in range(7):
        a = math.pi * 1.15 + k * (math.pi * 0.7 / 6)
        BULBS.sphere((math.cos(a) * 0.32, 0.16, cz + math.sin(a) * 0.32), 0.05, PINK, seg=6, rings=3, M=W, mat=MAT_BULB)
    S = P @ T(0.45, 0.3, 0)
    mb.prism((0, 0, 0.8), 0.25, 0.08, 10, RED, S)
    for k in range(3):
        a = k / 3 * math.tau
        mb.box((math.cos(a) * 0.15, math.sin(a) * 0.15, 0.38), (0.04, 0.04, 0.76), CHROME, S)
    K = P @ T(-0.5, 0.35, 0)
    mb.prism((0, 0, 0.04), 0.2, 0.08, 10, BLACK, K)
    mb.box((0, 0, 0.75), (0.04, 0.04, 1.45), CHROME, K)
    mb.sphere((0, 0.04, 1.55), 0.09, (0.25, 0.25, 0.3), seg=8, rings=5, M=K)


def prop_fine_arts(mb, glow, P):
    E = P @ T(-0.3, 0, 0)
    for lx, tilt in ((-0.45, 0.18), (0.45, -0.18)):
        mb.box((lx, 0.15, 1.1), (0.08, 0.08, 2.3), WOODS[3], E, Ry(tilt) @ Rx(-0.12))
    mb.box((0, -0.35, 1.0), (0.08, 0.08, 2.1), WOODS[3], E, Rx(0.3))
    mb.box((0, 0.22, 0.85), (1.1, 0.12, 0.06), WOODS[3], E)
    C = E @ T(0, 0.26, 1.45) @ Matrix.Rotation(-0.12, 4, "X")
    mb.box((0, 0, 0), (1.35, 0.05, 1.05), CANVAS_W, C, top=SNOW)
    strokes = [((-0.3, 0.2), (0.6, 0.18), SKY), ((0.1, -0.05), (0.9, 0.14), CORAL), ((-0.15, -0.28), (0.7, 0.12), GOLD),
               ((0.35, 0.28), (0.3, 0.3), TEAL), ((-0.4, -0.05), (0.25, 0.25), PURPLE)]
    for (sx, sz), (ww, hh), col in strokes:
        mb.box((sx, 0.03, sz), (ww, 0.02, hh), col, C, Ry(rng.uniform(-0.3, 0.3)))
    B = P @ T(1.15, 0.1, 0) @ Matrix.Rotation(0.32, 4, "Y")
    mb.prism((0, 0, 1.05), 0.07, 2.1, 8, (0.85, 0.3, 0.2), B)
    mb.prism((0, 0, 2.2), 0.1, 0.25, 8, CHROME, B)
    mb.sphere((0, 0, 2.55), 0.16, CORAL, seg=8, rings=5, M=B, squash=2.0)
    for k, col in enumerate((CORAL, SKY, GOLD, TEAL, PINK)):
        a = k * 1.3
        mb.prism((math.cos(a) * 0.9 - 0.2, math.sin(a) * 0.6 + 0.2, 0.02), rng.uniform(0.15, 0.32), 0.03, 10, col, P)


def prop_digital(mb, glow, P):
    D = P @ T(-0.2, 0, 0)
    mb.prism((0, 0, 0.05), 0.5, 0.1, 12, BLACK, D)
    mb.box((0, 0, 0.75), (0.14, 0.14, 1.3), (0.2, 0.2, 0.24), D)
    mb.box((0, -0.02, 1.85), (2.2, 0.14, 1.4), BLACK, D, top=SNOW)
    art = [
        "....s...",
        "...sws..",
        "..swwws.",
        ".sbbbbbs",
        "sbbbbbbb",
    ]
    pal = {"s": (0.9, 0.95, 1.0), "w": (0.75, 0.88, 1.0), "b": (0.22, 0.42, 0.85), ".": (0.08, 0.14, 0.38)}
    for r, row in enumerate(art):
        for c, ch in enumerate(row):
            glow_box((-0.875 + c * 0.25, 0.06, 2.35 - r * 0.25), (0.23, 0.02, 0.23), pal[ch], D)
    glow_box((0.68, 0.07, 2.35), (0.23, 0.02, 0.23), CORAL, D)
    mb.sphere((1.35, 0.35, 0.95), 0.42, TEAL, seg=5, rings=3, M=P)
    mb.box((1.35, 0.35, 0.3), (0.3, 0.3, 0.6), STONE, P, top=SNOW)


def prop_photo(mb, glow, P):
    C = P @ T(-0.1, 0, 0)
    for k in range(3):
        a = k / 3 * math.tau + 0.4
        mb.box((math.cos(a) * 0.35, math.sin(a) * 0.35, 0.8), (0.06, 0.06, 1.75), BLACK, C,
               Rz(a) @ Ry(0.22))
    mb.box((0, 0, 1.7), (0.3, 0.3, 0.15), BLACK, C)
    mb.box((0, 0, 2.15), (1.1, 0.6, 0.7), BLACK, C, top=CHROME)
    mb.box((0, 0, 2.53), (1.1, 0.6, 0.06), CHROME, C)
    mb.box((-0.3, 0, 2.62), (0.3, 0.35, 0.18), BLACK, C)
    mb.prism((0.15, 0.45, 2.12), 0.3, 0.35, 14, BLACK, C, Rx(-math.pi / 2), cap=(0.12, 0.16, 0.3))
    mb.prism((0.15, 0.62, 2.12), 0.32, 0.06, 14, CHROME, C, Rx(-math.pi / 2))
    glow.box((0.38, 0.0, 2.7), (0.28, 0.2, 0.14), (1, 0.95, 0.9), C, mat=MAT_LAMP)
    mb.box((-0.38, 0.31, 2.62), (0.14, 0.02, 0.08), RED, C)


def prop_film(mb, glow, P):
    F = P @ T(-0.3, 0, 0)
    mb.box((0, 0, 0.45), (0.8, 0.6, 0.9), STONE, F, top=SNOW)
    mb.box((0, 0, 1.25), (1.1, 0.55, 0.7), BLACK, F)
    mb.prism((0, 0.4, 1.25), 0.2, 0.3, 12, BLACK, F, Rx(-math.pi / 2), cap=(0.15, 0.2, 0.4))
    for rx in (-0.35, 0.35):
        mb.prism((rx, 0, 2.05), 0.45, 0.1, 16, (0.22, 0.22, 0.26), F, Rx(-math.pi / 2), cap=(0.4, 0.42, 0.48))
        for k in range(5):
            a = k / 5 * math.tau
            mb.prism((rx + math.cos(a) * 0.22, 0.06, 2.05 + math.sin(a) * 0.22), 0.09, 0.02, 8, BLACK, F, Rx(-math.pi / 2))
    K = P @ T(1.1, 0.3, 0) @ Matrix.Rotation(-0.2, 4, "Y")
    mb.box((0, 0, 0.55), (1.0, 0.08, 0.8), BLACK, K)
    mb.box((0, 0.045, 0.45), (0.8, 0.01, 0.04), CANVAS_W, K)
    mb.box((0, 0.045, 0.6), (0.8, 0.01, 0.04), CANVAS_W, K)
    stick = K @ T(-0.5, 0, 0.98) @ Matrix.Rotation(0.35, 4, "Y")
    for k in range(5):
        mb.box((0.1 + k * 0.2, 0, 0.0), (0.2, 0.09, 0.16), CANVAS_W if k % 2 else BLACK, stick)
    for k in range(5):
        mb.box((-0.4 + k * 0.2, 0, 0.98), (0.2, 0.09, 0.16), CANVAS_W if k % 2 == 0 else BLACK, K)


def prop_fashion(mb, glow, P):
    mb.box((0, 0.9, 0.02), (1.0, 3.2, 0.04), RED, P)
    for sx in (-1, 1):
        for k in range(8):
            BULBS.sphere((sx * 0.6, -0.6 + k * 0.42, 0.08), 0.06, (1.0, 0.86, 0.58), seg=6, rings=3, M=P, mat=MAT_BULB)
    for dx, col in ((-1.2, PINK), (1.2, GOLD)):
        D = P @ T(dx, -0.1, 0)
        mb.prism((0, 0, 0.04), 0.3, 0.08, 10, BLACK, D)
        mb.box((0, 0, 0.6), (0.05, 0.05, 1.1), CHROME, D)
        mb.tier_cone((0, 0, 0.75), 0.55, 1.1, 12, col, shade(col, 0.85), 0.75, D, 0.05)
        mb.sphere((0, 0, 1.65), 0.32, shade(col, 0.9), seg=10, rings=6, M=D @ Matrix.Diagonal((1, 0.75, 1.3, 1)))
        mb.box((0, 0, 2.62), (0.12, 0.12, 0.18), (0.85, 0.75, 0.62), D)
        mb.box((0, 0, 2.74), (0.3, 0.3, 0.06), SNOW, D)


def prop_culinary(mb, glow, P):
    K = P @ T(-0.5, 0.1, 0)
    for k in range(3):
        a = k / 3 * math.tau
        mb.box((math.cos(a) * 0.6, math.sin(a) * 0.6, 0.55), (0.06, 0.06, 1.2), IRON, K, Rz(a) @ Ry(-0.3))
    for k in range(6):
        a = k / 6 * math.tau
        mb.prism((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.15), 0.06, 0.6, 6, BARK, K, Rz(a) @ Ry(math.pi / 2), cap=(0.6, 0.42, 0.28))
    glow.box((0, 0, 0.35), (0.35, 0.35, 0.4), (1, 0.6, 0.3), K, mat=MAT_LAMP)
    mb.prism((0, 0, 0.95), 0.55, 0.7, 14, (0.12, 0.12, 0.14), K, cap=(0.85, 0.72, 0.45))
    mb.prism((0, 0, 1.32), 0.6, 0.06, 14, (0.25, 0.25, 0.28), K)
    mb.box((0.35, 0, 1.6), (0.06, 0.06, 1.0), WOODS[3], K, Ry(0.5))
    empty(f"Chimney_{len(CHIMNEYS):02d}", K @ Vector((0, 0, 1.45)), 0.3)
    CHIMNEYS.append("pot")
    H = P @ T(1.1, -0.1, 0)
    mb.box((0, 0, 0.5), (0.7, 0.7, 1.0), STONE, H, top=SNOW)
    mb.prism((0, 0, 1.3), 0.38, 0.55, 14, CANVAS_W, H)
    for k in range(5):
        a = k / 5 * math.tau
        mb.sphere((math.cos(a) * 0.28, math.sin(a) * 0.28, 1.75), 0.28, CANVAS_W, seg=8, rings=5, M=H)
    mb.sphere((0, 0, 1.9), 0.32, CANVAS_W, seg=8, rings=5, M=H)


CUP_PROPS = [prop_music, prop_dance, prop_theatre, prop_quiz, prop_literary, prop_speaking, prop_comedy,
             prop_fine_arts, prop_digital, prop_photo, prop_film, prop_fashion, prop_culinary]


def cup_props(i, mb, glow, M, w, d, side):
    # props sit in the front yard at the far end from the sign; two cups would hit a lamp post,
    # so theirs move into the gap beyond the cabin
    along = {4: 4.6, 11: 4.7}.get(i, 0.27 * w)
    P = M @ T(-side * along, d / 2 + 1.75, 0) @ Matrix.Scale(1.75, 4)
    # warm uplight so each set-piece reads at night
    glow.box((0, 1.25, 0.08), (0.5, 0.18, 0.12), (1, 0.8, 0.5), P, mat=MAT_LAMP)
    CUP_PROPS[i](mb, glow, P)


def build_cup_cabins():
    positions = []
    for i in range(13):
        side = -1 if i % 2 == 0 else 1
        y = CUP_Y0 - i * CUP_STEP
        x = side * CUP_X
        w, d, h, r = 7.2 + rng.uniform(-0.4, 0.6), 6.4 + rng.uniform(-0.3, 0.4), rng.choice([3.8, 4.4, 4.6]), 3.2 + rng.uniform(-0.2, 0.5)
        z = ground_z(x, y, d, w)
        # front (+Y local) must face the street: left side -> +X, right side -> -X
        rot = Matrix.Rotation(side * math.pi / 2, 4, "Z")
        M = Matrix.Translation((x, y, z)) @ rot
        mb, win, glow = MB(), MB((MAT_WINDOW,)), MB((MAT_LAMP,))
        cabin(mb, win, glow, M, w, d, h, r, WOODS[i % len(WOODS)], ACCENTS[i % len(ACCENTS)],
              chimney_name=f"Chimney_{len(CHIMNEYS):02d}", woodpile=i % 3 == 0)
        CHIMNEYS.append(i)
        # projecting sign bracket facing the approaching camera (+Y world)
        front_x = x - side * (d / 2)
        sign_y = y + w * 0.32
        x_in, x_out = front_x - side * 0.4, front_x - side * 3.7
        cxs = (x_in + x_out) / 2
        mb.box((front_x - side * 2.1, sign_y, 4.55), (4.4, 0.14, 0.14), IRON, top=SNOW)
        mb.box((cxs, sign_y - 0.06, 3.65), (abs(x_out - x_in) + 0.2, 0.12, 1.25), WOOD_DARK, top=SNOW)
        mb.box((cxs, sign_y - 0.06, 4.33), (abs(x_out - x_in) + 0.35, 0.3, 0.12), SNOW)
        for xs in (x_in + (-side) * 0.3, x_out + side * 0.3):
            mb.box((xs, sign_y, 4.42), (0.05, 0.05, 0.3), IRON)
        for k in range(int(abs(x_out - x_in) / 0.3)):
            mb.icicle((min(x_in, x_out) + 0.2 + k * 0.3, sign_y - 0.06, 3.02), rng.uniform(0.1, 0.35), 0.035)
        cup_props(i, mb, glow, M, w, d, side)
        name = f"{i + 1:02d}"
        ob = mb.build(f"Cup_{name}")
        ob["cup"] = i + 1
        win.build(f"CupWin_{name}")
        GLOWS.append(glow)
        # sign face with UVs (viewer looks toward -Y; viewer's right is -X)
        s = MB((MAT_SIGN,), jit=0)
        xl, xr = max(x_in, x_out), min(x_in, x_out)
        yy = sign_y + 0.005
        z0, z1 = 3.1, 4.2
        s.face([(xl, yy, z0), (xr, yy, z0), (xr, yy, z1), (xl, yy, z1)], (0.35, 0.22, 0.13), MAT_SIGN,
               uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
        s.build(f"Sign_{name}")
        positions.append((x, y))
    return positions


GLOWS = []


def build_village_cabins(occupied):
    mb, win, glow = MB(), MB((MAT_WINDOW,)), MB((MAT_LAMP,))
    spots = []
    for i in range(7):
        for side in (-1, 1):
            y = CUP_Y0 + 4 - i * 15 + rng.uniform(-2, 2)
            x = side * rng.uniform(23, 27)
            spots.append((x, y, side * math.pi / 2 + rng.uniform(-0.25, 0.25)))
    for _ in range(18):
        side = rng.choice((-1, 1))
        spots.append((side * rng.uniform(34, 60), rng.uniform(-75, 75), side * math.pi / 2 + rng.uniform(-0.5, 0.5)))
    for a in (-0.6, 0.6, 2.4, -2.4):
        p = SQUARE + Vector((math.sin(a) * 22, math.cos(a) * 22, 0))
        if a in (2.4, -2.4):
            p = SQUARE + Vector((math.sin(a) * 24, math.cos(a) * 20, 0))
        to_c = SQUARE - p
        spots.append((p.x, p.y, math.atan2(-to_c.x, to_c.y)))
    placed = []
    for x, y, rz in spots:
        if any((Vector((x, y)) - Vector(o)).length < 11 for o in occupied + placed):
            continue
        if (Vector((x, y, 0)) - SQUARE).length < SQUARE_R + 5 or abs(x) < 9 or near_river(x, y, 9):
            continue
        w, d, h, r = rng.uniform(6, 8.5), rng.uniform(5.5, 7.5), rng.choice([3.6, 4.2, 4.6]), rng.uniform(2.8, 3.8)
        z = ground_z(x, y, w, d)
        M = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, "Z")
        cname = f"Chimney_{len(CHIMNEYS):02d}" if rng.random() < 0.55 else None
        if cname:
            CHIMNEYS.append(cname)
        cabin(mb, win, glow, M, w, d, h, r, rng.choice(WOODS), rng.choice(ACCENTS), chimney_name=cname,
              balcony=h >= 4.2 and rng.random() < 0.6, woodpile=rng.random() < 0.5)
        placed.append((x, y))
    mb.build("Village")
    win.build("VillageWindows")
    GLOWS.append(glow)
    return placed


# ---------------------------------------------------------------- gate (IIT Mandi arch homage) + railing
def build_gate():
    mb, lamps = MB(), MB((MAT_LAMP,))
    y = GATE_Y
    pw, ph, depth = 2.6, 9.0, 2.6
    for sx in (-1, 1):
        x = sx * 5.6
        # coursed stone: alternating block bands
        for k in range(10):
            col = STONE if k % 2 == 0 else shade(STONE, 0.88)
            mb.box((x, y, -0.5 + k * 0.95 + 0.475), (pw, depth, 0.95), col)
        mb.box((x, y, ph + 0.05), (pw + 0.3, depth + 0.3, 0.3), SNOW)
        for z in (2.2, 5.0):
            mb.box((x, y, z), (pw + 0.12, depth + 0.12, 0.25), STONE_DARK)
        mb.mound((x, y + depth / 2 + 0.2, 0), pw * 0.6, 0.8, 0.6)
    mb.box((0, y, ph + 1.3), (14.0, depth + 0.2, 2.6), STONE, top=SNOW)
    mb.box((0, y, ph + 0.1), (14.2, depth + 0.4, 0.3), STONE_DARK)
    rad, cz = 4.3, ph - 4.3
    steps = 26
    for k in range(steps):
        x0 = -rad + k * (2 * rad / steps)
        x1 = x0 + 2 * rad / steps
        xm = (x0 + x1) / 2
        za = cz + math.sqrt(max(0.0, rad * rad - xm * xm))
        hgt = ph - za + 0.05
        if hgt > 0.02:
            mb.box((xm, y, za + hgt / 2), (x1 - x0 + 0.02, depth - 0.2, hgt), STONE)
        # voussoir ring
        mb.box((xm, y + depth / 2 - 0.05, za + 0.2), (x1 - x0 + 0.02, 0.15, 0.4), STONE_DARK)
        if 0.3 < hgt and k % 2 == 0:
            mb.icicle((xm, y + depth / 2 - 0.2, za), rng.uniform(0.2, 0.7), 0.05)
    for k in range(7):
        x = -6.3 + k * 2.1
        mb.box((x, y, ph + 3.0), (1.1, depth, 0.9), STONE, top=SNOW)
        mb.box((x, y, ph + 3.5), (1.2, depth + 0.1, 0.18), SNOW)
    # hanging banners on the pillars
    for sx in (-1, 1):
        mb.box((sx * 5.6, y + depth / 2 + 0.06, 4.2), (1.3, 0.05, 3.2), CORAL)
        mb.box((sx * 5.6, y + depth / 2 + 0.1, 5.85), (1.6, 0.1, 0.1), IRON)
        lamps.box((sx * 5.6, y + depth / 2 + 0.3, 6.6), (0.5, 0.5, 0.7), (1, 0.8, 0.5), mat=MAT_LAMP)
        empty(f"Lamp_G{0 if sx < 0 else 1}", (sx * 5.6, y + depth / 2 + 0.6, 6.6))
    # bridge-style railing receding from the gate (the logo's railway bridge)
    for sx in (-1, 1):
        x = sx * 4.6
        yy = y + 3.0
        while yy < y + 70:
            z = terrain_h(x, yy)
            mb.box((x, yy, z + 0.8), (0.28, 0.28, 1.6), WOOD_DARK, top=SNOW)
            yy += 2.6
        mb.box((x, y + 36.5, terrain_h(x, y + 36) + 1.45), (0.18, 67.0, 0.18), WOOD_DARK, top=SNOW)
        mb.box((x, y + 36.5, terrain_h(x, y + 36) + 0.85), (0.14, 67.0, 0.14), WOOD_DARK)
        mb.box((sx * 4.0, y + 36.5, 0.1), (1.0, 66.0, 0.5), SNOW)
    mb.build("Gate")
    lamps.build("GateLamps")
    s = MB((MAT_SIGN,), jit=0)
    yy = y + depth / 2 + 0.12
    z0, z1 = ph + 0.35, ph + 2.45
    s.face([(5.4, yy, z0), (-5.4, yy, z0), (-5.4, yy, z1), (5.4, yy, z1)], (0.35, 0.22, 0.13), MAT_SIGN,
           uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    s.build("GateSign")


# ---------------------------------------------------------------- street lamps, snowbanks, string lights
def catenary(bulbs, mb, a, b, sag, step=0.55):
    a, b = Vector(a), Vector(b)
    n = max(2, int((b - a).length / step))
    prev = None
    for k in range(n + 1):
        t = k / n
        p = a.lerp(b, t) - Vector((0, 0, sag * 4 * t * (1 - t)))
        if prev is not None:
            mid = (p + prev) / 2
            dv = p - prev
            R = dv.to_track_quat("X", "Z").to_matrix()
            mb.box(mid, (dv.length, 0.025, 0.025), IRON, R=R)
        if 0 < k < n:
            bulbs.sphere(p - Vector((0, 0, 0.09)), 0.075, BULB_COLS[k % len(BULB_COLS)], seg=8, rings=4, mat=MAT_BULB)
        prev = p


def build_lamps():
    mb, glow, bulbs = MB(), MB((MAT_LAMP,)), BULBS
    k = 0
    y = GATE_Y - 9
    while y > SQUARE.y + SQUARE_R:
        for sx in (-1, 1):
            x = sx * 5.2
            mb.box((x, y, 0.25), (0.5, 0.5, 0.5), STONE_DARK, top=SNOW)
            mb.box((x, y, 1.8), (0.18, 0.18, 3.6), IRON)
            mb.box((x, y, 3.0), (0.26, 0.26, 0.12), IRON)
            mb.box((x - sx * 0.35, y, 3.6), (0.8, 0.12, 0.12), IRON, top=SNOW)
            glow.box((x - sx * 0.7, y, 3.25), (0.42, 0.42, 0.55), (1, 0.8, 0.5), mat=MAT_LAMP)
            mb.box((x - sx * 0.7, y, 3.6), (0.6, 0.6, 0.12), IRON, top=SNOW)
            mb.box((x - sx * 0.7, y, 3.72), (0.55, 0.55, 0.14), SNOW)
            # finial that carries the festoon above the camera path
            mb.box((x, y, 4.3), (0.1, 0.1, 1.2), IRON)
            mb.box((x, y, 4.92), (0.2, 0.2, 0.08), IRON, top=SNOW)
            for cx in (-0.21, 0.21):
                mb.box((x - sx * 0.7 + cx, y, 3.25), (0.04, 0.46, 0.57), IRON)
            mb.mound((x, y, 0), 0.9, 0.9, 0.35)
            empty(f"Lamp_{k:02d}", (x - sx * 0.7, y, 3.15))
            k += 1
        # festoon across the street
        catenary(bulbs, mb, (-5.2, y, 4.85), (5.2, y, 4.85), 0.45)
        # snowbanks between lamps
        for sx in (-1, 1):
            mb.mound((sx * 4.2, y - 7, 0), 0.8, 4.5, 0.55)
        y -= 14
    mb.build("StreetLamps")
    glow.build("LampGlow")
    return bulbs


# ---------------------------------------------------------------- square: bonfire, tree, kiosks, stage, snowmen
def snowman(mb, base, s=1.0):
    b = Vector(base)
    mb.sphere(b + Vector((0, 0, 0.75 * s)), 0.85 * s, SNOW)
    mb.sphere(b + Vector((0, 0, 1.9 * s)), 0.6 * s, SNOW)
    mb.sphere(b + Vector((0, 0, 2.75 * s)), 0.42 * s, SNOW)
    mb.box(b + Vector((0, 0.5 * s, 2.75 * s)), (0.1 * s, 0.5 * s, 0.1 * s), CARROT)
    mb.box(b + Vector((0, 0, 3.25 * s)), (0.6 * s, 0.6 * s, 0.5 * s), IRON)
    mb.box(b + Vector((0, 0, 3.0 * s)), (0.9 * s, 0.9 * s, 0.06 * s), IRON)
    mb.box(b + Vector((0, 0.05 * s, 2.25 * s)), (0.75 * s, 0.75 * s, 0.14 * s), CORAL)
    for e in (-0.14, 0.14):
        mb.box(b + Vector((e * s, 0.38 * s, 2.88 * s)), (0.07 * s, 0.07 * s, 0.07 * s), IRON)


def kiosk(mb, glow, M):
    mb.box((0, 0, 0.55), (2.8, 1.4, 1.1), WOODS[1], M, top=WOOD_DARK)
    mb.box((0, 0.72, 0.6), (2.9, 0.06, 0.9), CORAL, M)
    for sx in (-1, 1):
        for sy in (-1, 1):
            mb.box((sx * 1.35, sy * 0.65, 1.3), (0.12, 0.12, 2.6), WOOD_DARK, M)
    mb.box((0, -0.68, 1.75), (2.8, 0.08, 1.5), WOODS[0], M)
    for k in range(8):
        col = CORAL if k % 2 == 0 else CANVAS_W
        Ra = Matrix.Rotation(-0.35, 3, "X")
        mb.box((-1.4 + 0.175 + k * 0.35, 0.25, 2.7), (0.35, 2.0, 0.06), col, M, Ra)
    mb.box((0, 0.1, 2.95), (3.0, 2.0, 0.14), SNOW, M, Matrix.Rotation(-0.35, 3, "X"))
    glow.box((0, 0.55, 2.2), (2.6, 0.1, 0.08), (1, 0.8, 0.5), M, mat=MAT_LAMP)
    for k in range(4):
        mb.box((-0.9 + k * 0.6, 0.3, 1.2), (0.3, 0.3, 0.2), rng.choice([CARROT, CANVAS_W, RIBBON, WOODS[3]]), M)


def build_square(bulbs):
    mb, glow = MB(), MB((MAT_LAMP,))
    c = SQUARE
    # bonfire teepee on a stone ring
    for k in range(9):
        a = k / 9 * math.tau
        R = Matrix.Rotation(a, 3, "Z") @ Matrix.Rotation(0.42, 3, "X")
        mb.prism(c + Vector((math.sin(a) * 0.55, -math.cos(a) * 0.55, 0.9)), 0.14, 2.2, 6, BARK, R=R, cap=(0.62, 0.45, 0.30))
    for k in range(14):
        a = k / 14 * math.tau
        mb.box(c + Vector((math.cos(a) * 1.6, math.sin(a) * 1.6, 0.18)), (0.6, 0.5, 0.36), STONE, top=SNOW_SHADE,
               R=Matrix.Rotation(a, 3, "Z"))
    empty("FireAnchor", c + Vector((0, 0, 0.6)))
    # log benches
    for k in range(6):
        a = k / 6 * math.tau + 0.3
        p = c + Vector((math.cos(a) * 6.0, math.sin(a) * 6.0, 0.32))
        R = Matrix.Rotation(a + math.pi / 2, 3, "Z") @ Matrix.Rotation(math.pi / 2, 3, "Y")
        mb.prism(p, 0.3, 3.0, 8, BARK, R=R, cap=(0.62, 0.45, 0.30))
        mb.box(p + Vector((0, 0, 0.3)), (0.4, 0.4, 0.08), SNOW, R=Matrix.Rotation(a + math.pi / 2, 3, "Z") @ Matrix.Scale(1, 3) @ Matrix.Diagonal((7, 1, 1)))
    # decorated tree
    t = TREE_SPOT
    z0 = terrain_h(t.x, t.y)
    M = Matrix.Translation((t.x, t.y, z0)) @ Matrix.Scale(2.0, 4)
    mb.box((0, 0, 0.6), (0.5, 0.5, 1.4), BARK, M)
    for base, rr, hh in ((1.0, 2.6, 3.2), (2.6, 2.2, 2.9), (4.1, 1.7, 2.6), (5.4, 1.2, 2.3)):
        mb.tier_cone((0, 0, base), rr, hh, 9, PINE, SNOW, 0.6, M, 0.12)
    H, R0 = 7.2 * 2.0, 2.6 * 2.0
    for k in range(120):
        f = k / 120
        a = f * math.tau * 5.5
        rad = R0 * (1 - f) * 0.92 + 0.2
        bulbs.sphere((t.x + math.cos(a) * rad, t.y + math.sin(a) * rad, z0 + 2.2 + f * (H - 3.4)), 0.13,
                     BULB_COLS[k % len(BULB_COLS)], seg=6, rings=3, mat=MAT_BULB)
    star = Vector((t.x, t.y, z0 + H + 0.5))
    for a in (0, math.pi / 4):
        glow.box(star, (1.2, 0.18, 1.2), (1, 0.85, 0.5), R=Matrix.Rotation(a, 3, "Y") @ Matrix.Rotation(math.pi / 4, 3, "Y"), mat=MAT_LAMP)
    # food kiosks facing the fire
    for deg in (20, 148, 172):
        a = math.radians(deg)
        p = c + Vector((math.cos(a) * 9.8, math.sin(a) * 9.8, 0))
        to_c = c - p
        Mk = Matrix.Translation(p) @ Matrix.Rotation(math.atan2(-to_c.x, to_c.y), 4, "Z")
        kiosk(mb, glow, Mk)
    # open-air stage
    sy = STAGE_Y
    mb.box((0, sy, 0.6), (16, 7, 1.2), WOOD_DARK, top=(0.30, 0.20, 0.14))
    for k in range(5):
        mb.box((-6 + k * 3, sy + 3.62, 0.25), (2.2, 0.6, 0.5), WOODS[2], top=SNOW_SHADE)
    mb.box((0, sy + 3.6, 0.65), (16.4, 0.4, 0.2), SNOW)
    for sx in (-1, 1):
        mb.box((sx * 7.6, sy - 2.5, 4.6), (0.5, 0.5, 8.0), IRON)
        mb.box((sx * 7.6, sy + 2.5, 4.6), (0.5, 0.5, 8.0), IRON)
        mb.box((sx * 7.6, sy, 8.4), (0.4, 5.4, 0.4), IRON)
        mb.box((sx * 9.2, sy + 1.0, 1.4), (1.3, 1.1, 2.8), (0.08, 0.08, 0.1), top=SNOW)
        mb.box((sx * 9.2, sy + 1.56, 1.9), (0.8, 0.04, 0.8), (0.18, 0.18, 0.22))
    mb.box((0, sy - 2.5, 8.4), (15.6, 0.5, 0.5), IRON, top=SNOW)
    mb.box((0, sy + 2.5, 8.4), (15.6, 0.5, 0.5), IRON, top=SNOW)
    for k in range(6):
        glow.box((-6.25 + k * 2.5, sy + 2.5, 7.95), (0.35, 0.35, 0.4), (1, 0.8, 0.5), mat=MAT_LAMP)
    mb.box((0, sy - 3.2, 4.6), (15.4, 0.3, 7.4), (0.09, 0.10, 0.16))
    s = MB((MAT_SIGN,), jit=0)
    yy = sy - 3.0
    s.face([(6.8, yy, 1.6), (-6.8, yy, 1.6), (-6.8, yy, 7.4), (6.8, yy, 7.4)], (0.1, 0.1, 0.16), MAT_SIGN,
           uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    s.build("StageScreen")
    empty("StageAnchor", (0, sy, 6))
    snowman(mb, (6.5, c.y + 9.5, 0))
    snowman(mb, (7.5, GATE_Y - 6, terrain_h(7.5, GATE_Y - 6)), 0.8)
    # string-light posts around the square, festooned
    posts = []
    for k in range(8):
        a = k / 8 * math.tau
        p = c + Vector((math.cos(a) * (SQUARE_R - 0.5), math.sin(a) * (SQUARE_R - 0.5), 0))
        if (abs(p.x) < 4 and p.y > c.y) or (p - TREE_SPOT).length < 6:
            posts.append(None)
            continue
        mb.box(p + Vector((0, 0, 3.8)), (0.22, 0.22, 7.6), IRON, top=SNOW)
        glow.box(p + Vector((0, 0, 4.4)), (0.36, 0.36, 0.36), (1, 0.8, 0.5), mat=MAT_LAMP)
        mb.box(p + Vector((0, 0, 4.7)), (0.5, 0.5, 0.1), IRON, top=SNOW)
        empty(f"Lamp_S{k}", p + Vector((0, 0, 4.4)))
        # festoons ride high so the camera passes underneath
        posts.append(p + Vector((0, 0, 7.45)))
    for k in range(8):
        a, b = posts[k], posts[(k + 1) % 8]
        if a is not None and b is not None:
            catenary(bulbs, mb, a, b, 1.0)
    mb.build("Square")
    return glow


# ---------------------------------------------------------------- nature: forest, bare trees, rocks
def build_forest(blocked):
    mb = MB(jit=0.06)
    count = 0
    tries = 0
    while count < 560 and tries < 30000:
        tries += 1
        x = rng.uniform(-155, 155)
        y = rng.uniform(-155, 170)
        if abs(x) < 8.5 or (abs(x) < 16 and rng.random() < 0.7):
            continue
        if (Vector((x, y, 0)) - SQUARE).length < SQUARE_R + 6 or (abs(y - STAGE_Y) < 8 and abs(x) < 12):
            continue
        if abs(y - GATE_Y) < 6 and abs(x) < 12:
            continue
        if near_river(x, y, 5) and -140 < y < 160:
            continue
        if any((Vector((x, y)) - Vector(b)).length < 7.5 for b in blocked):
            continue
        z = terrain_h(x, y)
        if z > 78:
            continue
        s = rng.uniform(0.75, 1.7) * (1.15 if abs(x) > 40 else 1.0)
        M = Matrix.Translation((x, y, z - 0.2)) @ Matrix.Scale(s, 4) @ Matrix.Rotation(rng.random() * 6, 4, "Z")
        mb.box((0, 0, 0.6), (0.4, 0.4, 1.4), BARK, M)
        g = rng.choice((PINE, PINE_2, PINE_3))
        tiers = ((0.9, 2.5, 2.6), (2.2, 2.05, 2.4), (3.4, 1.65, 2.2), (4.5, 1.2, 2.0), (5.5, 0.75, 1.6))
        for base, rr, hh in tiers:
            mb.tier_cone((0, 0, base), rr, hh, 9, g, SNOW, 0.62, M, 0.18)
        if rng.random() < 0.6:
            mb.mound((0, 0, 0.1), 1.6, 1.6, 0.35, SNOW, M)
        count += 1
    # bare deciduous trees near the village
    for _ in range(46):
        side = rng.choice((-1, 1))
        x = side * rng.uniform(9.5, 30)
        y = rng.uniform(-60, 70)
        if any((Vector((x, y)) - Vector(b)).length < 6.5 for b in blocked) or near_river(x, y, 5):
            continue
        z = terrain_h(x, y)
        s = rng.uniform(0.9, 1.4)
        M = Matrix.Translation((x, y, z)) @ Matrix.Scale(s, 4) @ Matrix.Rotation(rng.random() * 6, 4, "Z")
        mb.prism((0, 0, 1.6), 0.18, 3.2, 6, BARK, M)
        for k in range(6):
            a = k / 6 * math.tau + rng.uniform(-0.3, 0.3)
            tilt = rng.uniform(0.5, 0.9)
            R = Matrix.Rotation(a, 3, "Z") @ Matrix.Rotation(tilt, 3, "Y")
            L = rng.uniform(1.2, 2.2)
            base = Vector((0, 0, 2.0 + k * 0.25))
            mid = base + R @ Vector((0, 0, L / 2))
            mb.prism(mid, 0.07, L, 5, BARK, M, R)
            mb.box(mid + Vector((0, 0, 0.08)), (0.12, 0.12, L * 0.8), SNOW, M, R)
    print(f"trees: {count}")
    return mb.build("Forest")


def build_rocks(blocked):
    mb = MB(jit=0.08)
    n = 0
    while n < 90:
        x = rng.uniform(-110, 110)
        y = rng.uniform(-120, 150)
        if abs(x) < 7 or (Vector((x, y, 0)) - SQUARE).length < SQUARE_R + 3:
            continue
        if any((Vector((x, y)) - Vector(b)).length < 6 for b in blocked):
            continue
        z = terrain_h(x, y)
        r = rng.uniform(0.6, 2.4) * (1.6 if near_river(x, y, 6) else 1.0)
        seed = rng.random() * 50
        ctr = Vector((x, y, z + r * 0.15))
        seg, rings = 7, 5
        pts = []
        for i in range(rings + 1):
            t = math.pi * i / rings
            row = []
            for k in range(seg):
                a = math.tau * k / seg
                d = Vector((math.sin(t) * math.cos(a), math.sin(t) * math.sin(a), math.cos(t) * 0.7))
                rr = r * (1 + noise.noise(d * 1.7 + Vector((seed, 0, 0))) * 0.35)
                row.append(ctr + d * rr)
            pts.append(row)
        for i in range(rings):
            for k in range(seg):
                q = (k + 1) % seg
                col = SNOW if i < 2 else (ROCK if (i + k) % 3 else ROCK_DARK)
                mb.face([pts[i][k], pts[i + 1][k], pts[i + 1][q], pts[i][q]], col)
        n += 1
    return mb.build("Rocks")


# ---------------------------------------------------------------- camera rail
CAM_RAIL = [
    ((0, 230, 110), (0, -60, 30)),
    ((0, 175, 62), (0, 20, 8)),
    ((0, 122, 18), (0, 70, 6)),
    ((0, 92, 6.5), (0, 74, 7)),
    ((0, 68, 3.4), (0, 40, 3.0)),
    ((0, 52, 3.2), (0, 25, 3.0)),
    ((0, 22, 3.2), (0, -5, 3.0)),
    ((0, -8, 3.2), (0, -35, 3.0)),
    ((0, -40, 3.6), (0, -66, 2.0)),
    ((4.5, -48, 5.0), (0, -67, 1.5)),
    ((12, -74, 5.5), (0, -66, 1.5)),
    ((-6, -98, 22), (0, -60, 3)),
    ((0, -150, 75), (0, 10, 0)),
]


def build_rail():
    for i, (cam, look) in enumerate(CAM_RAIL):
        empty(f"Cam_{i:02d}", cam, 1.0)
        empty(f"Look_{i:02d}", look, 0.5)


# ---------------------------------------------------------------- build
build_terrain()
build_mountains()
cups = build_cup_cabins()
others = build_village_cabins(cups)
build_gate()
bulbs = build_lamps()
sq_glow = build_square(bulbs)
blocked = cups + others + [(TREE_SPOT.x, TREE_SPOT.y)]
build_forest(blocked)
build_rocks(blocked)
bulbs.build("Bulbs")
glow_all = MB((MAT_LAMP,), jit=0)
for g in GLOWS + [sq_glow]:
    off = len(glow_all.v)
    glow_all.v += g.v
    glow_all.f += [tuple(i + off for i in f) for f in g.f]
    glow_all.fc += g.fc
    glow_all.fm += [glow_all._slot(g.mats[m]) for m in g.fm]
    glow_all.uv += g.uv
glow_all.build("SquareGlow")
build_rail()

# ---------------------------------------------------------------- world (AO distance + preview lighting)
world = bpy.data.worlds.new("Night")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.022, 0.06, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
try:
    world.light_settings.distance = 3.5
except AttributeError:
    pass


# ---------------------------------------------------------------- bake ambient occlusion into vertex colours
def bake_ao():
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.device = "CPU"
    targets = [o for o in scene.objects if o.type == "MESH" and not o.name.startswith(NO_BAKE)]
    for ob in targets:
        me = ob.data
        base = me.color_attributes["Color"]
        ao = me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
        me.color_attributes.active_color = ao
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        try:
            bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
        except Exception as exc:  # keep going without AO on this mesh
            print(f"bake failed on {ob.name}: {exc}")
            me.color_attributes.remove(ao)
            me.color_attributes.active_color = me.color_attributes["Color"]
            continue
        base = me.color_attributes["Color"]
        ao = me.color_attributes["AO"]
        n = len(base.data)
        bc = np.empty(n * 4, dtype=np.float32)
        ac = np.empty(n * 4, dtype=np.float32)
        base.data.foreach_get("color_srgb", bc)
        ao.data.foreach_get("color", ac)
        bc = bc.reshape(n, 4)
        occ = 1.0 - np.clip(ac.reshape(n, 4)[:, 0], 0, 1)
        k = 1.0 - 0.62 * occ
        # occluded areas fall off to a cool blue, like snow in shade
        bc[:, 0] *= k * (1 - 0.25 * occ)
        bc[:, 1] *= k * (1 - 0.12 * occ)
        bc[:, 2] *= k * (1 + 0.05 * occ)
        bc[:, 3] = 1.0
        base.data.foreach_set("color_srgb", np.clip(bc, 0, 1).ravel())
        me.color_attributes.remove(me.color_attributes["AO"])
        me.color_attributes.active_color = me.color_attributes["Color"]
        print(f"baked AO: {ob.name}")


if not SKIP_BAKE:
    bake_ao()

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=False,
    export_apply=True,
    export_extras=True,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_normals=False,
    export_draco_color_quantization=8,
    export_vertex_color="ACTIVE",
)
print(f"exported {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)")

# ---------------------------------------------------------------- preview renders (not exported)
moon = bpy.data.lights.new("Moon", "SUN")
moon.energy = 0.9
moon.color = (0.62, 0.72, 1.0)
moon_ob = bpy.data.objects.new("Moon", moon)
moon_ob.rotation_euler = (math.radians(55), 0, math.radians(200))
scene.collection.objects.link(moon_ob)

fire = bpy.data.lights.new("Fire", "POINT")
fire.energy = 4000
fire.color = (1.0, 0.55, 0.2)
fire_ob = bpy.data.objects.new("Fire", fire)
fire_ob.location = SQUARE + Vector((0, 0, 1.6))
scene.collection.objects.link(fire_ob)

cam_data = bpy.data.cameras.new("Preview")
cam_data.lens = 28
cam_data.clip_end = 2000
cam = bpy.data.objects.new("PreviewCam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES"):
    try:
        scene.render.engine = eng
        break
    except TypeError:
        continue
if scene.render.engine == "CYCLES":
    scene.cycles.samples = 16
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.view_settings.view_transform = "AgX" if "AgX" in [v.identifier for v in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"


def look_at(ob, eye, target):
    ob.location = eye
    d = Vector(target) - Vector(eye)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


if not SKIP_RENDER:
    for i in range(13):
        side = -1 if i % 2 == 0 else 1
        y = CUP_Y0 - i * CUP_STEP
        eye = (0.0, y + 11.0, 3.3)
        look_at(cam, eye, (side * 6.8, y - 2.0, 2.0))
        scene.render.filepath = os.path.join(HERE, "huts", f"hut_{i + 1:02d}.png")
        scene.render.resolution_x, scene.render.resolution_y = 640, 400
        bpy.ops.render.render(write_still=True)
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    for idx in (0, 3, 5, 9, 12):
        cam_pos, look = CAM_RAIL[idx]
        look_at(cam, cam_pos, look)
        scene.render.filepath = os.path.join(HERE, f"preview_{idx:02d}.png")
        try:
            bpy.ops.render.render(write_still=True)
            print(f"rendered preview_{idx:02d}.png")
        except Exception as exc:
            print(f"render failed: {exc}")
            break

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "village.blend"))
print("done")
