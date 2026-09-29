#!/usr/bin/env python3
"""CWG3 art intake: turns raw AI-generated sheets in assets/incoming/ into game-ready art.

  python3 tools/intake.py            # process everything listed in SHEETS below
  python3 tools/intake.py --review   # also write assets/art/review_*.jpg contact sheets

Ground sheets (2x2 painted texture variants): borders trimmed, lighting flattened,
made seamless (tile without visible edges), saved 512px.
Prop sheets (objects on a magenta background): magenta removed ("chroma key"),
pink fringe removed ("despill"), drop shadows kept as soft black, text labels
dropped, each object cut out, named, and packed into one atlas image.
Output: assets/art/ground/*.jpg, assets/art/props/*.png, assets/art/art.js
(art.js embeds everything as data URIs so play.html still works by double-click).
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INC = os.path.join(ROOT, 'assets', 'incoming')
OUT = os.path.join(ROOT, 'assets', 'art')

# ---- what each incoming file is -------------------------------------------------
GROUND = {  # file -> texture name (4 variants each)
    '01_Rocky_ground.jpg': 'rocky', '02_Burned_field.jpg': 'burned',
    '03_Farmyard_earth.jpg': 'farmyard', '04_Trampled_mud.jpg': 'mud',
    '23_Road_textures.jpg': 'road', '24_Water_textures.jpg': 'water', '26_Parchment_textures.jpg': 'ui',   # batch 2: road/water fills + UI surfaces
    '16_Wheat_field.jpg': 'wheat', '17_Corn_field.jpg': 'corn',   # batch 2: crop ground (2x2 top-down variants)
    # batch 3 (27 Sep, John via Gemini/Grok): summer meadow sets (A realistic, B painterly, C painterly square) + far countryside for beyond the board edge
    'batch3/29a_Summer_ground.jpg': 'sga', 'batch3/29b_Summer_ground.jpg': 'sgb', 'batch3/29c_Summer_ground.jpg': 'sgc',   # _0 meadow+flowers, _1 grazed/worn, _2 tall hay, _3 trampled mud
    # batch 4 (28 Sep): slopes/rock for hills, summer crops (_0 corn, _1 wheat, _2 cut hay windrows, _3 plowed)
    'batch4/46a_Slopes_rock.jpg': 'slpa', 'batch4/46b_Slopes_rock.jpg': 'slpb',   # _0 grass + red clay, _1 limestone, _2 scree, _3 creek-bank mud
    'batch4/49a_Summer_crops.jpg': 'crpa', 'batch4/49b_Summer_crops.jpg': 'crpb',
    'batch3/30a_Countryside_far.jpg': 'fara', 'batch3/30b_Countryside_far.jpg': 'farb', 'batch3/30c_Countryside_far.jpg': 'farc', 'batch3/30d_Countryside_far.jpg': 'fard',   # _0 patchwork fields, _1 forest canopy, _2 pasture+trees, _3 wood edge
}
PROPS = {  # file -> (prefix, names in reading order, options)
    '05_Stone_walls.jpg': ('wall', ['long', 'short', 'corner', 'short2', 'broken', 'rubble', 'mossy', 'gate', 'tree'], {'fieldstone': True, 'warm': True}),
    '06_Fences.jpg': ('fence', ['worm_a', 'worm_short', 'worm_b', 'worm_gate', 'worm_c', 'post', 'post_b', 'post_gate', 'broken'], {'warm': True}),
    '07_Village_buildings.jpg': ('bldg', ['mill', 'church', 'smithy', 'store', 'tavern', 'school', 'tollhouse', 'frame_house', 'brick_house'], {'labels': True}),
    '07_Village_buildings_retry.jpg': ('bldg', ['mill_b', 'church_b', 'smithy_b', 'store_b', 'tavern_b', 'school_b', 'tollhouse_b', 'frame_house_b', 'brick_house_b'], {'labels': True}),
    '08_Bridges_and_ruins.jpg': ('ruin', ['arch_bridge', 'plank_bridge', 'covered_bridge', 'burned_house', 'collapsed_house', 'stone_pen', 'chimney', 'fence', 'rubble'], {}),
    '08_Bridges_and_ruins_retry.jpg': ('ruin', ['arch_bridge_b', 'plank_bridge_b', 'covered_bridge_b', 'burned_house_b', 'collapsed_house_b', 'stone_pen_b', 'chimney_b', 'fence_b', 'rubble_b'], {}),
    '09_Field_clutter.jpg': ('clut', ['haystack', 'sheaves', 'woodpile', 'wagon', 'trough', 'well', 'graveyard', 'boulder', 'stump'], {}),
    '10_Confederate_battalion_test.jpg': ('cs', ['line_a', 'line_b', 'column', 'skirmish'], {'grid': (2, 2)}),
    # batch 2 (27 Sep, Grok via Chrome) - 3x3 on magenta, light from upper left
    '11_Trees.jpg': ('tree', ['oak', 'oak_young', 'oak_gnarled', 'hickory', 'elm', 'sycamore', 'maple', 'pine', 'dead'], {'warm': True}),
    '12_Woods_orchard.jpg': ('wood', ['clump_a', 'clump_b', 'clump_c', 'orchard_row', 'apple', 'peach', 'thicket', 'woodlot_edge', 'cedar'], {'warm': True}),
    # facings: NE (3/4 away), E (side), SE (3/4 toward); game mirrors for NW / W / SW
    '13_CS_facings.jpg': ('csf', ['line_ne', 'line_e', 'line_se', 'col_ne', 'col_e', 'col_se', 'routed', 'skirmish', 'firing'], {}),
    '14_US_facings.jpg': ('usf', ['line_ne', 'line_e', 'line_se', 'col_ne', 'col_e', 'col_se', 'routed', 'skirmish', 'firing'], {}),
    # walls: 'diag' runs upper-left -> lower-right (flip for the other slant), 'vert' runs away from the viewer
    '15_Fieldstone_walls.jpg': ('fsw', ['diag', 'diag_mossy', 'diag_broken', 'vert', 'vert_gate', 'short', 'corner', 'rubble', 'diag_end'], {}),
    # batch 2 units (same NE/E/SE facing convention; game mirrors for NW/W/SW)
    '18_CS_cavalry.jpg': ('cscav', ['line_ne', 'line_e', 'line_se', 'col_ne', 'col_e', 'col_se', 'charge', 'dismounted', 'routed'], {}),
    '19_US_cavalry.jpg': ('uscav', ['line_ne', 'line_e', 'line_se', 'col_ne', 'col_e', 'col_se', 'charge', 'dismounted', 'routed'], {}),
    '20_Officers.jpg': ('ofc', ['cs_gen_ne', 'cs_gen_e', 'cs_gen_se', 'us_gen_ne', 'us_gen_e', 'us_gen_se', 'cs_col', 'us_col', 'courier'], {}),
    '21_CS_artillery.jpg': ('csart', ['gun_ne', 'gun_e', 'gun_se', 'limber_ne', 'limber_e', 'limber_se', 'firing', 'wrecked', 'caisson'], {}),
    '22_US_artillery.jpg': ('usart', ['gun_ne', 'gun_e', 'gun_se', 'limber_ne', 'limber_e', 'limber_se', 'firing', 'wrecked', 'caisson'], {}),
    '25_Creek_road_props.jpg': ('wx', ['footbridge', 'ford_stones', 'reeds', 'fallen_log', 'bank_rocks', 'cattails', 'signpost', 'milestone', 'culvert'], {}),
    '27_UI_frames.jpg': ('ui', ['panel', 'slip', 'banner', 'button', 'button_down', 'seal', 'corner', 'divider', 'portrait_frame'], {}),
    # batch 3 (27 Sep): summer trees (5 sheets for variety), winter trees, military features. Same view/light convention.
    'batch3/28a_Summer_trees.jpg': ('sta', ['oak', 'poplar', 'maple', 'clump', 'pine', 'hickory', 'apple', 'oak_young', 'thicket'], {'warm': True, 'ratio': True}),
    'batch3/28b_Summer_trees.jpg': ('stb', ['oak', 'poplar', 'maple', 'clump', 'pine', 'hickory', 'apple', 'oak_young', 'thicket'], {'warm': True, 'ratio': True}),
    'batch3/28c_Summer_trees.jpg': ('stc', ['oak', 'elm', 'pine', 'dogwood', 'ash', 'maple', 'sassafras', 'magnolia', 'cedar'], {'warm': True, 'ratio': True}),
    'batch3/28d_Summer_trees.jpg': ('std', ['elm', 'oak', 'pine', 'magnolia', 'sycamore', 'maple', 'willow', 'dogwood', 'walnut'], {'warm': True, 'ratio': True}),
    'batch3/28e_Summer_trees.jpg': ('ste', ['oak', 'pine', 'poplar', 'dogwood', 'maple', 'red_maple', 'ash', 'sumac', 'magnolia'], {'warm': True, 'ratio': True}),
    'batch3/41_Winter_trees.jpg': ('wt', ['oak', 'poplar', 'maple', 'clump', 'pine', 'cedars', 'apple', 'thicket'], {'warm': True, 'ratio': True, 'depink': True}),
    'batch3/39_Military_features.jpg': ('mil', ['rail_diag', 'rail_vert', 'redoubt', 'rifle_pits', 'abatis', 'haystacks', 'burned_house', 'rail_pile'], {'warm': True, 'ratio': True}),
    # batch 4 (28 Sep, daytime summer): effects on black, objects on white (+ one magenta ground-detail sheet)
    'batch4/31_Musket_smoke.jpg': ('fxs', ['dense', 'soft', 'big', 'wispy', 'swirl', 'streak', 'puff', 'ring', 'drift'], {'bg': 'black'}),
    'batch4/32_Cannon_smoke_dust.jpg': ('fxc', ['cannon_a', 'cannon_b', 'cannon_c', 'dust_a', 'dust_b', 'dust_c', 'dirt_burst', 'fire_column', 'haze'], {'bg': 'black'}),
    'batch4/33_Flashes_fire.jpg': ('fxf', ['flash_up', 'flash_right', 'flash_diag', 'blast_a', 'blast_b', 'blast_c', 'shell_burst', 'campfire', 'sparks'], {'bg': 'black'}),
    'batch4/48a_Ground_details_magenta.jpg': ('gda', ['flowers', 'thistle', 'clover', 'boulders', 'stump', 'log', 'puddle', 'ruts', 'flagstones'], {'warm': True, 'ratio': True}),
    'batch4/48b_Ground_details.jpg': ('gdb', ['lichen_rocks', 'bush', 'sapling', 'bramble', 'fire_ring', 'broken_fence', 'stump_mud', 'trough', 'meadow_patch'], {'bg': 'white'}),
    'batch4/48c_Ground_details.jpg': ('gdc', ['oak', 'mossy_rocks', 'berry_bush', 'woodpile', 'wagon_ruts', 'well', 'corn_patch', 'campfire_out', 'ferns'], {'bg': 'white'}),
    'batch4/38a_Landmarks.jpg': ('lma', ['church', 'mill', 'covered_bridge', 'cemetery', 'depot', 'smithy', 'barn', 'cabin', 'tavern'], {'bg': 'white'}),
    'batch4/38b_Landmarks_hastext.jpg': ('lmb', ['cabin', 'frame_house', 'mansion', 'store', 'smithy', 'church', 'barn', 'school', 'mill'], {'bg': 'white'}),
    'batch4/38c_Landmarks_hastext.jpg': ('lmc', ['cabin', 'farmhouse', 'plantation', 'red_barn', 'smithy', 'store', 'church', 'mill', 'school'], {'bg': 'white'}),
    'batch4/38d_Landmarks.jpg': ('lmd', ['cabin', 'two_story', 'barn', 'store', 'church', 'smithy', 'farmhouse', 'school', 'cabin_small'], {'bg': 'white'}),
    'batch4/38e_Farm_buildings.jpg': ('lme', ['cabin', 'red_barn', 'corn_crib', 'smokehouse', 'smithy', 'shed_pen', 'well', 'wagon_shed', 'root_cellar'], {'bg': 'white'}),
    'batch4/50_Thin_props.jpg': ('tp', ['telegraph', 'telegraph_row', 'flagpole', 'oak_young', 'signpost', 'gate', 'well', 'pump', 'trough'], {'bg': 'white'}),
}
PROP_SCALE = 0.5   # stored at half the generated size (drawn smaller still on the map)


# ---- ground ---------------------------------------------------------------------
def trim_border(a):
    """Cut white gutters / frames around a quadrant."""
    g = a.mean(2)
    def bad(v, s): return v > 215 or s < 6
    t, b, l, r = 0, a.shape[0], 0, a.shape[1]
    while t < b - 10 and bad(g[t].mean(), g[t].std()): t += 1
    while b > t + 10 and bad(g[b - 1].mean(), g[b - 1].std()): b -= 1
    while l < r - 10 and bad(g[:, l].mean(), g[:, l].std()): l += 1
    while r > l + 10 and bad(g[:, r - 1].mean(), g[:, r - 1].std()): r -= 1
    m = 6  # safety margin for soft frame edges
    return a[t + m:b - m, l + m:r - m]


def flatten_light(a, strength=0.75):
    """Remove big light/shadow gradients so the texture repeats without stripes."""
    blur = np.stack([ndi.gaussian_filter(a[..., k], a.shape[0] / 10) for k in range(3)], 2)
    return a - (blur - blur.mean((0, 1))) * strength


def make_seamless(a):
    """Two passes (x then y): blend each edge band with a half-rolled copy whose own seam sits
    in the middle, where the original is used untouched."""
    s = a.shape[0]
    t = np.clip(np.minimum(np.arange(s), s - 1 - np.arange(s)) / (s * .2), 0, 1)
    rng = np.random.default_rng(3)  # wobble the blend edge so it does not read as a cross-fade
    for axis in (1, 0):
        nz = ndi.gaussian_filter(rng.random((s, s)), 14); nz = (nz - nz.min()) / (np.ptp(nz) + 1e-6) - .5
        m = (t[None, :] if axis == 1 else t[:, None]) * np.ones((s, s))
        m = np.clip(m + nz * .6 * (m > 0) * (m < 1), 0, 1)
        m = (m * m * (3 - 2 * m))[..., None]
        a = a * m + np.roll(a, s // 2, axis) * (1 - m)
    return a


def do_ground(fn, name):
    im = np.asarray(Image.open(os.path.join(INC, fn)).convert('RGB')).astype(np.float32)
    h, w = im.shape[:2]
    out = []
    for i, (y, x) in enumerate([(0, 0), (0, 1), (1, 0), (1, 1)]):
        q = trim_border(im[y * h // 2:(y + 1) * h // 2, x * w // 2:(x + 1) * w // 2])
        n = min(q.shape[:2]); q = q[:n, :n]
        q = np.asarray(Image.fromarray(np.clip(q, 0, 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS)).astype(np.float32)
        q = make_seamless(flatten_light(q))
        img = Image.fromarray(np.clip(q, 0, 255).astype(np.uint8))
        p = os.path.join(OUT, 'ground', f'{name}_{i}.jpg'); img.save(p, quality=84)
        out.append((f'{name}_{i}', p))
    return out


# ---- props ----------------------------------------------------------------------
def key_magenta(a, ratio=False):
    """Return RGBA float array: magenta background removed, shadows kept as translucent black."""
    rgb = a.astype(np.float32)
    edge = np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3), rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3)])
    bg = np.median(edge, 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    chroma_bg = min(bg[0], bg[2]) - bg[1]
    mag = np.clip((np.minimum(r, b) - g) / max(chroma_bg, 1), 0, 1.5)        # 1 = as magenta as the bg
    if ratio:   # batch 3: darker purple cast shadows are still background -> judge by hue ratio, not raw chroma
        rr = (np.minimum(r, b) - g) / (np.maximum(r, b) + 20); rbg = (min(bg[0], bg[2]) - bg[1]) / (max(bg[0], bg[2]) + 20)
        mag = np.maximum(mag, np.clip(rr / max(rbg, 1e-3), 0, 1.5))
        lum0 = rgb @ [.3, .59, .11]; painted_sh = (b - g > 8) & (r - g > 25) & (lum0 < 150)   # shadows painted as opaque dark maroon
        mag = np.where(painted_sh, np.maximum(mag, 1.0), mag)
    fg = 1 - np.clip((mag - .30) / .40, 0, 1)                                   # foreground alpha
    lum = rgb @ [.3, .59, .11]; lbg = bg @ [.3, .59, .11]
    shadow = np.clip((1 - lum / lbg) * 1.3, 0, .75) * (1 - fg)                  # dark magenta = cast shadow
    # despill: pull the magenta cast out of edge pixels
    spill = np.clip(np.minimum(r, b) - g, 0, None) * np.clip(1.6 - fg, 0, 1)
    rgb2 = rgb.copy(); rgb2[..., 0] -= spill; rgb2[..., 2] -= spill
    alpha = fg + shadow
    col = np.where(fg[..., None] > 1e-3, rgb2 * (fg / np.maximum(alpha, 1e-3))[..., None], 0)
    if ratio:   # shadows (mostly background) become a neutral cool dark instead of dark magenta
        w = np.clip((.65 - fg) / .45, 0, 1)[..., None]; col = col * (1 - w) + np.array([28, 30, 36], np.float32) * w
    return np.dstack([np.clip(col, 0, 255), np.clip(alpha, 0, 1) * 255]), fg


def key_light(a):
    """White/grey background (batch 4+): remove only background connected to the image edge (white inside objects
    survives); light grey cast shadows touching that background become translucent neutral shade."""
    rgb = a.astype(np.float32); edge = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    bg = np.median(edge, 0); lbg = bg @ [.3, .59, .11]
    lum = rgb @ [.3, .59, .11]; sat = rgb.max(2) - rgb.min(2)
    cand = (np.abs(rgb - bg).max(2) < 26)                                            # background-coloured
    shad = (sat < 22) & (lum < lbg - 8) & (lum > lbg * .62)                           # soft neutral cast shadow
    lab, n = ndi.label(cand | shad)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    conn = np.isin(lab, list(border))
    bgm = conn & cand; shm = conn & shad & ~cand
    fg = (~(bgm | shm)).astype(np.float32)
    fg = np.clip(ndi.gaussian_filter(fg, .7) * 1.15, 0, 1) * fg + (1 - fg) * 0          # slightly soft edge, no halo growth
    shadow = np.where(shm, np.clip((1 - lum / lbg) * 1.6, 0, .6), 0)
    alpha = np.maximum(fg, shadow)
    col = np.where(fg[..., None] > .5, rgb, np.array([30, 32, 38], np.float32))
    return np.dstack([col, alpha * 255]), fg


def key_black(a):
    """Black background (smoke, flashes, fire): brightness -> transparency, colour un-premultiplied.
    White grid gutters touching the border are removed first."""
    rgb = a.astype(np.float32); lum = rgb.max(2); sat = rgb.max(2) - rgb.min(2)
    white = (rgb.min(2) > 190) & (sat < 30); lab, n = ndi.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    gut = ndi.binary_dilation(np.isin(lab, list(border)), iterations=3)
    alpha = np.clip((lum - 14) / 200, 0, 1); alpha[gut] = 0
    col = np.clip(rgb / np.maximum(alpha, .05)[..., None], 0, 255)
    return np.dstack([col, alpha * 255]), np.clip(alpha * 3, 0, 1)


def fieldstone(rgba, fg):
    """Recolor orange brick walls to weathered grey fieldstone (keeps moss greens)."""
    c = rgba[..., :3]; l = c @ [.3, .59, .11]
    grey = np.dstack([l * 1.02, l * 1.0, l * .95])
    warm = np.clip((c[..., 0] - c[..., 1]) / 60, 0, 1)[..., None]              # only the orange parts
    rgba[..., :3] = c * (1 - .8 * warm) + grey * (.8 * warm)
    return rgba


def is_text(comp_mask, rgb):
    ys, xs = np.nonzero(comp_mask)
    if len(ys) == 0: return True
    hgt = ys.max() - ys.min() + 1
    px = rgb[ys, xs]
    bright = px.mean() > 175 and (px.max(1) - px.min(1)).mean() < 60
    return hgt < 48 and bright


def slice_objects(rgba, fg, opts):
    H, W = fg.shape
    solid = fg > .5
    lab, n = ndi.label(solid)
    if opts.get('labels'):  # drop the white caption letters under each building
        for i, sl in enumerate(ndi.find_objects(lab), 1):
            m = lab[sl] == i
            if is_text(m, rgba[sl][..., :3]): solid[sl][m] = False
    # group pieces by the sheet's grid cell (Grok lays sheets out as a 3x3 or 2x2 grid),
    # so rubble / broken fences stay one object and close neighbours never merge
    gr, gc = opts.get('grid', (3, 3))
    lab, n = ndi.label(ndi.binary_dilation(solid, iterations=3))
    cells = {}
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        m = (lab[sl] == i) & solid[sl]
        if m.sum() < 150: continue
        ys, xs = np.nonzero(m)
        cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
        cell = (min(gr - 1, int(cy / H * gr)), min(gc - 1, int(cx / W * gc)))
        cells.setdefault(cell, []).append(i)
    ordered = []
    for cell in sorted(cells):
        region = np.isin(lab, cells[cell])
        if (region & solid).sum() >= 1200: ordered.append(region)
    out = []
    alpha_all = rgba[..., 3]
    for region in ordered:
        # include this object's shadow: nearby translucent pixels
        keep = ndi.binary_dilation(region, iterations=10)
        a = np.where(keep, alpha_all, 0)
        if opts.get('labels'):
            a = np.where(keep & ~solid & (fg > .5), 0, a)                      # removed text
        ys, xs = np.nonzero(a > 8)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = np.dstack([rgba[y0:y1, x0:x1, :3], a[y0:y1, x0:x1]])
        # anchor = bottom-centre of the solid object (where it touches the ground)
        sy, sx = np.nonzero(solid[y0:y1, x0:x1] & region[y0:y1, x0:x1])
        anchor = (float(np.median(sx)) / crop.shape[1], float(sy.max()) / crop.shape[0])
        out.append((crop, anchor))
    return out


def do_props(fn, prefix, names, opts):
    im = np.asarray(Image.open(os.path.join(INC, fn)).convert('RGB'))
    bgk = opts.get('bg', 'magenta')
    if bgk in ('white', 'grey'): rgba, fg = key_light(im)
    elif bgk == 'black': rgba, fg = key_black(im)
    else: rgba, fg = key_magenta(im, opts.get('ratio', False))
    if opts.get('fieldstone'): rgba = fieldstone(rgba, fg)
    if opts.get('warm'):  # kill the purple cast magenta light leaves in wood shadows
        c = rgba[..., :3]; c[..., 2] = np.minimum(c[..., 2], c[..., 1] * 1.02 + 6); c[..., 0] = np.maximum(c[..., 0], c[..., 2])
    if opts.get('depink'):  # winter twigs soaked in magenta -> bark brown / grey
        c = rgba[..., :3]; pk = np.clip((np.minimum(c[..., 0], c[..., 2]) - c[..., 1] + 8) / 18, 0, 1)
        l = c @ [.3, .59, .11]; brown = np.dstack([l * 1.08, l * .98, l * .86]); rgba[..., :3] = c * (1 - pk[..., None]) + brown * pk[..., None]
    objs = slice_objects(rgba, fg, opts)
    if len(objs) != len(names):
        print(f'  ! {fn}: found {len(objs)} objects, expected {len(names)} — names may be off')
    res = []
    for k, (crop, anchor) in enumerate(objs):
        nm = f'{prefix}_{names[k]}' if k < len(names) else f'{prefix}_extra{k}'
        img = Image.fromarray(crop.astype(np.uint8), 'RGBA')
        img = img.resize((max(1, round(img.width * PROP_SCALE)), max(1, round(img.height * PROP_SCALE))), Image.LANCZOS)
        p = os.path.join(OUT, 'props', nm + '.png'); img.save(p)
        res.append((nm, img, anchor))
    return res


def pack(items, width=1024, pad=2):
    """Shelf-pack images into one atlas."""
    items = sorted(items, key=lambda t: -t[1].height)
    x = y = sh = 0; pos = {}
    for nm, img, anc in items:
        if x + img.width + pad > width: x = 0; y += sh + pad; sh = 0
        pos[nm] = (x, y, img.width, img.height, round(anc[0], 3), round(anc[1], 3))
        x += img.width + pad; sh = max(sh, img.height)
    atlas = Image.new('RGBA', (width, y + sh), (0, 0, 0, 0))
    for nm, img, _ in items: atlas.paste(img, pos[nm][:2])
    return atlas, pos


def data_uri(img, fmt):
    b = io.BytesIO()
    if fmt == 'jpeg': img.convert('RGB').save(b, 'JPEG', quality=84)
    else: img.save(b, 'PNG', optimize=True)
    return f'data:image/{fmt};base64,' + base64.b64encode(b.getvalue()).decode()


def contact(paths, fn, bg=(120, 110, 80)):
    ims = [(os.path.basename(p), Image.open(p).convert('RGBA')) for p in paths]
    cw = 260; cols = 6; rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * cw), bg)
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for i, (n, im) in enumerate(ims):
        im.thumbnail((cw - 10, cw - 26)); x, y = (i % cols) * cw, (i // cols) * cw
        sheet.paste(im, (x + 5, y + 20), im); d.text((x + 5, y + 4), n, fill='white')
    sheet.save(os.path.join(OUT, fn), quality=80)


def main():
    for d in ('ground', 'props'): os.makedirs(os.path.join(OUT, d), exist_ok=True)
    ground, props = {}, []
    for fn, name in GROUND.items():
        if os.path.exists(os.path.join(INC, fn)):
            print('ground', fn)
            for nm, p in do_ground(fn, name): ground[nm] = p
    for fn, (prefix, names, opts) in PROPS.items():
        if os.path.exists(os.path.join(INC, fn)):
            print('props ', fn); props += do_props(fn, prefix, names, opts)
    atlas, frames = pack(props)
    atlas.save(os.path.join(OUT, 'props_atlas.png'), optimize=True)
    js = {'ground': {k: data_uri(Image.open(p), 'jpeg') for k, p in ground.items()},
          'props': {'img': data_uri(atlas, 'png'), 'frames': frames}}
    with open(os.path.join(OUT, 'art.js'), 'w') as f:
        f.write('// generated by tools/intake.py — do not edit by hand\nwindow.ART=' + json.dumps(js) + ';\n')
    print(f'{len(ground)} ground textures, {len(props)} props, atlas {atlas.size}, art.js {os.path.getsize(os.path.join(OUT, "art.js")) // 1024} KB')
    if '--review' in sys.argv:
        contact(sorted(ground.values()), 'review_ground.jpg')
        contact([os.path.join(OUT, 'props', n + '.png') for n, _, _ in props], 'review_props.jpg')


if __name__ == '__main__':
    main()
