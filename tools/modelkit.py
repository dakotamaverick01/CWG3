#!/usr/bin/env python3
"""CWG3 model kit: build low-poly 3D models from code and save them as standard .glb files.

Why: free 3D packs have almost no 1860s American buildings, and hand-modelling in Blender is slow to iterate.
A model written as code is easy to tweak by changing numbers, always matches the house style, and costs nothing.

Conventions (every generated model):
  - metres, Y up, base on y = 0, centred on x/z = 0
  - the FRONT (door, porch, facade) faces +Z, which the game turns toward the road or the viewer
  - every part has a MATERIAL NAME (e.g. 'clapboard', 'roofShingle'); colours come from assets/models/palette.json at bake
    time, so one palette edit recolours every model
  - flat shaded: each triangle gets its own normal, pointing away from the part's centre
The .glb files open in Blender, Windows 3D Viewer, https://gltf-viewer.donmccurdy.com, etc.
"""
import json, math, struct
import numpy as np


class Model:
    def __init__(self, name):
        self.name = name
        self.tris = {}          # material -> list of (a, b, c) vertex triples
        self.stack = [np.eye(4)]

    # ---------- transforms (apply to everything added inside the `with`) ----------
    class _Push:
        def __init__(self, m, mat): self.m, self.mat = m, mat
        def __enter__(self): self.m.stack.append(self.m.stack[-1] @ self.mat)
        def __exit__(self, *a): self.m.stack.pop()

    def at(self, x=0.0, y=0.0, z=0.0, ry=0.0, rz=0.0, s=1.0):
        """translate, then rotate about Y (degrees, counter-clockwise seen from above), then about Z, then scale"""
        t = np.eye(4); t[:3, 3] = (x, y, z)
        a = math.radians(ry); r = np.eye(4); r[0, 0], r[0, 2], r[2, 0], r[2, 2] = math.cos(a), math.sin(a), -math.sin(a), math.cos(a)
        b = math.radians(rz); q = np.eye(4); q[0, 0], q[0, 1], q[1, 0], q[1, 1] = math.cos(b), -math.sin(b), math.sin(b), math.cos(b)
        sc = np.diag([s, s, s, 1.0])
        return Model._Push(self, t @ r @ q @ sc)

    def _xf(self, p):
        m = self.stack[-1]; return tuple((m @ np.array([p[0], p[1], p[2], 1.0]))[:3])

    # ---------- raw faces ----------
    def tri(self, mat, a, b, c, centre=None):
        a, b, c = self._xf(a), self._xf(b), self._xf(c)
        if centre is not None:      # orient so the normal points away from the part's centre
            cen = np.array(self._xf(centre)); n = np.cross(np.subtract(b, a), np.subtract(c, a))
            if np.dot(n, (np.add(np.add(a, b), c) / 3.0) - cen) < 0: b, c = c, b
        self.tris.setdefault(mat, []).append((a, b, c))

    def quad(self, mat, a, b, c, d, centre=None):
        self.tri(mat, a, b, c, centre); self.tri(mat, a, c, d, centre)

    def poly(self, mat, pts, centre=None):            # convex polygon, fan triangulated
        for i in range(1, len(pts) - 1): self.tri(mat, pts[0], pts[i], pts[i + 1], centre)

    def panel(self, mat, a, b, c, d, out):
        """single flat panel (window, door, sign) whose normal must face `out` (a direction vector)"""
        a2, b2, c2, d2 = (np.array(v, float) for v in (a, b, c, d)); cen = (a2 + b2 + c2 + d2) / 4.0 - np.array(out, float)
        self.quad(mat, a, b, c, d, centre=tuple(cen))

    # ---------- solids ----------
    def box(self, mat, x0, y0, z0, x1, y1, z1, mats=None, skip=()):
        """axis-aligned box. mats = optional {'top','bottom','front'(+z),'back','left'(-x),'right'} overrides; skip = faces to leave out"""
        m = mats or {}; c = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        F = {'top': [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], 'bottom': [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
             'front': [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], 'back': [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)],
             'left': [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], 'right': [(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)]}
        for k, q in F.items():
            if k not in skip: self.quad(m.get(k, mat), *q, centre=c)

    def prism(self, profile, x0, x1, mat, cap=None, side_mats=None):
        """extrude a convex 2-D profile [(z, y), ...] along X from x0 to x1. side_mats[i] colours the side from point i to i+1"""
        n = len(profile); cz = sum(p[0] for p in profile) / n; cy = sum(p[1] for p in profile) / n; c = ((x0 + x1) / 2, cy, cz)
        for i in range(n):
            (za, ya), (zb, yb) = profile[i], profile[(i + 1) % n]
            self.quad((side_mats[i] if side_mats else mat), (x0, ya, za), (x1, ya, za), (x1, yb, zb), (x0, yb, zb), centre=c)
        for x in (x0, x1): self.poly(cap or mat, [(x, y, z) for z, y in profile], centre=c)

    def slab(self, mat, a, b, c, d, t, under=None):
        """a thick flat plate (roof, porch roof): top face a-b-c-d, pushed down by thickness t along -normal"""
        A = [np.array(v, float) for v in (a, b, c, d)]; n = np.cross(A[1] - A[0], A[3] - A[0]); n /= np.linalg.norm(n)
        if n[1] < 0: n = -n
        B = [v - n * t for v in A]; cen = tuple(sum(A + B) / 8.0)
        self.quad(mat, *[tuple(v) for v in A], centre=cen); self.quad(under or mat, *[tuple(v) for v in B], centre=cen)
        for i in range(4): j = (i + 1) % 4; self.quad(under or mat, tuple(A[i]), tuple(A[j]), tuple(B[j]), tuple(B[i]), centre=cen)

    def cyl(self, mat, r0, r1, y0, y1, seg=8, cap=True, cap_mat=None, phase=0.0):
        """vertical cylinder / cone / frustum on the Y axis"""
        c = (0, (y0 + y1) / 2, 0); P = lambda r, y, k: (r * math.cos(phase + k * 2 * math.pi / seg), y, r * math.sin(phase + k * 2 * math.pi / seg))
        for k in range(seg):
            a, b, cc, d = P(r0, y0, k), P(r0, y0, k + 1), P(r1, y1, k + 1), P(r1, y1, k)
            if r1 < 1e-6: self.tri(mat, a, b, d, centre=c)
            else: self.quad(mat, a, b, cc, d, centre=c)
        if cap:
            if r1 > 1e-6: self.poly(cap_mat or mat, [P(r1, y1, k) for k in range(seg)], centre=c)
            self.poly(cap_mat or mat, [P(r0, y0, k) for k in range(seg)], centre=c)

    def log(self, mat, end_mat, x0, x1, y, z, r, seg=6):
        """horizontal log along X"""
        c = ((x0 + x1) / 2, y, z); P = lambda x, k: (x, y + r * math.cos(k * 2 * math.pi / seg), z + r * math.sin(k * 2 * math.pi / seg))
        for k in range(seg): self.quad(mat, P(x0, k), P(x1, k), P(x1, k + 1), P(x0, k + 1), centre=c)
        for x in (x0, x1): self.poly(end_mat, [P(x, k) for k in range(seg)], centre=c)

    def strip_solid(self, xs, ybot, ytop, z0, z1, mat, bottom_mat=None, top_mat=None):
        """a solid whose side outline is any shape between two curves (ybot(x) .. ytop(x)), extruded z0..z1. Used for arches, berms."""
        for i in range(len(xs) - 1):
            xa, xb = xs[i], xs[i + 1]; c = ((xa + xb) / 2, (ybot[i] + ytop[i]) / 2, (z0 + z1) / 2)
            for z in (z0, z1): self.quad(mat, (xa, ybot[i], z), (xb, ybot[i + 1], z), (xb, ytop[i + 1], z), (xa, ytop[i], z), centre=c)
            self.quad(bottom_mat or mat, (xa, ybot[i], z0), (xb, ybot[i + 1], z0), (xb, ybot[i + 1], z1), (xa, ybot[i], z1), centre=(c[0], c[1] + 99, c[2]))   # underside faces down
            self.quad(top_mat or mat, (xa, ytop[i], z0), (xb, ytop[i + 1], z0), (xb, ytop[i + 1], z1), (xa, ytop[i], z1), centre=(c[0], c[1] - 99, c[2]))
        for i in (0, len(xs) - 1):
            x = xs[i]; self.quad(mat, (x, ybot[i], z0), (x, ybot[i], z1), (x, ytop[i], z1), (x, ytop[i], z0), centre=(0 if i else xs[-1] * 2, (ybot[i] + ytop[i]) / 2, (z0 + z1) / 2))

    # ---------- building helpers ----------
    def window(self, x, y, z, w, h, normal, glass='window', trim='trim', panes=True):
        """window on a wall whose outward normal is +z/-z/+x/-x: trim frame proud of the wall, dark glass inside, optional muntin cross"""
        nx, nz = normal; e = .04
        def P(u, v, d): return (x + (u if nz else 0) * (1 if nz >= 0 else -1) + nx * d, y + v, z + (u if nx else 0) * (-1 if nx >= 0 else 1) + nz * d)
        fw, fh = w / 2 + .12, h / 2 + .12
        self.panel(trim, P(-fw, -fh, e), P(fw, -fh, e), P(fw, fh, e), P(-fw, fh, e), (nx, 0, nz))
        self.panel(glass, P(-w / 2, -h / 2, 2 * e), P(w / 2, -h / 2, 2 * e), P(w / 2, h / 2, 2 * e), P(-w / 2, h / 2, 2 * e), (nx, 0, nz))
        if panes:
            self.panel(trim, P(-.035, -h / 2, 3 * e), P(.035, -h / 2, 3 * e), P(.035, h / 2, 3 * e), P(-.035, h / 2, 3 * e), (nx, 0, nz))
            self.panel(trim, P(-w / 2, -.035, 3 * e), P(w / 2, -.035, 3 * e), P(w / 2, .035, 3 * e), P(-w / 2, .035, 3 * e), (nx, 0, nz))

    def door(self, x, y, z, w, h, normal, mat='door', trim='trim'):
        nx, nz = normal; e = .04
        def P(u, v, d): return (x + (u if nz else 0) * (1 if nz >= 0 else -1) + nx * d, y + v, z + (u if nx else 0) * (-1 if nx >= 0 else 1) + nz * d)
        self.panel(trim, P(-w / 2 - .12, 0, e), P(w / 2 + .12, 0, e), P(w / 2 + .12, h + .12, e), P(-w / 2 - .12, h + .12, e), (nx, 0, nz))
        self.panel(mat, P(-w / 2, 0, 2 * e), P(w / 2, 0, 2 * e), P(w / 2, h, 2 * e), P(-w / 2, h, 2 * e), (nx, 0, nz))

    def gable_roof(self, W, D, eave, ridge, over=.35, t=.18, mat='roofShingle', along='x'):
        """two roof slabs; ridge along X (default) or Z, overhanging by `over` on every side"""
        half = D / 2 if along == 'x' else W / 2; lift = t * math.hypot(1, (ridge - eave) / half) + .02   # sit ON the wall slopes (no z-fighting with the gables)
        eave, ridge = eave + lift, ridge + lift
        if along == 'x':
            for s in (1, -1):
                self.slab(mat, (-W / 2 - over, eave - over * (ridge - eave) / (D / 2), s * (D / 2 + over)), (W / 2 + over, eave - over * (ridge - eave) / (D / 2), s * (D / 2 + over)),
                          (W / 2 + over, ridge, 0), (-W / 2 - over, ridge, 0), t)
        else:
            for s in (1, -1):
                self.slab(mat, (s * (W / 2 + over), eave - over * (ridge - eave) / (W / 2), -D / 2 - over), (s * (W / 2 + over), eave - over * (ridge - eave) / (W / 2), D / 2 + over),
                          (0, ridge, D / 2 + over), (0, ridge, -D / 2 - over), t)

    def house_body(self, W, D, eave, ridge, mat, along='x'):
        """walls + gable ends as one prism (gable triangles in the wall material)"""
        if along == 'x': self.prism([(-D / 2, 0), (D / 2, 0), (D / 2, eave), (0, ridge), (-D / 2, eave)], -W / 2, W / 2, mat)
        else:
            with self.at(ry=90): self.prism([(-W / 2, 0), (W / 2, 0), (W / 2, eave), (0, ridge), (-W / 2, eave)], -D / 2, D / 2, mat)

    # ---------- output ----------
    def stats(self):
        return sum(len(v) for v in self.tris.values())

    def save_glb(self, path, palette=None):
        """flat-shaded glb, one primitive per material; viewer colours from `palette` (sRGB 0-255) if given"""
        mats = sorted(self.tris); pos, nrm, prims, idx_all = [], [], [], []
        base = 0
        for mi, m in enumerate(mats):
            idx = []
            for a, b, c in self.tris[m]:
                n = np.cross(np.subtract(b, a), np.subtract(c, a)); L = np.linalg.norm(n)
                if L < 1e-12: continue
                n = n / L; pos += [a, b, c]; nrm += [tuple(n)] * 3; idx += [base, base + 1, base + 2]; base += 3
            prims.append((mi, idx))
        P = np.array(pos, np.float32); N = np.array(nrm, np.float32)
        bin_ = bytearray(); views, accs = [], []
        def add(data, target, comp, typ, count, mn=None, mx=None):
            off = len(bin_); bin_.extend(data); views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), **({'target': target} if target else {})})
            while len(bin_) % 4: bin_.append(0)
            a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': count, 'type': typ}
            if mn is not None: a['min'], a['max'] = mn, mx
            accs.append(a); return len(accs) - 1
        pa = add(P.tobytes(), 34962, 5126, 'VEC3', len(P), P.min(0).tolist(), P.max(0).tolist()); na = add(N.tobytes(), 34962, 5126, 'VEC3', len(N))
        out_prims = []
        for mi, idx in prims:
            I = np.array(idx, np.uint32); ia = add(I.tobytes(), 34963, 5125, 'SCALAR', len(I))
            out_prims.append({'attributes': {'POSITION': pa, 'NORMAL': na}, 'indices': ia, 'material': mi})
        def lin(c): c = c / 255.0; return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
        materials = [{'name': m, 'pbrMetallicRoughness': {'baseColorFactor': [*(lin(v) for v in (palette or {}).get(m, (180, 170, 150))), 1.0], 'metallicFactor': 0.0, 'roughnessFactor': 0.9}} for m in mats]
        gj = {'asset': {'version': '2.0', 'generator': 'CWG3 tools/modelkit.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': self.name}],
              'meshes': [{'name': self.name, 'primitives': out_prims}], 'materials': materials, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}]}
        js = json.dumps(gj, separators=(',', ':')).encode()
        while len(js) % 4: js += b' '
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
            f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
            f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bytes(bin_))
