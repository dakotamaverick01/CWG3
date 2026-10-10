#!/usr/bin/env python3
"""Pack every 3D model listed in assets/models/MANIFEST.json into assets/art/models.js (CW.MODELS).

Usage:  python3 -I tools/bake_models.py           (about a second; no downloads, everything it needs is in the repo)

Why a .js file: play.html is opened by double-click (file://), where browsers refuse to load .glb files. So every model is
stored as base64 inside a script. Each model becomes {p: positions, nm: normals, c: colours (linear 0-255), i: indices,
w, h, d, n, tris, src} and is drawn with one flat colour per material, lit by the game's low western sun.

What it does per model:
  1. reads the .glb/.gltf (only geometry; textures are ignored, colours come from materials)
  2. colour per material: MANIFEST 'colors' -> palette.json entry of the same name -> the file's own base colour -> grey
  3. size: 'meters' keeps real size; 'height' scales to height 1; 'length' scales to length 1 along X
  4. 'ao': darkens toward the ground and varies each face's colour a few percent so flat walls don't look like plastic
It also writes assets/models/CREDITS.md from the manifest, so credits never get forgotten.
"""
import base64, json, os, struct, sys
import numpy as np

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
MDIR = os.path.join(ROOT, 'assets', 'models')
DEFAULT_COL = (112, 106, 96)


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb255(c):
    c = np.clip(np.asarray(c, dtype=np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255


def node_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    m = np.eye(4)
    if 'scale' in n: m = np.diag(list(n['scale']) + [1.0]) @ m
    if 'rotation' in n:
        x, y, z, w = n['rotation']
        r = np.array([[1 - 2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1 - 2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1 - 2*(x*x+y*y)]])
        rm = np.eye(4); rm[:3, :3] = r; m = rm @ m
    if 'translation' in n:
        t = np.eye(4); t[:3, 3] = n['translation']; m = t @ m
    return m


def read_gltf(path):
    """returns (json, [buffer bytes...]) for .glb or .gltf (embedded data: URIs or .bin next to it)"""
    raw = open(path, 'rb').read()
    if raw[:4] == b'glTF':
        jl, _ = struct.unpack('<II', raw[12:20]); j = json.loads(raw[20:20 + jl]); off = 20 + jl
        bl, _ = struct.unpack('<II', raw[off:off + 8]); return j, [raw[off + 8:off + 8 + bl]]
    j = json.loads(raw); bufs = []
    for b in j.get('buffers', []):
        uri = b.get('uri', '')
        bufs.append(base64.b64decode(uri.split(',', 1)[1]) if uri.startswith('data:') else open(os.path.join(os.path.dirname(path), uri), 'rb').read())
    return j, bufs


def load(path):
    """all triangles in the default scene, world-transformed: positions, normals, material name per vertex, indices"""
    j, bufs = read_gltf(path)
    def acc(i):
        a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
        n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
        dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a['componentType']]
        o = v.get('byteOffset', 0) + a.get('byteOffset', 0); stride = v.get('byteStride', 0); size = np.dtype(dt).itemsize * n
        b = bufs[v.get('buffer', 0)]
        if stride and stride != size:
            return np.stack([np.frombuffer(b, dtype=dt, count=n, offset=o + k * stride) for k in range(a['count'])])
        return np.frombuffer(b, dtype=dt, count=a['count'] * n, offset=o).reshape(a['count'], n)
    mats = j.get('materials', [])
    P, N, C, I, base = [], [], [], [], 0
    def walk(ni, parent):
        nonlocal base
        n = j['nodes'][ni]; m = parent @ node_matrix(n)
        if 'mesh' in n:
            for prim in j['meshes'][n['mesh']]['primitives']:
                if prim.get('mode', 4) != 4: continue
                mi = prim.get('material'); mat = mats[mi] if mi is not None else {}
                p = acc(prim['attributes']['POSITION']).astype(np.float64)
                idx = acc(prim['indices']).reshape(-1).astype(np.int64) if 'indices' in prim else np.arange(len(p))
                used = np.unique(idx); remap = np.full(len(p), -1, np.int64); remap[used] = np.arange(len(used))   # keep only this primitive's vertices
                p = p[used]; idx = remap[idx]
                p = (np.c_[p, np.ones(len(p))] @ m.T)[:, :3]
                if 'NORMAL' in prim['attributes']:
                    nn = acc(prim['attributes']['NORMAL']).astype(np.float64)[used] @ np.linalg.inv(m[:3, :3]).T
                else:                                                   # no normals in the file: flat-shade it
                    tri = idx.reshape(-1, 3); p = p[tri.reshape(-1)]; idx = np.arange(len(p))
                    fn = np.cross(p[1::3] - p[0::3], p[2::3] - p[0::3]); nn = np.repeat(fn, 3, axis=0)
                nn /= np.maximum(np.linalg.norm(nn, axis=1, keepdims=True), 1e-9)
                P.append(p); N.append(nn); C.extend([mat] * len(p)); I.append(idx + base); base += len(p)
        for c in n.get('children', []): walk(c, m)
    for r in j['scenes'][j.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    extras = {}
    for n in j.get('nodes', []): extras.update(n.get('extras', {}))
    return np.vstack(P), np.vstack(N), C, np.concatenate(I), extras


def pattern_of(mat, spec, patterns):
    """shader surface pattern id for this material (palette '_patterns'); 0 = plain"""
    name = mat.get('name', '')
    if name in spec.get('patterns', {}): return spec['patterns'][name]
    want = spec.get('colors', {}).get(name, name)
    return patterns.get(want, 0) if isinstance(want, str) else 0


def colour_of(mat, spec, palette):
    name = mat.get('name', '')
    want = spec.get('colors', {}).get(name, name)
    if isinstance(want, list): return tuple(want)
    if want in palette: return tuple(palette[want])
    bc = mat.get('pbrMetallicRoughness', {}).get('baseColorFactor')
    if bc: return tuple(lin_to_srgb255(bc[:3]))
    return DEFAULT_COL


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def bake_one(key, spec, palette, patterns):
    p, n, mats, idx, extras = load(os.path.join(MDIR, 'src', spec['src']))
    lo, hi = p.min(0), p.max(0); norm = spec.get('norm', 'meters')
    if norm in ('height', 'length'):
        ref = (hi[1] - lo[1]) if norm == 'height' else (hi[0] - lo[0])
        p = (p - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) / ref
    else: ref = 1.0
    col = srgb_to_lin(np.array([colour_of(m, spec, palette) for m in mats], dtype=np.float64))
    if spec.get('ao'):
        H = hi[1] - max(lo[1], 0.0); y = np.clip(p[:, 1], 0, None); k = min(2.4, .35 * H)
        t = np.clip(y / k, 0, 1); t = t * t * (3 - 2 * t); col *= (.64 + .36 * t)[:, None]                # darker at the foot of walls
        rng = np.random.default_rng(sum(map(ord, key)))                                                     # same variation every bake
        tri = idx.reshape(-1, 3); jit = 1 + (rng.random(len(tri)) - .5) * .08                            # +-4% per face
        f = np.ones(len(p)); f[tri[:, 0]] = jit; f[tri[:, 1]] = jit; f[tri[:, 2]] = jit; col *= f[:, None]
    col = (np.clip(col, 0, 1) * 255).round().astype(np.uint8)
    kk = np.array([pattern_of(m, spec, patterns) for m in mats], dtype=np.uint8)
    assert len(p) < 65536, f'{key}: too many vertices ({len(p)}) for 16-bit indices'
    W, Hh, D = (hi - lo) / ref
    return {'src': os.path.basename(spec['src']).rsplit('.', 1)[0], 'n': len(p), 'tris': len(idx) // 3, 'norm': norm,
            'w': round(float(max(W, D)), 3), 'h': round(float(Hh), 3), 'd': round(float(D), 3), 'x': round(float(W), 3),
            'p': b64(p.astype(np.float32)), 'nm': b64(n.astype(np.float32)), 'c': b64(col), 'i': b64(idx.astype(np.uint16)), **({'k': b64(kk)} if kk.any() else {}), **({'smoke': extras['smoke']} if extras.get('smoke') and norm == 'meters' else {})}


def main():
    man = json.load(open(os.path.join(MDIR, 'MANIFEST.json')))
    pj = json.load(open(os.path.join(MDIR, 'palette.json'))); palette = {k: v for k, v in pj.items() if not k.startswith('_')}; patterns = pj.get('_patterns', {})
    out, total = {}, 0
    for key, spec in man['models'].items():
        out[key] = bake_one(key, spec, palette, patterns); total += out[key]['tris']
        print(f"{key:13s} {spec['src']:32s} {out[key]['norm']:6s} tris {out[key]['tris']:5d}  w/h/d {out[key]['w']} {out[key]['h']} {out[key]['d']}")
    dst = os.path.join(ROOT, 'assets', 'art', 'models.js')
    with open(dst, 'w') as f:
        f.write("'use strict';\n// Every 3D model in the game, baked from assets/models/MANIFEST.json by tools/bake_models.py. Do not edit by hand.\n")
        f.write('CW.MODELS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
        f.write('CW.TREEMESH = CW.EDGEMESH = CW.STRUCTMESH = CW.MODELS;   // older names used by world_trees.js / world_edges.js\n')
    print(f'wrote {os.path.relpath(dst, ROOT)}  {os.path.getsize(dst)} bytes, {len(out)} models, {total} triangles')
    lines = ['# 3D model credits (generated by tools/bake_models.py from MANIFEST.json, do not edit)', '', '| Model | File | Source | Licence |', '|---|---|---|---|']
    for key, spec in man['models'].items():
        s = man['sources'][spec['credit']]; lines.append(f"| {key} | {spec['src']} | {s['title']}{' ' + s['url'] if s['url'] else ''} | {s['license']} |")
    open(os.path.join(MDIR, 'CREDITS.md'), 'w').write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
