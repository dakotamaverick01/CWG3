#!/usr/bin/env python3
"""Generate CWG3's own 1860s structures as .glb files (our own work, free to use anywhere).

Usage:  python3 -I tools/gen_models.py            -> writes assets/models/src/gen/<name>.glb for every model below
        python3 -I tools/gen_models.py barn mill  -> only those
Then:   python3 -I tools/bake_models.py           -> packs everything listed in assets/models/MANIFEST.json into assets/art/models.js

Each model is a short function using tools/modelkit.py (metres, front = +Z, materials named from assets/models/palette.json).
To change a building, edit its numbers here and re-run both commands. Rough period references: rural Virginia / Maryland /
Pennsylvania 1850s-60s (two-storey "I-house" farmhouse, bank barn, frame church with steeple, false-front store,
Federal brick house, log cabin, stone grist mill with an overshot wheel, three-arch stone bridge, earthwork parapet, wedge tent).
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from modelkit import Model

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'models', 'src', 'gen')
PAL = {k: v for k, v in json.load(open(os.path.join(ROOT, 'assets', 'models', 'palette.json'))).items() if not k.startswith('_')}
F, B, L, Rt = (0, 1), (0, -1), (-1, 0), (1, 0)       # wall normals: front (+z), back, left (-x), right (+x)


def foundation(m, W, D, h=.5, mat='stone'):
    m.box(mat, -W / 2 - .08, 0, -D / 2 - .08, W / 2 + .08, h, D / 2 + .08, skip=('bottom',))


def chimney(m, x, z, w, d, y0, y1, mat='brick'):
    m.box(mat, x - w / 2, y0, z - d / 2, x + w / 2, y1, z + d / 2, skip=('bottom',))
    m.box('stoneDark' if mat == 'stone' else 'brickDark', x - w / 2 - .06, y1 - .25, z - d / 2 - .06, x + w / 2 + .06, y1, z + d / 2 + .06, skip=('bottom',))


def farmhouse():
    """two-storey frame I-house: five bays, centre door, end chimneys, front porch"""
    m = Model('farmhouse'); W, D, E, Rg = 10.0, 6.0, 5.8, 8.1
    foundation(m, W, D); m.house_body(W, D, E, Rg, 'clapboard'); m.gable_roof(W, D, E, Rg, mat='roofShingle')
    for x in (-3.6, -1.8, 1.8, 3.6): m.window(x, 1.9, D / 2, .8, 1.4, F)
    for x in (-3.6, -1.8, 0, 1.8, 3.6): m.window(x, 4.45, D / 2, .8, 1.25, F)
    m.door(0, .5, D / 2, 1.0, 2.1, F)
    for x in (-2.6, 0, 2.6): m.window(x, 1.9, -D / 2, .8, 1.4, B); m.window(x, 4.45, -D / 2, .8, 1.25, B)
    for sx, n in ((-1, L), (1, Rt)):
        m.window(sx * W / 2, 6.6, 1.1, .6, .7, n)                                                # attic light beside the chimney
    for sx in (-1, 1): chimney(m, sx * (W / 2 + .35), 0, .9, 1.4, 0, Rg + 1.1)
    m.box('wood', -2.8, 0, D / 2, 2.8, .5, D / 2 + 2.3, skip=('bottom',))                        # porch floor
    for x in (-2.6, -0.9, 0.9, 2.6): m.box('trim', x - .09, .5, D / 2 + 2.0, x + .09, 3.0, D / 2 + 2.18)
    m.slab('roofTin', (-3.0, 3.35, D / 2 + .05), (3.0, 3.35, D / 2 + .05), (3.0, 2.85, D / 2 + 2.55), (-3.0, 2.85, D / 2 + 2.55), .12)
    return m


def barn():
    """bank barn: stone lower storey, red board walls, big doors, hayloft door, cupola"""
    m = Model('barn'); W, D, E, Rg = 15.0, 9.0, 5.6, 9.6
    m.box('stone', -W / 2 - .1, 0, -D / 2 - .1, W / 2 + .1, 1.4, D / 2 + .1, skip=('bottom',))
    m.house_body(W, D, E, Rg, 'barnRed'); m.gable_roof(W, D, E, Rg, over=.5, mat='roofWood')
    m.door(0, 1.4, D / 2, 4.2, 3.8, F, mat='barnDoor')
    for x in (-4.4, 4.4): m.window(x, 3.2, D / 2, .9, .9, F, panes=False)
    m.door(0, 6.0, D / 2, 1.6, 1.7, F, mat='barnDoor')                                            # hayloft door in the front
    for sx, n in ((-1, L), (1, Rt)): m.door(sx * W / 2, 5.4, 0, 1.4, 1.8, n, mat='barnDoor')      # gable vents
    m.door(-3.5, 0, -D / 2, 2.4, 1.3, B, mat='door'); m.door(3.5, 0, -D / 2, 2.4, 1.3, B, mat='door')   # stable doors in the stone side
    m.box('clapboard', -.8, Rg - .3, -.8, .8, Rg + 1.2, .8, skip=('bottom',))                      # cupola
    with m.at(y=Rg + 1.2): m.cyl('roofWood', 1.25, 0, 0, 1.0, seg=4, cap=False, phase=math.pi / 4)
    return m


def church():
    """white frame church, gable to the front, square tower and spire over the door, tall side windows"""
    m = Model('church'); W, D, E, Rg = 9.0, 15.0, 6.2, 10.0
    foundation(m, W, D, .6); m.house_body(W, D, E, Rg, 'clapboard', along='z'); m.gable_roof(W, D, E, Rg, mat='roofShingle', along='z')
    for z in (-4.5, -1.0, 2.5):
        for sx, n in ((-1, L), (1, Rt)): m.window(sx * W / 2, 3.4, z, 1.0, 2.8, n)
    m.box('clapboard', -1.7, 0, D / 2 - 1.2, 1.7, 12.0, D / 2 + 1.8, skip=('bottom',))            # tower
    m.door(0, .6, D / 2 + 1.8, 1.4, 2.6, F); m.window(0, 6.4, D / 2 + 1.8, .9, 1.6, F); m.window(0, 9.6, D / 2 + 1.8, .7, .9, F, panes=False)
    m.box('trim', -2.0, 12.0, D / 2 - 1.5, 2.0, 12.3, D / 2 + 2.1, skip=('bottom',))
    m.box('clapboard', -1.4, 12.3, D / 2 - .9, 1.4, 14.6, D / 2 + 1.5, skip=('bottom',))           # belfry
    for n, x, z in ((F, 0, D / 2 + 1.5), (B, 0, D / 2 - .9), (L, -1.4, D / 2 + .3), (Rt, 1.4, D / 2 + .3)): m.door(x, 12.7, z, 1.2, 1.5, n, mat='window')
    with m.at(z=D / 2 + .3, y=14.6): m.cyl('roofShingle', 2.0, 0, 0, 7.5, seg=4, cap=True, phase=math.pi / 4)   # spire
    return m


def store():
    """two-storey general store: gable end to the street hidden behind a square false front, shop windows, porch"""
    m = Model('store'); W, D, E, Rg = 8.0, 12.0, 6.4, 8.6
    foundation(m, W, D, .4); m.house_body(W, D, E, Rg, 'clapboardGrey', along='z'); m.gable_roof(W, D, E, Rg, over=.25, mat='roofTin', along='z')
    m.box('facade', -W / 2 - .3, 0, D / 2, W / 2 + .3, 9.4, D / 2 + .25, skip=('bottom',))
    m.box('trim', -W / 2 - .5, 9.2, D / 2 - .05, W / 2 + .5, 9.7, D / 2 + .45, skip=('bottom',))  # cornice
    m.panel('woodDark', (-2.6, 7.2, D / 2 + .3), (2.6, 7.2, D / 2 + .3), (2.6, 8.4, D / 2 + .3), (-2.6, 8.4, D / 2 + .3), (0, 0, 1))   # sign board
    for x in (-2.5, 2.5): m.window(x, 1.9, D / 2 + .25, 2.0, 2.0, F)
    m.door(0, .4, D / 2 + .25, 1.3, 2.4, F)
    for x in (-2.5, 0, 2.5): m.window(x, 5.2, D / 2 + .25, .8, 1.3, F)
    for z in (-3.5, 0.5): m.window(-W / 2, 4.9, z, .8, 1.2, L); m.window(W / 2, 4.9, z, .8, 1.2, Rt)
    m.box('wood', -W / 2 - .3, 0, D / 2 + .25, W / 2 + .3, .4, D / 2 + 2.6, skip=('bottom',))
    for x in (-4.1, -1.4, 1.4, 4.1): m.box('trim', x - .09, .4, D / 2 + 2.3, x + .09, 3.3, D / 2 + 2.48)
    m.slab('roofTin', (-W / 2 - .4, 3.65, D / 2 + .3), (W / 2 + .4, 3.65, D / 2 + .3), (W / 2 + .4, 3.15, D / 2 + 2.85), (-W / 2 - .4, 3.15, D / 2 + 2.85), .12)
    return m


def brick_house():
    """Federal-style brick town house: five bays, chimneys in the gable ends, stoop"""
    m = Model('brick_house'); W, D, E, Rg = 9.5, 8.0, 6.8, 9.3
    foundation(m, W, D, .7, 'stoneDark'); m.house_body(W, D, E, Rg, 'brick'); m.gable_roof(W, D, E, Rg, over=.2, mat='roofShingle')
    for x in (-3.4, -1.7, 1.7, 3.4): m.window(x, 2.3, D / 2, .85, 1.5, F)
    for x in (-3.4, -1.7, 0, 1.7, 3.4): m.window(x, 5.1, D / 2, .85, 1.35, F)
    m.door(0, .7, D / 2, 1.1, 2.3, F); m.window(0, 3.35, D / 2, 1.0, .35, F, panes=False)        # door + transom
    for x in (-2.2, 2.2): m.window(x, 2.3, -D / 2, .85, 1.5, B); m.window(x, 5.1, -D / 2, .85, 1.35, B)
    for sx in (-1, 1):
        for z in (-2.2, 2.2): chimney(m, sx * (W / 2 - .45), z, .8, .9, E - .5, Rg + 1.0)
    m.box('stoneLight', -1.0, 0, D / 2, 1.0, .7, D / 2 + 1.3, skip=('bottom',))                   # stoop
    return m


def log_cabin():
    """log cabin: notched round logs, board gables, stone end chimney, one door, one small window"""
    m = Model('log_cabin'); W, D, r, n = 6.5, 5.0, .17, 9
    E = n * 2 * r * .92; Rg = E + 2.0
    for k in range(n):
        y = r + k * 2 * r * .92; off = r * .92 if k % 2 else 0
        for s in (1, -1): m.log('log', 'logEnd', -W / 2 - .3, W / 2 + .3, y + off * .0, s * D / 2, r)
        with m.at(ry=90):
            for s in (1, -1): m.log('log', 'logEnd', -D / 2 - .3, D / 2 + .3, y + r * .92, s * W / 2, r)
    m.prism([(-D / 2, E), (D / 2, E), (0, Rg)], -W / 2, W / 2, 'woodDark')
    m.gable_roof(W, D, E, Rg, over=.45, mat='roofWood')
    m.door(-.8, 0, D / 2 + r, 1.0, 2.0, F, mat='door', trim='woodDark'); m.window(1.6, 1.5, D / 2 + r, .7, .7, F, trim='woodDark')
    m.box('stone', W / 2 + .1, 0, -.9, W / 2 + 1.2, 2.2, .9, skip=('bottom',)); m.box('stone', W / 2 + .2, 2.2, -.55, W / 2 + .9, Rg + .7, .55, skip=('bottom',))
    return m


def grist_mill():
    """stone grist mill, 2.5 storeys, gable along Z, overshot water wheel on the +X side (the game turns +X toward the water)"""
    m = Model('grist_mill'); W, D, E, Rg = 10.0, 13.0, 8.2, 11.6
    m.house_body(W, D, E, Rg, 'stone', along='z'); m.gable_roof(W, D, E, Rg, over=.35, mat='roofWood', along='z')
    m.door(0, 0, D / 2, 1.6, 2.6, F, mat='door'); m.door(0, 4.6, D / 2, 1.4, 2.0, F, mat='door'); m.window(0, 9.0, D / 2, .8, 1.0, F)
    m.box('woodDark', -.15, 7.0, D / 2, .15, 7.3, D / 2 + 1.4)                                    # hoist beam
    for z in (-4.0, 0.0, 4.0):
        for y in (2.0, 5.4): m.window(-W / 2, y, z, .8, 1.1, L); m.window(W / 2, y, z, .8, 1.1, Rt)
    # overshot wheel: two rims, spokes, paddles; axle along X, wheel in the Y-Z plane, centre (x=W/2+1.0, y=3.6, z=0)
    cx, cy, R0, R1, seg = W / 2 + 1.0, 3.6, 3.0, 3.35, 18
    for x in (cx - .65, cx + .65):
        for k in range(seg):
            a0, a1 = k * 2 * math.pi / seg, (k + 1) * 2 * math.pi / seg
            P = lambda rr, a, xx=x: (xx, cy + rr * math.cos(a), rr * math.sin(a))
            m.quad('woodDark', P(R0, a0), P(R1, a0), P(R1, a1), P(R0, a1), centre=(x - (1 if x < cx else -1) * 9, cy, 0))
            m.quad('woodDark', P(R1, a0, x - .07), P(R1, a1, x - .07), P(R1, a1, x + .07), P(R1, a0, x + .07), centre=(x, cy, 0))
        for k in range(8):
            a = k * math.pi / 4
            m.quad('wood', (x - .06, cy, 0), (x + .06, cy, 0), (x + .06, cy + R0 * math.cos(a), R0 * math.sin(a)), (x - .06, cy + R0 * math.cos(a), R0 * math.sin(a)), centre=(x + 1, cy, 0))   # spoke
    for k in range(seg):
        a = (k + .5) * 2 * math.pi / seg; y, z = cy + R1 * math.cos(a), R1 * math.sin(a); ty, tz = -math.sin(a) * .35, math.cos(a) * .35
        m.quad('wood', (cx - .65, y - ty, z - tz), (cx + .65, y - ty, z - tz), (cx + .65, y + ty - math.cos(a) * .45, z + tz - math.sin(a) * .45), (cx - .65, y + ty - math.cos(a) * .45, z + tz - math.sin(a) * .45), centre=(cx, cy, 0))
    m.box('iron', W / 2, cy - .15, -.15, cx + .9, cy + .15, .15)                                      # axle
    m.box('wood', cx - .75, cy + R1 + .2, -D / 2 - 3, cx + .75, cy + R1 + .45, .3, mats={'top': 'water'})   # flume (head race) on trestle
    for z in (-D / 2 - 2.5, -D / 2 + 1, -3.0): m.box('woodDark', cx - .1, 0, z - .1, cx + .1, cy + R1 + .2, z + .1)
    return m


def stone_bridge():
    """three-arch stone bridge, 34 m long (x), 6.6 m wide, flat deck; ends sink below ground. The game lays it along the road."""
    m = Model('stone_bridge'); Lh, Wd, deck, spring, rise, half = 17.0, 3.3, 5.0, .4, 3.4, 4.0
    centres = (-9.0, 0.0, 9.0); xs = [round(-Lh + i * .5, 3) for i in range(int(2 * Lh / .5) + 1)]
    def arch(x):
        for c in centres:
            if abs(x - c) < half: return spring + rise * math.sqrt(max(0.0, 1 - ((x - c) / half) ** 2))
        return -1.5 if abs(x) > 13.5 else spring - 2.0
    yb = [arch(x) for x in xs]; yt = [deck] * len(xs)
    m.strip_solid(xs, yb, yt, -Wd, Wd, 'stone', bottom_mat='stoneDark', top_mat='roadDirt')
    for c in centres:                                                                               # arch rings, slightly proud
        ax = [c - half + i * half / 8 for i in range(17)]
        for s in (1, -1): m.strip_solid(ax, [arch(x) for x in ax], [arch(x) + .5 for x in ax], s * Wd, s * (Wd + .12), 'stoneDark')
    for s in (1, -1):
        m.box('stoneLight', -Lh, deck, s * Wd - (.5 if s > 0 else 0), Lh, deck + .9, s * Wd + (0 if s > 0 else .5))   # parapets
        for c in (-4.5, 4.5):                                                                         # cutwaters on the piers
            m.prism([(s * Wd, -1.5), (s * (Wd + 1.4), -1.5), (s * Wd, spring + 1.2)] if s > 0 else [(s * (Wd + 1.4), -1.5), (s * Wd, -1.5), (s * Wd, spring + 1.2)], c - .9, c + .9, 'stoneDark')
    return m


def earthwork():
    """one 10 m section of an earthen parapet (front = +Z faces the enemy): gentle glacis, firing step, log revetment inside"""
    m = Model('earthwork'); Lh = 5.0
    m.prism([(-2.4, 0), (3.6, 0), (1.0, 1.9), (-.8, 2.05), (-2.0, 1.1)], -Lh, Lh, 'earth', cap='earth', side_mats=['earth', 'grassDry', 'earth', 'earthDark', 'earthDark'])
    for y in (.35, .85, 1.35): m.log('log', 'logEnd', -Lh, Lh, y, -2.2 + y * .1, .22)
    return m


def wedge_tent():
    """army wedge (A) tent, door to the front"""
    m = Model('wedge_tent'); W, D = 2.4, 2.9
    m.house_body(W, D, .12, 2.1, 'canvas', along='z')
    m.tri('canvasDark', (-.55, .02, D / 2 + .03), (.55, .02, D / 2 + .03), (0, 1.6, D / 2 + .03), centre=(0, .8, 0))
    m.box('woodDark', -.05, 0, D / 2 + .05, .05, 2.35, D / 2 + .15); m.box('woodDark', -.05, 0, -D / 2 - .15, .05, 2.35, -D / 2 - .05)
    return m


def haystack():
    m = Model('haystack')
    m.cyl('hay', 1.8, 1.9, 0, 1.4, seg=10, cap=False); m.cyl('hayDark', 1.9, 0.25, 1.4, 4.0, seg=10, cap=False)
    m.box('woodDark', -.06, 3.8, -.06, .06, 4.6, .06)
    return m


def well():
    m = Model('well')
    m.cyl('stone', .85, .85, 0, .85, seg=10, cap=True, cap_mat='water')
    for x in (-.75, .75): m.box('woodDark', x - .07, .8, -.07, x + .07, 2.3, .07)
    m.box('woodDark', -.9, 1.85, -.05, .9, 1.95, .05)
    m.gable_roof(1.8, 1.4, 2.2, 2.8, over=.15, t=.08, mat='roofWood')
    return m


def shed():
    """open-front shed / smithy with a lean-to roof and a woodpile inside"""
    m = Model('shed'); W, D, Hb, Hf = 4.5, 3.2, 2.9, 2.3
    m.box('woodGrey', -W / 2, 0, -D / 2, W / 2, Hb, -D / 2 + .12, skip=('bottom',))
    for sx in (-1, 1): m.prism([(-D / 2, 0), (D / 2, 0), (D / 2, Hf), (-D / 2, Hb)], sx * W / 2 - .06, sx * W / 2 + .06, 'woodGrey')
    m.slab('roofWood', (-W / 2 - .3, Hb + .15, -D / 2 - .3), (W / 2 + .3, Hb + .15, -D / 2 - .3), (W / 2 + .3, Hf + .05, D / 2 + .4), (-W / 2 - .3, Hf + .05, D / 2 + .4), .1)
    for k, y in enumerate((.18, .5, .82, 1.14)):
        with m.at(x=-1.0 + (k % 2) * .17, ry=90):
            for j in range(4): m.log('log', 'logEnd', -D / 2 + .3, -D / 2 + 1.5, y, -.6 + j * .36, .17, seg=5)
    return m


MODELS = {f.__name__: f for f in (farmhouse, barn, church, store, brick_house, log_cabin, grist_mill, stone_bridge, earthwork, wedge_tent, haystack, well, shed)}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name in (sys.argv[1:] or MODELS):
        m = MODELS[name](); path = os.path.join(OUT, name + '.glb'); m.save_glb(path, PAL)
        print(f'{name:14s} {m.stats():6d} tris  {os.path.getsize(path):7d} bytes  -> {os.path.relpath(path, ROOT)}')
