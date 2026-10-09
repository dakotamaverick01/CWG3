#!/usr/bin/env python3
"""Bake Kenney Nature Kit (CC0) meshes into base64 JS files (no loader needed, works on file://):
  assets/art/tree_meshes.js (3 trees, WORLD T2) and assets/art/edge_meshes.js (rail fence + 2 stones for walls, WORLD T4).

Usage: python3 -I tools/build_tree_meshes.py "<folder with the kit's 'Models/GLTF format'>"
Download the kit from https://kenney.nl/assets/nature-kit (CC0). The kit itself is NOT stored in the repo, only these 3 baked meshes.
Each mesh is normalised: base centred at x/z = 0 on y = 0, height scaled to exactly 1 (the game scales it to pixels),
with one flat colour per Kenney material (our own summer palette, so trees match the painted world instead of the kit's bright cartoon green).
"""
import base64, json, struct, sys, os
import numpy as np

MESHES = {  # name -> (glb, {material-name: sRGB colour})
    'broadleaf': ('tree_oak', {'leafsGreen': (58, 96, 40), 'woodBark': (88, 64, 42)}),
    'pine':      ('tree_pineTallA', {'leafsDark': (30, 66, 42), 'woodBarkDark': (78, 56, 38)}),
    'bush':      ('plant_bush', {'grass': (66, 104, 44)}),
}

EDGE_MESHES = {  # fence + stones (walls are rows of stones along a hex edge); normalised so the x-extent = 1 (length), base at y = 0
    'fence':  ('fence_simple',     {'wood': (126, 92, 56), 'woodDark': (86, 62, 40)}),
    'stoneA': ('stone_largeA',     {'dirt': (118, 110, 98), 'grass': (88, 100, 62)}),
    'stoneB': ('stone_smallFlatA', {'dirt': (124, 116, 104), 'grass': (92, 104, 66)}),
}
STRUCT_H = {  # WORLD T5 structures, normalised to height 1 (the game scales them to pixels); canvas = our own off-white, not the kit's red
    'tent':      ('tent_detailedClosed', {'colorRed': (176, 164, 136), 'colorRedDark': (126, 116, 94), 'wood': (96, 70, 46)}),
    'tentOpen':  ('tent_detailedOpen',   {'colorRed': (170, 158, 130), 'wood': (96, 70, 46)}),
    'tentSmall': ('tent_smallClosed',    {'colorRed': (164, 152, 126), 'colorRedDark': (118, 108, 88), 'wood': (96, 70, 46), '_defaultMat': (96, 70, 46)}),
    'logs':      ('log_stack',           {'woodBark': (92, 66, 42), 'woodInner': (170, 136, 92)}),
    'logsBig':   ('log_stackLarge',      {'woodBark': (92, 66, 42), 'woodInner': (170, 136, 92), 'woodDark': (70, 50, 34)}),
    'log':       ('log_large',           {'woodBark': (92, 66, 42), 'woodInner': (170, 136, 92)}),
    'fire':      ('campfire_stones',     {'stone': (112, 106, 98)}),
    'sign':      ('sign',                {'wood': (126, 92, 56), 'woodDark': (86, 62, 40), '_defaultMat': (86, 62, 40)}),
    'rows':      ('crops_dirtDoubleRow', {'dirtDark': (84, 62, 40), 'dirt': (108, 82, 54)}),
    'stump':     ('stump_roundDetailed', {'woodBark': (92, 66, 42), 'woodInner': (170, 136, 92)}),
    'platform':  ('platform_stone',      {'stoneDark': (96, 90, 82), 'stone': (124, 118, 106)}),
    'rockA':     ('rock_largeA',         {'dirt': (116, 108, 96), 'grass': (86, 98, 60)}),
    'rockC':     ('rock_largeC',         {'dirt': (112, 104, 92), 'grass': (86, 98, 60)}),
}
STRUCT_L = {  # normalised so the x-extent = 1 (length)
    'bridge': ('bridge_wood',      {'woodBark': (88, 64, 42), 'wood': (140, 104, 64), 'stone': (112, 106, 98)}),
    'stepRocks': ('ground_riverRocks', {'dirtDark': (70, 54, 36), 'grass': (86, 98, 60), 'dirt': (108, 88, 60), 'stone': (124, 118, 106), 'water': (70, 100, 108)}),
}
DEFAULT_COL = (112, 106, 96)

def srgb_to_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def node_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    m = np.eye(4)
    if 'scale' in n:
        m = np.diag(list(n['scale']) + [1.0]) @ m
    if 'rotation' in n:
        x, y, z, w = n['rotation']
        r = np.array([[1 - 2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                      [2*(x*y+z*w), 1 - 2*(x*x+z*z), 2*(y*z-x*w)],
                      [2*(x*z-y*w), 2*(y*z+x*w), 1 - 2*(x*x+y*y)]])
        rm = np.eye(4); rm[:3, :3] = r; m = rm @ m
    if 'translation' in n:
        t = np.eye(4); t[:3, 3] = n['translation']; m = t @ m
    return m

def load_glb(path):
    b = open(path, 'rb').read()
    jl, _ = struct.unpack('<II', b[12:20]); j = json.loads(b[20:20 + jl])
    off = 20 + jl; bl, _ = struct.unpack('<II', b[off:off + 8]); bin_ = b[off + 8:off + 8 + bl]
    def acc(i):
        a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
        n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a['componentType']]
        o = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(bin_, dtype=dt, count=a['count'] * n, offset=o).reshape(a['count'], n)
    P, N, C, I = [], [], [], []
    base = 0
    def walk(ni, parent):
        nonlocal base
        n = j['nodes'][ni]; m = parent @ node_matrix(n)
        if 'mesh' in n:
            for prim in j['meshes'][n['mesh']]['primitives']:
                mat = j['materials'][prim['material']]['name']
                p = acc(prim['attributes']['POSITION']).astype(np.float64)
                nn = acc(prim['attributes']['NORMAL']).astype(np.float64)
                p = (np.c_[p, np.ones(len(p))] @ m.T)[:, :3]
                nn = nn @ np.linalg.inv(m[:3, :3]).T
                nn /= np.maximum(np.linalg.norm(nn, axis=1, keepdims=True), 1e-9)
                idx = acc(prim['indices']).reshape(-1).astype(np.int64)
                P.append(p); N.append(nn); C.extend([mat] * len(p)); I.append(idx + base); base += len(p)
        for c in n.get('children', []):
            walk(c, m)
    for r in j['scenes'][j.get('scene', 0)]['nodes']:
        walk(r, np.eye(4))
    return np.vstack(P), np.vstack(N), C, np.concatenate(I)

def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()

def bake(folder, meshes, by):
    out = {}
    for key, (glb, cols) in meshes.items():
        p, n, mats, idx = load_glb(os.path.join(folder, glb + '.glb'))
        lo, hi = p.min(0), p.max(0)
        ref = (hi[1] - lo[1]) if by == 'height' else (hi[0] - lo[0])
        p = p - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]); p /= ref
        col = np.array([cols.get(m, DEFAULT_COL) for m in mats], dtype=np.float64)
        col = (srgb_to_lin(col) * 255).round().astype(np.uint8)
        out[key] = {'src': glb, 'n': len(p), 'tris': len(idx) // 3, 'w': round(float(max(hi[0] - lo[0], hi[2] - lo[2]) / ref), 3),
                    'h': round(float((hi[1] - lo[1]) / ref), 3), 'd': round(float((hi[2] - lo[2]) / ref), 3),
                    'p': b64(p.astype(np.float32)), 'nm': b64(n.astype(np.float32)), 'c': b64(col), 'i': b64(idx.astype(np.uint16))}
        print(key, glb, 'verts', len(p), 'tris', len(idx) // 3, 'w/h/d', out[key]['w'], out[key]['h'], out[key]['d'])
    return out

def write(out, name, var):
    dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'art', name)
    with open(dst, 'w') as f:
        f.write("'use strict';\n// Baked from Kenney Nature Kit (CC0, https://kenney.nl/assets/nature-kit) by tools/build_tree_meshes.py. Do not edit by hand.\n")
        f.write(var + ' = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    print('wrote', os.path.normpath(dst), os.path.getsize(dst), 'bytes')

def main(folder):
    write(bake(folder, MESHES, 'height'), 'tree_meshes.js', 'CW.TREEMESH')
    write(bake(folder, EDGE_MESHES, 'length'), 'edge_meshes.js', 'CW.EDGEMESH')
    st = bake(folder, STRUCT_H, 'height'); st.update(bake(folder, STRUCT_L, 'length'))
    write(st, 'struct_meshes.js', 'CW.STRUCTMESH')

if __name__ == '__main__':
    main(sys.argv[1])
