#!/usr/bin/env python3
"""Headless screenshots of CWG3 for checking visual work (cloud workspace: Playwright + /opt/pw-browsers/chromium, software GL).

Usage:
  python3 tools/shot.py OUTDIR c,r,zoom,tilt,name [c,r,zoom,tilt,name ...]   -> game views centred on hex (c, r)
  python3 tools/shot.py OUTDIR --gallery [dist]                              -> tools/model_gallery.html
Examples:
  python3 tools/shot.py /tmp/o 21,9,3.6,40,town 13,9,3.4,42,farm 18,6,4.2,40,wall
Notes:
  - Needs Playwright (pip3 install --user playwright pillow numpy). Run WITHOUT -I on the Mac (-I hides user-installed packages).
  - Extra views: 'bench' / 'bench,live' prints ms per frame; 'freeze,name' saves Living off/on frames to prove motion and freezing.
  - Starts a new battle as the Union, hides the roster, holds the camera (the game re-centres on units otherwise).
  - Software GL is slow (~0.3-1 s/frame): only RELATIVE timings mean anything; John's Mac is the real test.
  - Prints console warnings/errors at the end. Saves OUTDIR/<name>.png (full) and OUTDIR/<name>.jpg (map area only).
  - Living landscape usually switches itself off here (slow-frame guard); use CW.R3.snap(t, live) to test motion.
"""
import os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
CLOUD = '/opt/pw-browsers/chromium'   # cloud workspace browser (software GL); on John's Mac we use the installed Google Chrome (real GPU)
ARGS = (['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] if os.path.exists(CLOUD) else []) + ['--ignore-gpu-blocklist', '--allow-file-access-from-files']


def launch(p):
    if os.path.exists(CLOUD): return p.chromium.launch(executable_path=CLOUD, args=ARGS)
    return p.chromium.launch(channel='chrome', args=ARGS)


def main():
    out = sys.argv[1]; os.makedirs(out, exist_ok=True); views = sys.argv[2:]
    with sync_playwright() as p:
        b = launch(p)
        logs = []
        if views and views[0] == '--gallery':
            pg = b.new_page(viewport={'width': 1400, 'height': 900}); pg.on('console', lambda m: logs.append(m.type + ': ' + m.text[:200]))
            pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)[:200]))
            pg.goto('file://' + ROOT + '/tools/model_gallery.html'); pg.wait_for_timeout(3000)
            dist = views[1] if len(views) > 1 else '150'
            pg.evaluate(f"() => {{ document.getElementById('spin').click(); st.dist = {dist}; }}"); pg.wait_for_timeout(3000)
            pg.screenshot(path=os.path.join(out, 'gallery.png')); print('shot gallery.png')
        else:
            pg = b.new_page(viewport={'width': 1000, 'height': 640})
            pg.on('console', lambda m: logs.append(m.type + ': ' + m.text[:240])); pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)[:240]))
            pg.goto('file://' + ROOT + '/play.html'); pg.wait_for_timeout(4000)
            pg.get_by_text('New battle').first.click(); pg.wait_for_timeout(1000)
            pg.locator('select:visible').first.select_option(label='Union (valley, west)')
            pg.evaluate("() => { const b=[...document.querySelectorAll('button')].find(x=>x.offsetParent && /begin/i.test(x.textContent)); b.click(); }")
            pg.wait_for_timeout(15000)
            for v in views:
                if v.startswith('bench'):   # 'bench' or 'bench,live': ms per frame at the current view (relative numbers only)
                    print('bench', v, pg.evaluate(f"() => CW.R3.bench(30, {'true' if 'live' in v else 'false'})")); continue
                if v.startswith('freeze,'):   # 'freeze,name': saves name_off_a/b (Living off, t=1 and t=3) and name_on_b (Living on, t=3)
                    import base64; nm = v.split(',')[1]
                    for tag, t, live in (('off_a', 1, 'false'), ('off_b', 3, 'false'), ('on_b', 3, 'true')):
                        u = pg.evaluate(f"() => CW.R3.snap({t}, {live})"); open(os.path.join(out, f'{nm}_{tag}.png'), 'wb').write(base64.b64decode(u.split(',')[1]))
                    print('freeze shots', nm); continue
                c, r, z, tilt, name = v.split(',')
                pg.evaluate(f"""() => {{ CW.G.opts.roster = false; clearInterval(window.__h); CW.G.cam.z = {z}; CW.R3.tilt({tilt} - CW.R3.tiltDeg);
                    window.__h = setInterval(() => CW.centerOn({c}, {r}), 200); CW.centerOn({c}, {r}); }}""")
                pg.wait_for_timeout(6000); path = os.path.join(out, name + '.png'); pg.screenshot(path=path, timeout=170000)
                try:
                    from PIL import Image
                    Image.open(path).convert('RGB').crop((0, 36, 1000, 390)).save(os.path.join(out, name + '.jpg'), quality=86)
                except Exception: pass
                print('shot', name)
        print('\n'.join(l for l in logs if not l.startswith('log') and 'willReadFrequently' not in l and 'slow frames' not in l)[:2500])
        b.close()


if __name__ == '__main__':
    main()
