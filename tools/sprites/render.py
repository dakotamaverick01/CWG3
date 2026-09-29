# Renders the CWG3 unit sprite atlases with headless Chromium + three.js (see render.html).
import asyncio, base64, json, sys, os, threading, http.server, functools, socketserver
from playwright.async_api import async_playwright
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'sprites')
def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.dirname(os.path.abspath(__file__)))
    h.log_message = lambda *a: None
    s = socketserver.TCPServer(('127.0.0.1', 0), h); threading.Thread(target=s.serve_forever, daemon=True).start(); return s.server_address[1]
async def main():
    os.makedirs(OUT, exist_ok=True); port = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(f'http://127.0.0.1:{port}/render.html')
        await pg.wait_for_function('window.READY === true', timeout=20000)
        pg.set_default_timeout(300000); r = await pg.evaluate('window.RENDER()')
        man = {'uniforms': r['uniforms'], 'poses': r['poses']}
        for k in ('men', 'guns'):
            open(os.path.join(OUT, f'{k}.png'), 'wb').write(base64.b64decode(r[k]['png'].split(',')[1]))
            man[k] = {'img': f'assets/sprites/{k}.png', 'cell': r[k]['cell'], 'frames': r[k]['frames']}
        open(os.path.join(OUT, 'units.js'), 'w').write('window.SPRITES=' + json.dumps(man, separators=(',', ':')) + ';\n')
        print('errors:', errs[:5]); await b.close()
asyncio.run(main())
