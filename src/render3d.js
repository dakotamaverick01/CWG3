'use strict';
// 2.5D battlefield (visual-polish part 1). The painted map is draped over the height data and lit by a low sun.
// Three layers: (1) this WebGL ground, (2) map markings drawn by game.js onto a transparent "decal" canvas that is laid
// over the hills, (3) units drawn by game.js on the normal 2D canvas on top, each placed where its hex appears on screen.
// G.cam keeps its old meaning (screen = map * z + x/y at the screen centre); this file turns it into a tilted camera.
// Flat map option (G.opts.flat) or any WebGL failure → game.js falls back to the classic top-down drawing.
CW.R3 = (function () {
  const EX = 30, FOV = 30, TILT_MIN = 40, TILT_MAX = 80, TILT_DEF = 58;   // EX = height of one level in map px (hex radius 44)
  let ok = false, failed = false, ren, scene, cam, dcv, dctx, dtex, ttex, terrainSrc = null, M, MW, MH, HW, HH, HF, glc;
  const S = { tilt: TILT_DEF, anim: null, last: null };
  const V = () => new THREE.Vector3();
  // ---------- height field (quarter resolution, bilinear) ----------
  function buildHeights() {
    const q = 4, w = HW = Math.ceil(MW / q), h = HH = Math.ceil(MH / q), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.scale(1 / q, 1 / q);
    for (let r = -1; r <= M.rows; r++) for (let cc = -1; cc <= M.cols; cc++) { const c2 = Math.max(0, Math.min(M.cols - 1, cc)), r2 = Math.max(0, Math.min(M.rows - 1, r)), [px, py] = CW.center(cc, r), v = M.h(c2, r2) * 50;
      x.fillStyle = `rgb(${v},${v},${v})`; CW.hexPath(x, px, py, CW.R + 1); x.fill(); }
    const b = document.createElement('canvas'); b.width = w; b.height = h; const bx = b.getContext('2d'); bx.filter = `blur(${CW.R * .55 / q}px)`; bx.drawImage(c, 0, 0);
    const d = bx.getImageData(0, 0, w, h).data; HF = new Float32Array(w * h); for (let i = 0; i < HF.length; i++) HF[i] = d[i * 4] / 50 * EX;
  }
  const hAt = (x, y) => { const fx = Math.max(0, Math.min(HW - 1.001, x / 4)), fy = Math.max(0, Math.min(HH - 1.001, y / 4)), ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * HW + ix;
    return (HF[i] * (1 - tx) + HF[i + 1] * tx) * (1 - ty) + (HF[i + HW] * (1 - tx) + HF[i + HW + 1] * tx) * ty; };
  const W3 = (x, y) => new THREE.Vector3(x - MW / 2, hAt(x, y), y - MH / 2);
  // ---------- scene ----------
  function init(map, canvas) {
    if (ok || failed) return ok; M = map; [MW, MH] = CW.mapSize(M); glc = canvas;
    try {
      if (!window.THREE) throw new Error('three.js missing');
      ren = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.3;
      ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFShadowMap; ren.shadowMap.autoUpdate = false; ren.shadowMap.needsUpdate = true;   // the hills never move: cast their shadows once
      buildHeights(); scene = new THREE.Scene();
      // sky: blue overhead fading to a warm haze at the horizon; the haze also swallows distant ground (aerial perspective)
      const sk = document.createElement('canvas'); sk.width = 4; sk.height = 256; const kx = sk.getContext('2d'), g = kx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#5f84ad'); g.addColorStop(.45, '#a9b9c4'); g.addColorStop(.62, '#d9c49a'); g.addColorStop(1, '#d9c49a'); kx.fillStyle = g; kx.fillRect(0, 0, 4, 256);
      const skt = new THREE.CanvasTexture(sk); skt.colorSpace = THREE.SRGBColorSpace; scene.background = skt; scene.fog = new THREE.Fog(0xd9c49a, 1400, 5200);
      // ground mesh: ~10 vertices per hex
      const geo = new THREE.PlaneGeometry(MW, MH, M.cols * 10, M.rows * 10); geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hAt(p.getX(i) + MW / 2, p.getZ(i) + MH / 2)); geo.computeVertexNormals();
      ttex = new THREE.CanvasTexture(document.createElement('canvas')); ttex.colorSpace = THREE.SRGBColorSpace; ttex.anisotropy = ren.capabilities.getMaxAnisotropy();
      const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ttex, roughness: 1, metalness: 0 })); ground.receiveShadow = ground.castShadow = true; scene.add(ground);
      // decal: the markings canvas laid over the same hills
      dcv = document.createElement('canvas'); dcv.width = MW; dcv.height = MH; dctx = dcv.getContext('2d');
      dtex = new THREE.CanvasTexture(dcv); dtex.colorSpace = THREE.SRGBColorSpace; dtex.anisotropy = ren.capabilities.getMaxAnisotropy();
      const decal = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: dtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false }));
      decal.renderOrder = 2; scene.add(decal);
      // land beyond the board so the edge sits on countryside, not in a void
      const skirt = new THREE.Mesh(new THREE.PlaneGeometry(MW * 8, MH * 8), new THREE.MeshStandardMaterial({ color: 0x6f6a3e, roughness: 1 }));
      skirt.rotateX(-Math.PI / 2); skirt.position.y = -2; skirt.receiveShadow = true; scene.add(skirt); S.skirt = skirt;
      // light: low golden-hour sun from the west, plus sky fill
      scene.add(new THREE.HemisphereLight(0xcfdcec, 0x6a5a3a, 1.0));
      const sun = new THREE.DirectionalLight(0xffdcb4, 3.6); sun.position.set(-1000, 300, 300); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
      Object.assign(sun.shadow.camera, { left: -MW * .6, right: MW * .6, top: MH * .75, bottom: -MH * .75, near: 10, far: 4000 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = 1.2; scene.add(sun);
      cam = new THREE.PerspectiveCamera(FOV, 1, 20, 12000);
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('graphics context lost'); });
      ok = true;
    } catch (e) { fail(e.message); }
    return ok;
  }
  function fail(why) { if (failed) return; failed = true; ok = false; console.warn('3D battlefield off, using flat map:', why); if (glc) glc.style.display = 'none'; CW.toast && CW.toast('3D battlefield unavailable here, so the flat map is in use'); }
  const tex = img => { if (img === terrainSrc) return; terrainSrc = img; ttex.image = img; ttex.needsUpdate = true;   // grass under the board edge, from the painting's own colours
    try { const d = img.getContext('2d').getImageData(0, 0, 40, 40).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4;
      S.skirt.material.color.setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace).multiplyScalar(.85); } catch (e) { /* tainted or lost: keep default */ } };
  // ---------- camera ----------
  // camera from G.cam: the map point at the screen centre, seen from the south, tilted S.tilt degrees above the horizon,
  // at the distance where one map px there is z screen px (so every existing pan / zoom / centre-on call keeps working)
  function place(gc, w, h) {
    let tilt = S.tilt, z = gc.z; const a = S.anim;
    if (a) { const t = Math.min(1, (performance.now() - a.t0) / a.dur), e = t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      tilt = a.tilt + (tilt - a.tilt) * e; z = a.z * Math.pow(gc.z / a.z, e); if (t >= 1) S.anim = null; }
    const tx = (w / 2 - gc.x) / gc.z, ty = (h / 2 - gc.y) / gc.z, T = W3(tx, ty), D = h / (2 * z * Math.tan(FOV * Math.PI / 360)), el = tilt * Math.PI / 180;
    cam.aspect = w / h; cam.position.set(T.x, T.y + D * Math.sin(el), T.z + D * Math.cos(el)); cam.up.set(0, 1, 0); cam.lookAt(T); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    S.last = { w, h }; }
  function render(gc, w, h, dpr, terrainImg) {
    if (!ok) return false;
    try { tex(terrainImg); if (ren.getPixelRatio() !== dpr || ren.domElement.width !== Math.round(w * dpr) || ren.domElement.height !== Math.round(h * dpr)) { ren.setPixelRatio(dpr); ren.setSize(w, h, false); }
      place(gc, w, h); dtex.needsUpdate = true; ren.render(scene, cam); return true; }
    catch (e) { fail(e.message); return false; }
  }
  // screen position of a map point on the ground, and how many screen px one map px measures there
  function project(x, y) { const p = W3(x, y), fwd = V(); cam.getWorldDirection(fwd); const depth = p.clone().sub(cam.position).dot(fwd), s = p.project(cam), { w, h } = S.last;
    return [(s.x + 1) / 2 * w, (1 - s.y) / 2 * h, h / (2 * depth * Math.tan(FOV * Math.PI / 360)), depth > 0]; }
  // draw a unit in its own map coordinates, placed and scaled where its ground point appears on screen
  function local(ctx, x, y, dpr) { const [sx, sy, s, vis] = project(x, y); ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (sx - s * x), dpr * (sy - s * y)); return vis; }
  // screen px → map px: march along the mouse ray until it dips under the hills
  function pick(px, py) { if (!ok || !S.last) return null; const { w, h } = S.last, o = cam.position.clone(), d = new THREE.Vector3((px / w) * 2 - 1, -(py / h) * 2 + 1, .5).unproject(cam).sub(o).normalize();
    const above = t => { const q = o.clone().addScaledVector(d, t); return q.y - hAt(q.x + MW / 2, q.z + MH / 2); };
    let a = 0, t = 0, step = 12, far = 12000; if (d.y >= 0) return null;
    while (t < far && above(t) > 0) { a = t; t += step; } if (t >= far) return null;
    for (let i = 0; i < 20; i++) { const m = (a + t) / 2; if (above(m) > 0) a = m; else t = m; }
    const q = o.clone().addScaledVector(d, t); return [q.x + MW / 2, q.z + MH / 2]; }
  // tilt: [ ] keys; the opening sweep starts high and wide, then settles on the army
  const tilt = dv => { S.tilt = Math.max(TILT_MIN, Math.min(TILT_MAX, S.tilt + dv)); return S.tilt; };
  function sweep(gc, fitZ, redraw) { if (!ok) return; S.anim = { t0: performance.now(), dur: 3200, tilt: 32, z: Math.min(gc.z, fitZ * .75) };
    const loop = () => { redraw(); if (S.anim) requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  return { init, on: opts => ok && !(opts && opts.flat), decal: () => dctx, render, project, local, pick, tilt, sweep, hAt, get tiltDeg() { return S.tilt; }, animating: () => !!S.anim, get failed() { return failed; } };
})();
