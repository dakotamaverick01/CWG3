#!/usr/bin/env python3
"""CWG3 scenery + portrait intake (batch 3+).

  python3 tools/intake_scenery.py [--review]

Skies (wide paintings): left/right edges cross-faded so the sky can wrap around the horizon.
Paintings (title, camp): cropped/cleaned (the AI sometimes paints a fake artist signature: crop it off).
Portrait grids: split into single faces (white gutters detected), labels painted out, 192px squares.
Output: assets/art/scenery/*.jpg, assets/art/portraits/*.jpg, assets/art/scenery.js
(window.SCENERY = {sky: {...}, paint: {...}, portraits: {cs: [...], us: [...]}} as data URIs, so double-click still works).
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image
import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INC = os.path.join(ROOT, 'assets', 'incoming')
OUT = os.path.join(ROOT, 'assets', 'art')

SKIES = {  # file -> name   (time of day: dawn / day / golden / dusk / night)
    'batch3/35a_Sky_day.jpg': 'day_a', 'batch3/35b_Sky_day.jpg': 'day_b', 'batch3/36a_Sky_golden.jpg': 'golden_a',
}
PAINTINGS = {  # file -> (name, crop box as fractions l, t, r, b)
    'batch3/44_Title_painting.jpg': ('title', (0, 0, 1, 1)),
    'batch3/45_Camp_painting.jpg': ('camp', (0, 0, 1, .94)),   # bottom strip holds a fake signature
}
PORTRAITS = {  # file -> (side, grid cols, rows, paint out labels)
    'batch3/42b_Portraits_CS.jpg': ('cs', 3, 3, False),
    'batch3/42a_Portraits_CS_4x4.jpg': ('cs', 4, 4, False),
    'batch4/52_Portraits_CS_varied.jpg': ('cs', 3, 3, False),
    'batch3/43b_Portraits_US.jpg': ('us', 3, 3, False),
    'batch3/43a_Portraits_US_labeled.jpg': ('us', 3, 3, True),
}


def wrap_sky(im, frac=.12):
    a = np.asarray(im.convert('RGB')).astype(np.float32); w = a.shape[1]; o = int(w * frac)
    t = np.linspace(0, 1, o)[None, :, None]
    out = a[:, :w - o].copy(); out[:, :o] = a[:, w - o:] * (1 - t) + a[:, :o] * t   # right edge flows into the left edge
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def cells(a, cols, rows):
    """Split a grid on its white gutters; falls back to even division."""
    g = a.mean(2); h, w = g.shape
    def spans(prof, n, size):
        white = prof > 232; cuts = []; i = 0
        while i < size:
            if white[i]:
                j = i
                while j < size and white[j]: j += 1
                cuts.append((i, j)); i = j
            else: i += 1
        edges = [0] + [(a0 + b0) // 2 for a0, b0 in cuts if 0 < a0 and b0 < size] + [size]
        if len(edges) - 1 != n: edges = [round(k * size / n) for k in range(n + 1)]
        return list(zip(edges[:-1], edges[1:]))
    return [(x0, y0, x1, y1) for y0, y1 in spans(g.mean(1), rows, h) for x0, x1 in spans(g.mean(0), cols, w)]


def trim(a):
    g = a.mean(2); keep = g < 232
    ys, xs = np.where(keep)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1] if len(ys) else a


def paint_out_label(a):
    """White text in the top-left corner (e.g. '25yo') -> inpainted with the background."""
    h, w = a.shape[:2]; m = np.zeros((h, w), np.uint8)
    box = a[:int(h * .2), :int(w * .38)]; txt = (box.min(2) > 170).astype(np.uint8) * 255
    m[:box.shape[0], :box.shape[1]] = cv2.dilate(txt, np.ones((5, 5), np.uint8), iterations=2)
    return cv2.inpaint(a, m, 7, cv2.INPAINT_TELEA)


def square(a, size=192):
    h, w = a.shape[:2]; s = min(h, w); y = 0 if h > w else 0; x = (w - s) // 2   # keep the top of the head
    return Image.fromarray(a[y:y + s, x:x + s]).resize((size, size), Image.LANCZOS)


def uri(img, q=84):
    b = io.BytesIO(); img.convert('RGB').save(b, 'JPEG', quality=q); return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def main():
    for d in ('scenery', 'portraits'): os.makedirs(os.path.join(OUT, d), exist_ok=True)
    js = {'sky': {}, 'paint': {}, 'portraits': {'cs': [], 'us': []}}
    for fn, name in SKIES.items():
        if not os.path.exists(os.path.join(INC, fn)): continue
        im = wrap_sky(Image.open(os.path.join(INC, fn))); im.save(os.path.join(OUT, 'scenery', f'sky_{name}.jpg'), quality=88); js['sky'][name] = uri(im, 86)
    for fn, (name, (l, t, r, b)) in PAINTINGS.items():
        if not os.path.exists(os.path.join(INC, fn)): continue
        im = Image.open(os.path.join(INC, fn)).convert('RGB'); W, H = im.size; im = im.crop((int(l * W), int(t * H), int(r * W), int(b * H)))
        im.save(os.path.join(OUT, 'scenery', f'{name}.jpg'), quality=88); js['paint'][name] = uri(im, 86)
    for fn, (side, c, r, lab) in PORTRAITS.items():
        if not os.path.exists(os.path.join(INC, fn)): continue
        a = np.asarray(Image.open(os.path.join(INC, fn)).convert('RGB'))
        for (x0, y0, x1, y1) in cells(a, c, r):
            p = trim(a[y0:y1, x0:x1]).copy()
            if lab: p = paint_out_label(p)
            k = len(js['portraits'][side]); img = square(p); img.save(os.path.join(OUT, 'portraits', f'{side}_{k:02d}.jpg'), quality=88)
            js['portraits'][side].append(uri(img, 82))
    with open(os.path.join(OUT, 'scenery.js'), 'w') as f:
        f.write('// generated by tools/intake_scenery.py — do not edit by hand\nwindow.SCENERY=' + json.dumps(js) + ';\n')
    print(f"skies {len(js['sky'])}, paintings {len(js['paint'])}, portraits CS {len(js['portraits']['cs'])} / US {len(js['portraits']['us'])}, scenery.js {os.path.getsize(os.path.join(OUT, 'scenery.js')) // 1024} KB")
    if '--review' in sys.argv:
        fs = sorted(os.listdir(os.path.join(OUT, 'portraits'))); cw = 96; cols = 13; rows = (len(fs) + cols - 1) // cols
        S = Image.new('RGB', (cols * cw, rows * cw), (40, 30, 20))
        for i, f in enumerate(fs): S.paste(Image.open(os.path.join(OUT, 'portraits', f)).resize((cw - 4, cw - 4)), ((i % cols) * cw + 2, (i // cols) * cw + 2))
        S.save(os.path.join(OUT, 'review_portraits.jpg'), quality=82)


if __name__ == '__main__':
    main()
