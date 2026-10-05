# CWG3: Blender height frames -> normal-map flipbook atlas embedded as assets/art/water_flow.js
import numpy as np, base64, io, sys
from PIL import Image
F, COLS = 48, 8; ROWS = F // COLS; K = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
a = np.stack([np.asarray(Image.open(f'frames/h_{i:04d}.png')).astype(np.float32)/65535 for i in range(F)])
z = (a - a.mean()) / a.std(); H, W = z.shape[1:]
atlas = np.zeros((ROWS * H, COLS * W, 3), np.uint8)
for f in range(F):
    h = z[f]; dv = -(np.roll(h, -1, 0) - np.roll(h, 1, 0)) / 2; du = np.gradient(h, axis=1)
    n = np.stack([-du * K, -dv * K, np.ones_like(h)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    rgb = np.stack([0.5 + 0.5 * n[..., 0], 0.5 + 0.5 * n[..., 1], np.clip(0.5 + 0.2 * h, 0, 1)], -1)
    r, c = divmod(f, COLS); atlas[r*H:(r+1)*H, c*W:(c+1)*W] = (rgb * 255 + .5).astype(np.uint8)
im = Image.fromarray(atlas); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=92)
open('water_flow.js', 'w').write("'use strict';\n// Session 19: flowing-creek normal flipbook rendered in Blender 4.2 (tools/water/flow.py + atlas.py). 48 frames, 8x6 cells of 128x256.\n// RG = surface normal (x across, y downstream), B = height. Seamless along the flow and in time. Our own render, no outside assets.\nCW.WATERFLOW = { src: 'data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode() + "', frames: 48, cols: 8, rows: 6 };\n")
print('ok', im.size, buf.tell())
