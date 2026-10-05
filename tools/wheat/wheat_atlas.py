# CWG3: Blender wheat frames -> 8x6 colour flipbook (128 px cells) embedded as assets/art/wheat_flow.js
import numpy as np, base64, io
from PIL import Image
F, C, S = 48, 8, 128
fr = [Image.open(f'wheat/w_{i:04d}.png').convert('RGB').resize((S, S), Image.LANCZOS) for i in range(F)]
atlas = Image.new('RGB', (C * S, (F // C) * S))
for i, f in enumerate(fr): atlas.paste(f, ((i % C) * S, (i // C) * S))
a = np.asarray(atlas).astype(np.float32) / 255; avg = (a ** 2.2).reshape(-1, 3).mean(0)
buf = io.BytesIO(); atlas.save(buf, 'JPEG', quality=90)
open('wheat_flow.js', 'w').write("'use strict';\n// Session 19b: wheat field bending in the wind, rendered in Blender 4.2 (tools/wheat/wheat.py + wheat_atlas.py). 48 frames, 8x6 cells of 128 px.\n// Seamless tile, loops in time. avg = mean linear colour (the game multiplies the painted wheat by colour / avg). Our own render.\nCW.WHEATFLOW = { src: 'data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode() + "', frames: 48, cols: 8, rows: 6, avg: [%.4f, %.4f, %.4f] };\n" % tuple(avg))
print(atlas.size, buf.tell(), avg)
