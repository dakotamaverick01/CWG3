#!/usr/bin/env python3
"""Living fields, piece 1: our own painterly trees, written as code (own work, no downloads, no licences).

    python3 tools/gen_trees.py        (needs numpy + Pillow; ~5 s)

Writes:
    assets/models/src/gen/foliage_atlas.png   the painted leaf atlas (8 tiles of 256 px: oak, maple, poplar, sycamore, needles, cedar, apple, shrub)
    assets/art/trees.js                       CW.TREES: every species x 2-4 seeded variants + the atlas as a data: URL (works by double-click)

How a tree is made (all sizes in metres, y up):
    1. a crown ENVELOPE per species (broad oak dome, oval maple, tall poplar, cone cedar, umbrella pine, ...), a little lumpy per variant
    2. a SKELETON: trunk, then main limbs that grow out until they touch the envelope, then side branches -> tapered low-poly tubes
       (6 sides trunk, 4 limbs, 3 twigs). Each vertex keeps a wind weight (0 at the trunk foot -> 1 at the twig tips) and a bark colour.
    3. a CANOPY of leaf CARDS (2 triangles each) clustered around the branch tips. Each card shows one painted leaf-cluster tile.
       Card normals are "spherical" (pointing out of the crown and out of its clump), so the crown lights like a soft cloud of clumps;
       each corner also stores crown AO (darker deep inside) and the wind weight.
"""
import os, io, json, math, base64, random
import numpy as np
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
TILE, COLS, ROWS = 256, 4, 2
TILES = ['oak', 'maple', 'poplar', 'syc', 'needle', 'cedar', 'apple', 'shrub']

# ------------------------------------------------------------------ foliage atlas (painted with numpy)


def hexc(s):
    return np.array([int(s[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)


def stamp(img, cx, cy, ang, L, W, col, prof, rim=1.14, rib=.84, ribw=.6):
    """One leaf from its base (cx, cy) along angle ang: length L, half-width W, width profile prof(u), soft alpha edge, lit edge, darker midrib."""
    ca, sa = math.cos(ang), math.sin(ang); ex, ey = cx + ca * L, cy + sa * L; pad = W + 2
    x0, x1 = int(max(0, min(cx, ex) - pad)), int(min(TILE, max(cx, ex) + pad + 1)); y0, y1 = int(max(0, min(cy, ey) - pad)), int(min(TILE, max(cy, ey) + pad + 1))
    if x1 <= x0 or y1 <= y0: return
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32) + .5; dx, dy = xs - cx, ys - cy
    u = (dx * ca + dy * sa) / L; v = -dx * sa + dy * ca; uc = np.clip(u, 0, 1); w = W * prof(uc)
    edge = w - np.abs(v); a = np.clip(edge / 1.1 + .5, 0, 1) * np.clip(u * L + .5, 0, 1) * np.clip((1 - u) * L + .5, 0, 1)
    if a.max() <= 0: return
    side = v / np.maximum(w, .5); lit = 1 + .16 * side * (-sa * -.6 + ca * -.8)   # the half facing the light (upper left of the tile) is brighter
    f = lit * (.9 + .18 * uc) * np.where(edge < 1.5, rim, 1.0) * np.where((np.abs(v) < ribw) & (uc > .06) & (uc < .9), rib, 1.0)
    rgb = np.clip(col[None, None, :] * f[..., None], 0, 1); sub = img[y0:y1, x0:x1]
    sub[..., :3] = rgb * a[..., None] + sub[..., :3] * (1 - a[..., None]); sub[..., 3] = a + sub[..., 3] * (1 - a)


def line(img, x0, y0, x1, y1, w, col):
    L = math.hypot(x1 - x0, y1 - y0) or 1
    stamp(img, x0, y0, math.atan2(y1 - y0, x1 - x0), L, w, col, lambda u: 1 - .5 * u, rim=1, rib=1)


SIN = lambda u: np.maximum(np.sin(np.pi * u), 0)
P_BROAD = lambda u: SIN(u) ** .8
P_OAK = lambda u: SIN(u) ** .7 * (.62 + .38 * np.abs(np.cos(u * np.pi * 3.5)))
P_MAPLE = lambda u: SIN(u ** .8) ** .5 * (.55 + .45 * np.abs(np.cos(u * np.pi * 2.5)))
P_POPLAR = lambda u: np.minimum(1, SIN(u) ** .45 * 1.1) * np.where(u > .85, (1 - u) / .15 * .7 + .3, 1)
P_OVAL = lambda u: np.sqrt(SIN(u))
P_NEEDLE = lambda u: np.minimum(1, (1 - u) * 5)


def ragged(rng, base):
    ph = [rng.random() * 6.283 for _ in range(4)]
    return lambda a: base * (.80 + .09 * math.sin(3 * a + ph[0]) + .07 * math.sin(5 * a + ph[1]) + .05 * math.sin(7 * a + ph[2]))


def cluster(seed, n, L, W, prof, dark, light, twig='#4a3a2a', radius=116, fruit=0):
    """A leaf cluster: twigs from the centre, leaves pointing outwards, back leaves darker/bluer, front leaves lighter/yellower."""
    rng = random.Random(seed); img = np.zeros((TILE, TILE, 4), np.float32); C = TILE / 2; edge = ragged(rng, radius)
    D, Li, T = hexc(dark), hexc(light), hexc(twig)
    for k in range(6):
        a = k * 1.047 + rng.uniform(-.4, .4); r = radius * rng.uniform(.5, .8)
        line(img, C, C, C + math.cos(a) * r, C + math.sin(a) * r, 1.4, T * .8)
    fruits = sorted(rng.random() * .6 + .3 for _ in range(fruit))
    for i in range(n):
        dep = i / n
        while fruits and fruits[0] < dep:
            fruits.pop(0); a = rng.random() * 6.283; r = radius * rng.uniform(.15, .6); fx, fy, fr = C + math.cos(a) * r, C + math.sin(a) * r, rng.uniform(7, 9.5)
            red = hexc('#b8372a') * rng.uniform(.85, 1.1); stamp(img, fx - fr, fy, 0, 2 * fr, fr, red, P_OVAL, rim=.8, rib=1)
            stamp(img, fx - fr * .45, fy - fr * .45, 0, fr * .7, fr * .3, np.clip(red * 1.6 + .1, 0, 1), P_OVAL, rim=1, rib=1)
        for _ in range(20):
            a = rng.random() * 6.283; r = math.sqrt(rng.random()) * edge(a)
            x, y = C + math.cos(a) * r, C + math.sin(a) * r
            if r + L * .6 < edge(a) or rng.random() < .3: break
        la = a + rng.uniform(-.9, .9); ll = L * rng.uniform(.75, 1.15)
        col = (D + (Li - D) * (dep * .8 + rng.random() * .2)) * rng.uniform(.92, 1.08); col = col * np.array([1 + rng.uniform(-.05, .05), 1, 1 + rng.uniform(-.06, .03)], np.float32)
        stamp(img, x - math.cos(la) * ll * .3, y - math.sin(la) * ll * .3, la, ll, W * rng.uniform(.8, 1.15), np.clip(col, 0, 1), prof)
    return img


def needles(seed, dark, light):
    rng = random.Random(seed); img = np.zeros((TILE, TILE, 4), np.float32); C = TILE / 2; D, Li = hexc(dark), hexc(light)
    for k in range(5):
        a = k * 1.257 + rng.uniform(-.3, .3); line(img, C, C, C + math.cos(a) * 92, C + math.sin(a) * 92, 1.8, hexc('#5a4030'))
    tufts = [(rng.random() * 6.283, rng.uniform(20, 80)) for _ in range(17)]
    for ti, (a, r) in enumerate(sorted(tufts, key=lambda t: rng.random())):
        tx, ty = C + math.cos(a) * r, C + math.sin(a) * r
        for i in range(42):   # round pom-pom tufts, needles out in every direction (longer towards the twig tip)
            na = rng.uniform(0, 6.283); nl = rng.uniform(16, 30) * (1 + .4 * math.cos(na - a)); dep = (ti + i / 46) / len(tufts)
            col = (D + (Li - D) * (dep * .7 + rng.random() * .3)) * rng.uniform(.9, 1.1)
            stamp(img, tx, ty, na, nl, rng.uniform(.9, 1.3), np.clip(col, 0, 1), P_NEEDLE, rim=1.08, rib=1)
    return img


def cedar(seed, dark, light):
    rng = random.Random(seed); img = np.zeros((TILE, TILE, 4), np.float32); C = TILE / 2; D, Li = hexc(dark), hexc(light)
    for k in range(7):
        a = k * .898 + rng.uniform(-.25, .25); x, y, L = C, C, rng.uniform(95, 118); steps = int(L / 7)
        for s in range(steps):
            a += rng.uniform(-.08, .08); nx, ny = x + math.cos(a) * 7, y + math.sin(a) * 7; t = s / steps
            col = np.clip((D + (Li - D) * (.3 + .7 * t * rng.uniform(.7, 1))) * rng.uniform(.9, 1.08), 0, 1)
            stamp(img, x, y, a, 8.5, 2.6, col, P_OVAL, rim=1.1, rib=1)
            for sd in (-1, 1):
                sa = a + sd * rng.uniform(.8, 1.1); sl = (1 - t) * 22 + 6; px, py = nx, ny
                for q in range(int(sl / 3.5)):
                    c2 = np.clip(col * rng.uniform(.85, 1.15), 0, 1); stamp(img, px, py, sa, 6, 2.2, c2, P_OVAL, rim=1.12, rib=1)
                    px += math.cos(sa) * 3.5; py += math.sin(sa) * 3.5; sa += sd * .05
            x, y = nx, ny
    return img


def bleed(img):
    """Fill transparent pixels with nearby leaf colour so mipmaps don't get dark fringes; returns straight-alpha uint8."""
    a = img[..., 3]; rgb = img[..., :3].copy(); w = a.copy(); acc = rgb * w[..., None]
    for _ in range(24):
        acc = (acc + np.roll(acc, 1, 0) + np.roll(acc, -1, 0) + np.roll(acc, 1, 1) + np.roll(acc, -1, 1)) / 5
        w = (w + np.roll(w, 1, 0) + np.roll(w, -1, 0) + np.roll(w, 1, 1) + np.roll(w, -1, 1)) / 5
    fill = acc / np.maximum(w[..., None], 1e-5); out = np.where(a[..., None] > .02, rgb, fill)
    return np.dstack([np.clip(out, 0, 1), a])


def atlas():
    T = {
        'oak': cluster(11, 150, 30, 7.5, P_OAK, '#2c4a1f', '#6a8c38'),
        'maple': cluster(12, 120, 36, 11, P_MAPLE, '#30521f', '#76983e'),
        'poplar': cluster(13, 115, 36, 13, P_POPLAR, '#38591f', '#86a645'),
        'syc': cluster(14, 95, 44, 15, P_MAPLE, '#3e6026', '#93ae55'),
        'needle': needles(15, '#26401f', '#6f8b3a'),
        'cedar': cedar(16, '#22392c', '#5b7a52'),
        'apple': cluster(17, 160, 27, 9, P_OVAL, '#2f5021', '#729442', fruit=7),
        'shrub': cluster(18, 320, 19, 6, P_BROAD, '#2e4c1e', '#7f9d45', radius=120),
    }
    big = np.zeros((TILE * ROWS, TILE * COLS, 4), np.float32)
    for i, k in enumerate(TILES):
        big[(i // COLS) * TILE:(i // COLS + 1) * TILE, (i % COLS) * TILE:(i % COLS + 1) * TILE] = bleed(T[k])
    im = Image.fromarray((np.nan_to_num(big) * 255 + .5).astype(np.uint8)); dst = os.path.join(ROOT, 'assets/models/src/gen/foliage_atlas.png')
    im.save(dst, optimize=True); return dst

# ------------------------------------------------------------------ tree geometry


def nrm(v):
    l = np.linalg.norm(v); return v / l if l > 1e-9 else v


class Tree:
    def __init__(s):
        s.bp, s.bn, s.bc, s.bi, s.lp, s.ln, s.luv, s.la, s.li = [], [], [], [], [], [], [], [], []

    def tube(s, pts, rads, wts, sides, col):
        base = len(s.bp); n = len(pts); ref = np.array([1., 0, 0]) if abs(nrm(pts[1] - pts[0])[1]) > .9 else np.array([0, 1., 0])
        for i in range(n):
            t = nrm(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]); u = nrm(np.cross(t, ref)); v = np.cross(t, u); ref = v
            for k in range(sides):
                a = 6.2832 * k / sides; d = math.cos(a) * u + math.sin(a) * v
                s.bp.append(pts[i] + d * rads[i]); s.bn.append(d); s.bc.append(col(pts[i], d) + [wts[i]])
        for i in range(n - 1):
            for k in range(sides):
                a = base + i * sides + k; b = base + i * sides + (k + 1) % sides; s.bi += [a, b, a + sides, b, b + sides, a + sides]

    def card(s, c, n, size, rng, tile, nf, aof, wt):
        up = np.array([0, 1., 0]) if abs(n[1]) < .95 else np.array([1., 0, 0]); r = nrm(np.cross(up, n)); u = np.cross(n, r)
        a = rng.uniform(0, 6.283); r, u = r * math.cos(a) + u * math.sin(a), -r * math.sin(a) + u * math.cos(a)
        tx, ty = (TILES.index(tile) % COLS) / COLS, (TILES.index(tile) // COLS) / ROWS; e = 1.5 / (TILE * COLS); fl = rng.random() < .5
        base = len(s.lp); rnd = rng.random()
        for (x, y) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = c + (r * x + u * y) * size * .5; s.lp.append(p); s.ln.append(nf(p))
            uu = (x if not fl else -x) * .5 + .5; vv = .5 - y * .5
            s.luv.append([tx + e + uu * (1 / COLS - 2 * e), ty + e + vv * (1 / ROWS - 2 * e)]); s.la.append([wt, aof(p), rnd])
        s.li += [base, base + 1, base + 2, base, base + 2, base + 3]

    def pack(s, H, R, hc):
        b64 = lambda a: base64.b64encode(a.tobytes()).decode()
        o = {'h': round(H, 2), 'r': round(R, 2), 'hc': round(hc, 2), 'tris': (len(s.bi) + len(s.li)) // 3,
             'bp': b64(np.array(s.bp, np.float32)), 'bn': b64(np.clip(np.round(np.array(s.bn) * 127), -127, 127).astype(np.int8)),
             'bc': b64(np.clip(np.round(np.array(s.bc) * 255), 0, 255).astype(np.uint8)), 'bi': b64(np.array(s.bi, np.uint16))}
        if s.li:
            o.update({'lp': b64(np.array(s.lp, np.float32)), 'ln': b64(np.clip(np.round(np.array(s.ln) * 127), -127, 127).astype(np.int8)),
                      'luv': b64(np.clip(np.round(np.array(s.luv) * 65535), 0, 65535).astype(np.uint16)),
                      'la': b64(np.clip(np.round(np.array([q + [0] for q in s.la]) * 255), 0, 255).astype(np.uint8)), 'li': b64(np.array(s.li, np.uint16))})
        return o


SHAPES = {   # crown radius at height fraction t (0 = crown base, 1 = top), as a fraction of R
    'broad': lambda t: math.sin(math.pi * min(1, t ** .75)) ** .6,
    'oval': lambda t: max(0, 1 - (2 * t - 1) ** 2) ** .5,
    'tall': lambda t: math.sin(math.pi * t ** .85) ** .8,
    'cone': lambda t: (1 - t) ** .95 * min(1, t / .05 + .5),
    'umbrella': lambda t: math.sin(math.pi * t) ** .45 * (.65 + .35 * t),
    'round': lambda t: max(0, 1 - (2 * t - 1) ** 2) ** .4,
    'dome': lambda t: max(0, 1 - t * t) ** .5,
}

#        H (m)      crown base  R (m)      shape       trunk to  limbs   limb elev deg  side  cards      card m      tile      bark sRGB             lump  variants
SPECIES = {
    'oak':      dict(H=(17, 20), cb=(4.5, 5.5), R=(5.8, 6.8), shape='broad', tf=.45, n1=(6, 7), el=(22, 48), n2=2, cards=(84, 92), sz=(2.9, 3.5), tile='oak', bark='#4f473f', lump=.12, var=4, rt=.026),
    'maple':    dict(H=(15, 17), cb=(3.5, 4.5), R=(4.4, 5.0), shape='oval', tf=.6, n1=(6, 7), el=(45, 65), n2=2, cards=(96, 104), sz=(2.4, 2.9), tile='maple', bark='#6b665e', lump=.10, var=4, rt=.022),
    'sycamore': dict(H=(20, 24), cb=(5.5, 7.0), R=(5.4, 6.4), shape='oval', tf=.7, n1=(6, 7), el=(28, 60), n2=2, cards=(86, 94), sz=(2.8, 3.4), tile='syc', bark='syc', lump=.26, var=3, rt=.024),
    'poplar':   dict(H=(24, 28), cb=(11, 13), R=(3.3, 3.9), shape='tall', tf=.9, n1=(6, 7), el=(50, 68), n2=1, cards=(92, 100), sz=(2.5, 3.0), tile='poplar', bark='#6e685e', lump=.10, var=3, rt=.019),
    'cedar':    dict(H=(8, 11), cb=(.4, .9), R=(2.0, 2.6), shape='cone', cards=(128, 136), sz=(1.5, 1.9), tile='cedar', bark='#6a4636', lump=.10, var=3, rt=.03),
    'pine':     dict(H=(18, 21), cb=(10, 12), R=(3.3, 4.1), shape='umbrella', tf=.92, n1=(7, 8), el=(-8, 18), n2=1, cards=(76, 84), sz=(2.3, 2.8), tile='needle', bark='#6b4b36', lump=.2, var=3, rt=.02),
    'apple':    dict(H=(4.6, 5.6), cb=(1.3, 1.6), R=(2.7, 3.2), shape='round', tf=.3, n1=(4, 5), el=(32, 50), n2=2, cards=(66, 72), sz=(1.5, 1.9), tile='apple', bark='#4d4037', lump=.10, var=3, rt=.045),
    'dead':     dict(H=(14, 18), cb=(4, 5), R=(4.0, 5.0), shape='oval', tf=.75, n1=(5, 6), el=(20, 60), n2=2, tile=None, bark='#8c877d', lump=.2, var=2, rt=.03),
    'sapling':  dict(H=(4.5, 7), cb=(1.6, 2.2), R=(1.1, 1.6), shape='oval', tf=.8, n1=(3, 3), el=(40, 60), n2=0, cards=(20, 24), sz=(1.2, 1.5), tile='maple', bark='#66605a', lump=.15, var=3, rt=.03),
    'shrub':    dict(H=(1.4, 2.4), cb=(0, .1), R=(1.2, 1.8), shape='dome', cards=(24, 28), sz=(1.1, 1.4), tile='shrub', bark='#4a3e32', lump=.18, var=3, rt=.0),
}


def make(name, sp, seed):
    rng = random.Random(seed); T = Tree(); U = rng.uniform
    H, cb, R = U(*sp['H']), U(*sp['cb']), U(*sp['R']); shp = SHAPES[sp['shape']]; ph = [U(0, 6.283) for _ in range(6)]
    tile = sp['tile'] if name != 'sapling' else rng.choice(['maple', 'oak', 'poplar'])
    def env(y, az):
        t = (y - cb) / (H - cb)
        if t < 0 or t > 1: return 0.
        lumpy = 1 + sp['lump'] * (.5 * math.sin(2 * az + ph[0] + 3 * t) + .3 * math.sin(3 * az + ph[1] - 2 * t) + .2 * math.sin(5 * az + ph[2] + 5 * t))
        return R * shp(t) * lumpy
    inside = lambda p: math.hypot(p[0], p[2]) <= env(p[1], math.atan2(p[2], p[0]))
    def reach(p, d, mx):   # how far from p along d until we leave the crown
        L = 0.
        while L < mx:
            L += .25; q = p + d * L
            if not inside(q) and L > 1.: return L
        return mx
    if sp['bark'] == 'syc':   # sycamore: brown-grey foot, pale cream mottled limbs above
        def bcol(p, d):
            pale = min(.95, max(.15, (p[1] / H - .12) * 2.6)); h = (math.sin(p[1] * 3.1 + d[0] * 4) * math.sin(p[1] * 1.7 - d[2] * 5) + 1) * .5
            return list(hexc('#cfcab8') * (.9 + .1 * h) if h < pale else hexc('#6f685a') * (.9 + .2 * h))
    else:
        bc = hexc(sp['bark'])
        def bcol(p, d): return list(bc * (.9 + .2 * rng.random()) * (.82 + .18 * min(1, p[1] / max(1, cb))))
    wt_at = lambda y: (max(0, y) / H) ** 1.6 * .5
    tips = []
    # trunk
    if sp['shape'] != 'dome':
        top = cb + (H - cb) * sp.get('tf', .9); nseg = 4 if H > 9 else 2; lean = np.array([U(-.04, .04), 1, U(-.04, .04)])
        pts = [np.zeros(3)]
        for i in range(nseg): pts.append(pts[-1] + nrm(lean + np.array([U(-.06, .06), 0, U(-.06, .06)])) * top / nseg)
        r0 = max(.08, H * sp['rt']); rads = [r0 * 1.35] + [r0 * (1 - .65 * i / nseg) for i in range(1, nseg + 1)]
        if name == 'dead': rads[-1] = r0 * .45
        T.tube(pts, rads, [wt_at(p[1]) for p in pts], 6 if H > 3 else 4, bcol); trunk = pts
        if sp['shape'] == 'cone':   # cedar: needles hide everything, just a top
            tips.append(pts[-1] + np.array([0, H - top, 0]))
    else:
        for k in range(3):   # shrub stems
            a = k * 2.1 + U(-.4, .4); q = np.array([math.cos(a) * R * .4, H * .6, math.sin(a) * R * .4])
            T.tube([np.zeros(3), q], [.04, .015], [0, .5], 3, bcol); tips.append(q)
        trunk = None
    # limbs and side branches
    if trunk is not None and 'n1' in sp:
        n1 = rng.randint(*sp['n1']); az0 = U(0, 6.283); top = trunk[-1][1]
        for i in range(n1):
            f = (i + U(.2, .8)) / n1; y = cb * .9 + (top - cb * .9) * f
            if name == 'pine' and i < 3: y = cb * U(.5, .9)   # Virginia pine: dead stubs low on the trunk
            seg = min(len(trunk) - 2, int(y / top * (len(trunk) - 1))); a = trunk[seg] + (trunk[seg + 1] - trunk[seg]) * ((y / top * (len(trunk) - 1)) - seg)
            az = az0 + i * 2.39996 + U(-.3, .3); el = math.radians(U(*sp['el'])); d = np.array([math.cos(el) * math.cos(az), math.sin(el), math.cos(el) * math.sin(az)])
            L = reach(a, d, R * 2.2) * U(.82, 1.0)
            if name == 'pine' and i < 3: L = U(.6, 1.2)
            if name == 'oak' and i >= n1 - 2: d = nrm(d + np.array([0, 1.2, 0])); L = reach(a, d, H) * U(.8, .95)   # oak: the trunk forks into leaders
            ns = 2 if name in ('oak', 'dead', 'apple', 'sycamore') else 1; pts = [a]
            for s in range(ns): d = nrm(d + np.array([U(-.15, .15), (.12 if name != 'pine' else -.05), U(-.15, .15)])); pts.append(pts[-1] + d * L / ns)
            rr = max(.05, r0 * .55 * (1 - .4 * f)); w0 = wt_at(y)
            T.tube(pts, [rr] + [rr * (1 - .7 * (s + 1) / ns) for s in range(ns)], [w0] + [w0 + (.85 - w0) * (s + 1) / ns for s in range(ns)], 4 if rr > .1 else 3, bcol)
            if name == 'pine' and i < 3: continue
            tips.append(pts[-1])
            for j in range(sp['n2']):
                q = pts[-2] + (pts[-1] - pts[-2]) * U(.3, .9) if ns > 1 else pts[0] + (pts[-1] - pts[0]) * U(.45, .85)
                sa = U(.5, .95) * (1 if j % 2 else -1); dd = nrm(np.array([d[0] * math.cos(sa) - d[2] * math.sin(sa), d[1] + U(.1, .4), d[0] * math.sin(sa) + d[2] * math.cos(sa)]))
                l2 = reach(q, dd, R * 1.4) * U(.6, .85); e = q + dd * l2
                if name == 'dead':   # dead tree: one more level of bare twigs, 2 segments
                    m = q + dd * l2 * .55 + np.array([U(-.3, .3), U(-.1, .3), U(-.3, .3)])
                    T.tube([q, m, e], [rr * .45, rr * .25, .02], [.7, .85, 1], 3, bcol)
                    for _ in range(2):
                        td = nrm(dd + np.array([U(-.8, .8), U(.1, .7), U(-.8, .8)])); T.tube([m, m + td * l2 * U(.35, .6)], [rr * .2, .015], [.85, 1], 3, bcol)
                else:
                    T.tube([q, e], [max(.03, rr * .45), .02], [.7, 1], 3, bcol)
                tips.append(e)
        tips.append(trunk[-1] + np.array([0, (H - trunk[-1][1]) * .7, 0]))
    hc = cb + (H - cb) * (.5 if sp['shape'] != 'cone' else .35); C = np.array([0, hc, 0]); ry = max(.5, (H - cb) * .5)
    if sp['tile'] is None:
        return T.pack(H, R, hc)
    # clumps: branch tips pulled inside the crown, plus extra clumps where the crown is still empty
    clumps = []
    for p in tips:
        az = math.atan2(p[2], p[0]); y = min(H - .3, max(cb + .2, p[1])); e = env(y, az); rxz = math.hypot(p[0], p[2])
        if rxz > e * .92 and rxz > 0: p = np.array([p[0] * e * .92 / rxz, y, p[2] * e * .92 / rxz])
        clumps.append(np.array([p[0], y, p[2]]))
    want = {'cone': 0, 'dome': 5, 'umbrella': 6}.get(sp['shape'], 16 if R > 3 else 6); tries = 0
    while len(clumps) < want + len(tips) and tries < 400:
        tries += 1; y = U(cb + (H - cb) * .15, H - .4); az = U(0, 6.283); e = env(y, az) * U(.62, .95); p = np.array([math.cos(az) * e, y, math.sin(az) * e])
        if min(np.linalg.norm(p - q) for q in clumps) > R * .45: clumps.append(p)
    rc = max(1.0, R * .3); ncard = rng.randint(*sp['cards'])
    def ell(p): return nrm(np.array([p[0] / R, (p[1] - hc) / ry, p[2] / R]))
    def ao_of(p):
        az = math.atan2(p[2], p[0]); e = env(min(H, max(cb, p[1])), az) or .3; d = min(1.2, math.hypot(p[0], p[2]) / e)
        t = min(1, max(0, (p[1] - cb) / (H - cb))); return float(min(1, max(.25, .3 + .7 * d ** 1.3) * (.78 + .22 * t)))
    for i in range(ncard):
        if sp['shape'] == 'cone':   # cedar: sprays all over a dense cone, drooping outwards
            t = 1 - math.sqrt(U(0, 1)) * .98; y = cb + (H - cb) * t; az = U(0, 6.283); e = env(y, az) * U(.55, 1.0)
            c = np.array([math.cos(az) * e, y, math.sin(az) * e]); out = nrm(np.array([c[0], 0, c[2]]) + 1e-3)
            n = nrm(out + np.array([0, .6, 0]) + np.array([U(-.4, .4), U(-.3, .3), U(-.4, .4)])); size = U(*sp['sz']) * (1 - .45 * t)
            nf = lambda p: ell(p); wt = .4 + .5 * t
        else:
            k = clumps[i % len(clumps)]; c = k + np.array([rng.gauss(0, rc * .55), rng.gauss(0, rc * .45), rng.gauss(0, rc * .55)])
            az = math.atan2(c[2], c[0]); y = min(H - .2, max(cb + .1, c[1])); e = env(y, az); rxz = math.hypot(c[0], c[2])
            if rxz > e * 1.05 and rxz > 0: c = np.array([c[0] * e * 1.05 / rxz, y, c[2] * e * 1.05 / rxz])
            rel = nrm(c - k + 1e-3); up = .9 if sp['tile'] == 'needle' else .3
            n = nrm(rel + np.array([U(-.9, .9), U(-.9, .9) + up, U(-.9, .9)])); size = U(*sp['sz']) * U(.85, 1.15)
            nf = (lambda kk: lambda p: nrm(.72 * ell(p) + .28 * nrm(p - kk + 1e-3)))(k); wt = float(min(1, .55 + .45 * min(1, math.hypot(c[0], c[2]) / R)) * (.6 + .4 * c[1] / H))
        T.card(c, n, size, rng, tile, nf, ao_of, wt)
    return T.pack(H, R, hc)


def main():
    dst = atlas(); data = open(dst, 'rb').read()
    out = {'atlas': 'data:image/png;base64,' + base64.b64encode(data).decode(), 'tiles': TILES, 'grid': [COLS, ROWS], 'species': {}}
    rows = []
    for si, (name, sp) in enumerate(SPECIES.items()):
        out['species'][name] = [make(name, sp, 1000 * si + v * 37 + 5) for v in range(sp['var'])]
        rows.append(f"  {name:9s} {len(out['species'][name])} variants, tris " + ', '.join(str(v['tris']) for v in out['species'][name]) + f", h {out['species'][name][0]['h']} m")
    js = os.path.join(ROOT, 'assets/art/trees.js')
    with open(js, 'w') as f:
        f.write('// generated by tools/gen_trees.py (own work: trees written as code, leaf atlas painted in numpy). Do not edit by hand.\n')
        f.write('CW.TREES = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    print(f'wrote {os.path.relpath(dst, ROOT)} ({len(data)} bytes) and {os.path.relpath(js, ROOT)} ({os.path.getsize(js)} bytes)'); print('\n'.join(rows))


if __name__ == '__main__':
    main()
