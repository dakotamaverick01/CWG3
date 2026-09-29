# Builds a quick contact sheet (poses × directions) on a grass-coloured background for review.
import json, sys
from PIL import Image
m = json.loads(open('assets/sprites/units.js').read()[len('window.SPRITES='):-2])
men = Image.open('assets/sprites/men.png'); guns = Image.open('assets/sprites/guns.png')
uni = sys.argv[1] if len(sys.argv) > 1 else 'us'; dirs = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '0,1,2,3,4,5').split(',')]
C = m['men']['cell']; poses = m['poses']; sc = 2
out = Image.new('RGBA', (len(poses) * C * sc, len(dirs) * C * sc), (118, 140, 76, 255))
for j, d in enumerate(dirs):
    for i, p in enumerate(poses):
        x, y = m['men']['frames'][f'{uni}/{p}/{d}']; t = men.crop((x, y, x + C, y + C)).resize((C * sc, C * sc), Image.LANCZOS)
        out.alpha_composite(t, (i * C * sc, j * C * sc))
out.convert('RGB').save(f'/tmp/sheet_{uni}.jpg', quality=80)
G = m['guns']['cell']; gout = Image.new('RGBA', (6 * G, 3 * G), (118, 140, 76, 255))
for d in range(6):
    for k, s in enumerate(['unl', 'fire', 'lim']):
        x, y = m['guns']['frames'][f'napoleon/{s}/{d}']; gout.alpha_composite(guns.crop((x, y, x + G, y + G)), (d * G, k * G))
gout.convert('RGB').save('/tmp/sheet_guns.jpg', quality=80)
