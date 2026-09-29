"""Unit figure kit (R2, 27 Sep): cuts single figures out of the Gemini sheets in assets/incoming/kit,
recolours them per side (Union = strong blue, Confederate = grey coat + butternut trousers),
and packs them into assets/art/kit.js (window.KIT, one embedded PNG + frame table).
Run:  python3 tools/build_kit.py   (add --review for a contact sheet in _review/kit_review.png)"""
import sys, os, json, base64, io, colorsys
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE); from intake import key_magenta
SRC = os.path.join(ROOT, 'assets/incoming/kit')
# name: (sheet, component, target height px, native facing R/L, recolour source side)
PARTS = {
  # infantry (US sheet 21 = clean 3x3; 24 = same poses with smoke; CS = recoloured)
  'stand':   {'US': ('00', 3, 'US'), 'CS': ('15', 2, 'CS'), 'h': 96,  'dir': 'R'},
  'march':   {'US': ('21', 3, 'US'), 'CS': ('21', 3, 'toCS'), 'h': 96, 'dir': 'R'},
  'march2':  {'US': ('21', 2, 'US'), 'CS': ('21', 2, 'toCS'), 'h': 96, 'dir': 'R'},
  'bearer':  {'US': ('21', 1, 'US'), 'CS': ('21', 1, 'toCS'), 'h': 112, 'dir': 'R'},
  'fire':    {'US': ('21', 4, 'US'), 'CS': ('21', 4, 'toCS'), 'h': 92, 'dir': 'R'},
  'kneel':   {'US': ('21', 6, 'US'), 'CS': ('21', 6, 'toCS'), 'h': 68, 'dir': 'R'},
  'kneel2':  {'US': ('21', 5, 'US'), 'CS': ('21', 5, 'toCS'), 'h': 70, 'dir': 'R'},
  'load':    {'US': ('24', 7, 'US'), 'CS': ('24', 7, 'toCS'), 'h': 70, 'dir': 'R'},
  'charge':  {'US': ('21', 8, 'US'), 'CS': ('21', 8, 'toCS'), 'h': 86, 'dir': 'R'},
  'officer': {'US': ('21', 7, 'US'), 'CS': ('21', 7, 'toCS'), 'h': 100, 'dir': 'R'},
  'drum':    {'US': ('21', 9, 'US'), 'CS': ('21', 9, 'toCS'), 'h': 88, 'dir': 'R'},
  # generals (old sheets 12/13)
  'rider':   {'US': ('12', 1, 'US'), 'CS': ('13', 1, 'CS'), 'h': 150, 'dir': 'R'},
  # cavalry troopers (US sheet 22, CS sheet 23 - matched poses)
  'walk':    {'US': ('22', 2, 'US'), 'CS': ('23', 5, 'CS'), 'h': 130, 'dir': 'R'},
  'trot':    {'US': ('22', 3, 'US'), 'CS': ('23', 6, 'CS'), 'h': 130, 'dir': 'R'},
  'gallop':  {'US': ('22', 1, 'US'), 'CS': ('23', 4, 'CS'), 'h': 136, 'dir': 'R'},
  'rback':   {'US': ('22', 7, 'US'), 'CS': ('23', 8, 'CS'), 'h': 130, 'dir': 'R'},
  'guidon':  {'US': ('22', 8, 'US'), 'CS': ('23', 9, 'CS'), 'h': 150, 'dir': 'R'},
  'horse':   {'US': ('22', 11, 'US'), 'CS': ('23', 12, 'CS'), 'h': 104, 'dir': 'R'},
  # artillery (CS sheet 20 native; Union = recoloured grey -> blue)
  'gun':     {'US': ('20', 1, 'toUS'), 'CS': ('20', 1, 'CS'), 'h': 130, 'dir': 'R'},
  'gunfire': {'US': ('20', [2, 3], 'toUS'), 'CS': ('20', [2, 3], 'CS'), 'h': 130, 'dir': 'R', 'noX': .6},
  'limber':  {'US': ('20', 5, 'toUS'), 'CS': ('20', 5, 'CS'), 'h': 110, 'dir': 'R'},
  'limback': {'US': ('20', 4, 'toUS'), 'CS': ('20', 4, 'CS'), 'h': 120, 'dir': 'R'},
}
def cut(sheet, comp):
    a = np.array(Image.open(f'{SRC}/n{sheet}.jpg').convert('RGB')); rgba, fg = key_magenta(a)
    lab, _ = ndimage.label(fg > .5); objs = ndimage.find_objects(lab); cs = comp if isinstance(comp, list) else [comp]
    y0 = min(objs[c - 1][0].start for c in cs); y1 = max(objs[c - 1][0].stop for c in cs)
    x0 = min(objs[c - 1][1].start for c in cs); x1 = max(objs[c - 1][1].stop for c in cs); sl = (slice(y0, y1), slice(x0, x1))
    keep = ndimage.binary_dilation(np.isin(lab[sl], cs), iterations=2); r = rgba[sl].copy(); r[..., 3] *= keep
    return r
def blue_mask(r):
    R, G, B = r[..., 0], r[..., 1], r[..., 2]
    return ((B > R + 12) & (B >= G - 4) & (r[..., 3] > 20)).astype(np.float32)
def recolour(r, mode, noX=1.0):
    r = r.copy(); rgb = r[..., :3]; lum = rgb @ [.3, .59, .11]
    if mode in ('US',):   # push dark navy to a strong, clearly saturated Union blue
        m = blue_mask(r)[..., None]
        h = np.stack([lum * .55, lum * .85, np.minimum(255, lum * 1.9 + 40)], -1)
        r[..., :3] = rgb * (1 - m * .8) + h * m * .8
    elif mode == 'toCS':  # blue coat -> grey, light-blue trousers -> butternut
        m = blue_mask(r)[..., None]; trou = (lum > 92)[..., None]
        grey = np.stack([lum * 1.55 + 30] * 3, -1) * [1.0, 1.0, .97]
        butter = np.stack([lum * 1.45 + 20, lum * 1.2 + 12, lum * .75], -1)
        r[..., :3] = rgb * (1 - m) + np.where(trou, butter, grey) * m
    elif mode == 'toUS':  # grey coat -> Union blue, khaki trousers -> sky blue (gun, olive wheels, horses, skin untouched)
        R, G, B = [rgb[..., i] for i in range(3)]; mx, mn = rgb.max(-1), rgb.min(-1); sat = (mx - mn) / np.maximum(mx, 1)
        hue = np.array([colorsys.rgb_to_hsv(*p)[0] for p in (rgb.reshape(-1, 3) / 255)]).reshape(lum.shape) * 360
        live = (r[..., 3] > 20) & (np.arange(r.shape[1])[None, :] < r.shape[1] * noX)
        olive = (hue > 40) & (hue < 110) & (sat > .06)
        grey = live & (sat < .16) & (lum > 95) & (lum < 225) & ~olive
        khaki = live & (hue > 10) & (hue < 40) & (sat >= .12) & (sat < .42) & (lum > 88) & (R - G < 48)
        coat = np.stack([lum * .36, lum * .52, np.minimum(255, lum * 1.25 + 20)], -1)
        sky = np.stack([lum * .6, lum * .78, np.minimum(255, lum * 1.1 + 25)], -1)
        r[..., :3] = np.where(grey[..., None], coat, np.where(khaki[..., None], sky, rgb))
    # overall lift so figures read on the painted ground (gamma on colour, not alpha)
    r[..., :3] = 255 * (np.clip(r[..., :3], 0, 255) / 255) ** .82
    return np.clip(r, 0, 255)
def scaled(r, h):
    im = Image.fromarray(r.astype(np.uint8), 'RGBA'); w = max(1, round(im.width * h / im.height))
    return im.resize((w, h), Image.LANCZOS)
def main():
    frames, ims = {}, []
    for name, p in PARTS.items():
        for side in ('US', 'CS'):
            sh, comp, mode = p[side]; r = cut(sh, comp)
            if 'crop' in p: x0, y0, x1, y1 = p['crop']; H, W_ = r.shape[:2]; r = r[int(y0 * H):int(y1 * H), int(x0 * W_):int(x1 * W_)]; ys, xs = np.nonzero(r[..., 3] > 10); r = r[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            im = scaled(recolour(r, mode, p.get('noX', 1.0)), p['h']); ims.append((f'{side}_{name}', im, p['dir']))
    # simple shelf pack
    W = 1024; x = y = rowh = 0; pos = []
    for k, im, d in ims:
        if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
        pos.append((k, im, d, x, y)); x += im.width + 2; rowh = max(rowh, im.height)
    atlas = Image.new('RGBA', (W, y + rowh)); 
    for k, im, d, x, y in pos: atlas.paste(im, (x, y)); frames[k] = [x, y, im.width, im.height, d]
    buf = io.BytesIO(); atlas.save(buf, 'PNG', optimize=True)
    uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    out = os.path.join(ROOT, 'assets/art/kit.js')
    open(out, 'w').write('// generated by tools/build_kit.py - unit figure kit\nwindow.KIT = ' + json.dumps({'img': uri, 'frames': frames}) + ';\n')
    print('kit.js', round(os.path.getsize(out) / 1024), 'KB,', len(frames), 'frames, atlas', atlas.size)
    if '--review' in sys.argv:
        bg = Image.new('RGBA', atlas.size, (120, 110, 80, 255)); bg.alpha_composite(atlas); os.makedirs(os.path.join(ROOT, '_review'), exist_ok=True)
        bg.convert('RGB').save(os.path.join(ROOT, '_review/kit_review.png'))
main()
