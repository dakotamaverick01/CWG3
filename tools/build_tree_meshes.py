#!/usr/bin/env python3
"""Bake three Kenney Nature Kit (CC0) meshes into assets/art/tree_meshes.js (base64, no loader needed, works on file://).

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

def main(folder):
    out = {}
    for key, (glb, cols) in MESHES.items():
        p, n, mats, idx = load_glb(os.path.join(folder, glb + '.glb'))
        lo, hi = p.min(0), p.max(0); h = hi[1] - lo[1]
        p = p - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]); p /= h
        col = np.array([cols[m] for m in mats], dtype=np.float64)
        col = (srgb_to_lin(col) * 255).round().astype(np.uint8)
        out[key] = {'src': glb, 'n': len(p), 'tris': len(idx) // 3, 'w': round(float(max(hi[0] - lo[0], hi[2] - lo[2]) / h), 3),
                    'p': b64(p.astype(np.float32)), 'nm': b64(n.astype(np.float32)), 'c': b64(col), 'i': b64(idx.astype(np.uint16))}
        print(key, glb, 'verts', len(p), 'tris', len(idx) // 3, 'width/height', out[key]['w'])
    dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'art', 'tree_meshes.js')
    with open(dst, 'w') as f:
        f.write("'use strict';\n// Baked from Kenney Nature Kit (CC0, https://kenney.nl/assets/nature-kit) by tools/build_tree_meshes.py. Do not edit by hand.\n")
        f.write('CW.TREEMESH = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    print('wrote', os.path.normpath(dst), os.path.getsize(dst), 'bytes')

if __name__ == '__main__':
    main(sys.argv[1])
