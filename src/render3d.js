'use strict';
// 2.5D battlefield (visual-polish part 1). The painted map is draped over the height data and lit by a low sun.
// Three layers: (1) this WebGL ground, (2) map markings drawn by game.js onto a transparent "decal" canvas that is laid
// over the hills, (3) units drawn by game.js on the normal 2D canvas on top, each placed where its hex appears on screen.
// G.cam keeps its old meaning (screen = map * z + x/y at the screen centre); this file turns it into a tilted camera.
// Flat map option (G.opts.flat) or any WebGL failure → game.js falls back to the classic top-down drawing.
CW.R3 = (function () {
  const EX = 30, FOV = 30, TILT_MIN = 40, TILT_MAX = 80, TILT_DEF = 58;   // EX = height of one level in map px (hex radius 44)
  let ok = false, failed = false, ren, scene, cam, dcv, dctx, dtex, ttex, terrainSrc = null, M, MW, MH, HW, HH, HF, glc;
  const S = { tilt: TILT_DEF, anim: null, last: null, live: false, raf: 0, prev: 0, acc: 0, n: 0, win0: 0, mats: [], wk: new Map(), src: null, threads: null };
  // ---------- living landscape (sessions 17a-b, 18): cloud shadows, creek wake, brook thread, tree sway, warm haze; one time uniform, patched into the ground material ----------
  const U = { uT: { value: 0 }, uLive: { value: 0 }, uWater: { value: null }, uForest: { value: null }, uMap: { value: window.THREE ? new THREE.Vector2(1, 1) : null } };
  const GLSL_NOISE = `
    float cwH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float cwN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(cwH(i), cwH(i + vec2(1, 0)), f.x), mix(cwH(i + vec2(0, 1)), cwH(i + vec2(1, 1)), f.x), f.y); }
    float cwF(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * cwN(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }`;
  // clouds on every ground surface; the creek wake only inside the creek mask
  function living(mat, water) {
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U, CW.WAKE ? CW.WAKE.U : {});
      sh.vertexShader = 'varying vec3 vCwW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vCwW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = `varying vec3 vCwW; uniform float uT, uLive; uniform sampler2D uWater, uForest, uWake; uniform vec2 uMap, uWTx; uniform vec4 uWBox;${GLSL_NOISE}\n` + sh.fragmentShader
        .replace('#include <map_fragment>', (water ? `
  // tree sway: inside the forest mask only, the painted canopies wobble 1-2 px (slow sine + noise); roads, walls and open ground stay put
  vec2 cwOff = vec2(0.0);
  if (uLive > 0.5) { float fm = texture2D(uForest, (vCwW.xz + uMap * 0.5) / uMap).a;
    if (fm > 0.01) { float n = cwN(vCwW.xz / 70.0 + uT * 0.06) * 6.283;
      cwOff = fm * 1.6 * vec2(sin(uT * 0.9 + vCwW.x * 0.031 + n), 0.5 * sin(uT * 0.7 + vCwW.z * 0.027 + n)) / uMap; } }
  #ifdef USE_MAP
    diffuseColor *= texture2D(map, vMapUv + cwOff);
  #endif` : '#include <map_fragment>') + `
  float cwSheen = 0.0, cwWarm = 0.0;
  if (uLive > 0.5) {
    cwWarm = 0.5 + 0.5 * sin(uT * 0.10472);   // ~60 s sun-warmth cycle, shared with the fog colour (tick)
    // cloud shadows: soft fbm blobs drifting slowly from the west; at most 18% darker, lit patches a touch warmer
    vec2 cp = vCwW.xz / 900.0 + vec2(uT * 0.010, uT * 0.004);
    float sh = smoothstep(0.50, 0.72, cwF(cp)), lit = 1.0 - sh;
    diffuseColor.rgb *= (1.0 - 0.18 * sh) * mix(vec3(1.0), vec3(1.035, 1.012, 0.975), lit);
    ${water ? `// session 18: the creek is shaded from the wake heightfield (CW.WAKE): troughs darker, a thin pale sheen on crests, foam only at the bank
    if (uWBox.z > 0.0) { vec2 mp = vCwW.xz + uMap * 0.5, wuv = (mp - uWBox.xy) / uWBox.zw;
      float wm = (wuv.x > 0.0 && wuv.x < 1.0 && wuv.y > 0.0 && wuv.y < 1.0) ? texture2D(uWater, mp / uMap).a : 0.0;
      if (wm > 0.02) {
        float h = texture2D(uWake, wuv).r, core = smoothstep(0.45, 0.85, wm), band = smoothstep(0.04, 0.3, wm) * (1.0 - core);
        vec2 g = vec2(texture2D(uWake, wuv + vec2(uWTx.x, 0.0)).r - texture2D(uWake, wuv - vec2(uWTx.x, 0.0)).r,
                      texture2D(uWake, wuv + vec2(0.0, uWTx.y)).r - texture2D(uWake, wuv - vec2(0.0, uWTx.y)).r);
        float sl = -dot(g, vec2(-0.6, 0.8));                           // slope facing the camera (south) and the sun (west)
        diffuseColor.rgb *= (1.0 - 0.32 * wm * smoothstep(0.0, 0.18, -h)) * (1.0 + 0.05 * wm * smoothstep(0.0, 0.18, h));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.78, 0.76), band * 0.35 * smoothstep(0.08, 0.40, abs(h) + length(g)));
        cwSheen = core * smoothstep(0.04, 0.14, sl) * smoothstep(0.02, 0.12, h);
      } }` : ''}
  }`)
        .replace('#include <opaque_fragment>', 'outgoingLight += cwSheen * vec3(0.80, 0.85, 0.86) * 0.25;\n  outgoingLight *= mix(vec3(1.0), vec3(1.025, 1.005, 0.97), cwWarm);\n#include <opaque_fragment>');
    };
    mat.customProgramCacheKey = () => 'cwLiving' + (water ? 'W' : '');
    S.mats.push(mat); return mat;
  }
  // creek mask at 1/4 scale, once per map load: A = water, softened ~4 px at the bank (foam band). Then the wake field and the brook threads
  function buildWater() {
    const q = 4, w = Math.ceil(MW / q), h = Math.ceil(MH / q), W = CW.WATER || hexWater(); let A = document.createElement('canvas'); A.width = w; A.height = h;
    const a = A.getContext('2d'); a.filter = 'blur(1px)'; a.scale(1 / q, 1 / q); a.lineCap = a.lineJoin = 'round';
    if (W.river && W.river.length > 1) { CW.smoothPath(a, W.river); a.strokeStyle = '#fff'; a.lineWidth = (W.rw || CW.R * .46) * 1.05; a.stroke(); }
    const d = new Uint8Array(a.getImageData(0, 0, w, h).data.buffer.slice(0)); A.width = A.height = 0; A = null;   // release the scratch canvas
    if (U.uWater.value) U.uWater.value.dispose();
    const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; U.uWater.value = t; U.uMap.value.set(MW, MH);
    if (CW.WAKE) { try { CW.WAKE.build(ren, W, hAt, MW, MH); } catch (e) { console.warn('wake field skipped:', e.message); } }
    buildThreads(W.streams || []);
  }
  // brooks: still painted water plus one pale thread drifting downstream along each recorded stream path (living on only)
  const THREAD_VS = 'attribute float aS, aV; varying float vS, vV; void main() { vS = aS; vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const THREAD_FS = `uniform float uT; varying float vS, vV; float h1(float n) { return fract(sin(n * 91.7) * 43758.5453); }
    void main() { float p = vS / 46.0 - uT * 0.55, k = floor(p), f = fract(p), len = 0.35 + 0.3 * h1(k);
      float a = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(len - 0.12, len, f)) * (0.35 + 0.45 * h1(k + 7.0)) * (1.0 - vV * vV);
      gl_FragColor = vec4(0.86, 0.90, 0.89, a * 0.7); }`;
  function buildThreads(streams) {
    if (S.threads) { scene.remove(S.threads); S.threads.children.forEach(m => m.geometry.dispose()); }
    const g = new THREE.Group(); g.visible = S.live; S.threads = g; scene.add(g);
    S.tmat = S.tmat || new THREE.ShaderMaterial({ vertexShader: THREAD_VS, fragmentShader: THREAD_FS, uniforms: { uT: U.uT }, transparent: true, depthWrite: false, fog: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    for (let pts of streams) { if (pts.length < 2) continue;
      if (hAt(...pts[0]) < hAt(...pts[pts.length - 1]) - 1) pts = pts.slice().reverse();          // downstream = downhill
      const c = [];                                                                                // the same curve CW.smoothPath paints
      for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3));
        for (let k = i ? 1 : 0; k <= n; k++) { const t = k / n, u = 1 - t; c.push([u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]]); } }
      const pos = [], aS = [], aV = [], idx = []; let s = 0;
      c.forEach(([x, y], i) => { const [px, py] = c[Math.max(0, i - 1)], [nx, ny] = c[Math.min(c.length - 1, i + 1)], L = Math.hypot(nx - px, ny - py) || 1, ox = -(ny - py) / L * .55, oy = (nx - px) / L * .55;
        if (i) s += Math.hypot(x - c[i - 1][0], y - c[i - 1][1]);
        for (const sd of [-1, 1]) { const qx = x + ox * sd, qy = y + oy * sd; pos.push(qx - MW / 2, hAt(qx, qy) + 1, qy - MH / 2); aS.push(s); aV.push(sd); }
        if (i) { const j = i * 2; idx.push(j - 2, j - 1, j, j - 1, j + 1, j); } });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
      geo.setAttribute('aV', new THREE.Float32BufferAttribute(aV, 1)); geo.setIndex(idx);
      const m = new THREE.Mesh(geo, S.tmat); m.renderOrder = 1; m.frustumCulled = false; g.add(m); }
  }
  // forest mask at 1/8 scale, once per map load: A = sway weight. Forest + orchard hexes, softened, with roads and walls/fences cut out
  function buildForest() {
    const q = 8, w = Math.ceil(MW / q), h = Math.ceil(MH / q); let A = document.createElement('canvas'); A.width = w; A.height = h; const a = A.getContext('2d');
    a.filter = 'blur(1.5px)'; a.scale(1 / q, 1 / q); a.fillStyle = '#fff';
    M.all.forEach(([c, r]) => { if ('fo'.includes(M.ter(c, r))) { const [x, y] = CW.center(c, r); CW.hexPath(a, x, y, CW.R * .96); a.fill(); } });
    a.filter = 'none'; a.globalCompositeOperation = 'destination-out'; a.strokeStyle = '#000'; a.lineCap = a.lineJoin = 'round';
    (M.roads || []).forEach(rd => { CW.smoothPath(a, rd.p.map(p => CW.center(...p))); a.lineWidth = (rd.major ? 11 : 8) + 10; a.stroke(); });
    M.edgeAt && M.edgeAt.forEach((types, k) => { if (![...types].some(t => t === 'wall' || t === 'fence')) return; const [c, r, d] = k.split(',').map(Number), [x, y] = CW.center(c, r);
      a.beginPath(); a.moveTo(...CW.corner(x, y, d)); a.lineTo(...CW.corner(x, y, d + 1)); a.lineWidth = 22; a.stroke(); });
    const d = new Uint8Array(a.getImageData(0, 0, w, h).data.buffer.slice(0)); A.width = A.height = 0; A = null;
    if (U.uForest.value) U.uForest.value.dispose();
    const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; U.uForest.value = t;
  }
  function hexWater() {   // fallback when the painted art isn't loaded: river through the river hexes, streams along their hex edges
    const riv = M.all.filter(([c, r]) => 'wbd'.includes(M.ter(c, r))).map(hx => CW.center(...hx)).sort((p, q) => p[1] - q[1]), streams = [];
    M.edgeAt && M.edgeAt.forEach((types, k) => { if (![...types].includes('stream')) return; const [c, r, d] = k.split(',').map(Number), [x, y] = CW.center(c, r); streams.push([CW.corner(x, y, d), CW.corner(x, y, d + 1)]); });
    return { river: riv.length > 1 ? riv : null, rw: CW.R * .46, streams };
  }
  // capped 30 fps loop; only re-renders the WebGL ground (decal and unit canvas are untouched); pauses when the tab is hidden
  function tick(now) {
    S.raf = 0; if (!S.live || !ok || document.hidden) return;
    S.raf = requestAnimationFrame(tick);
    if (now - S.prev < 32) return;
    const dt = now - S.prev; S.prev = now;
    S.acc += Math.min(dt, 500); S.n++; if (!S.win0) S.win0 = now;   // one long stall (map repaint) can't trip it alone; a slow machine can
    if (now - S.win0 >= 3000) { const avg = S.n ? S.acc / S.n : 0; S.avg = avg; S.acc = S.n = 0; S.win0 = now; if (avg > 40 && S.onSlow) { S.onSlow(avg); return; } }
    U.uT.value = now / 1000; warmFog();
    try { if (CW.WAKE && CW.WAKE.ok) { feedWake(Math.min(dt, 100) / 1000); CW.WAKE.step(Math.min(dt, 100) / 1000, cam, MW, MH); } ren.render(scene, cam); } catch (e) { fail(e.message); }
  }
  // wading infantry/cavalry (from game.js): stamp a trail between last frame's spot and this one, stronger the faster they go
  const WAKE_S = 1.5;   // a 2-hex ford crossing gives a peak of ~1 that is gone in ~2 s
  function feedWake(dt) { const src = S.src && S.src(); if (!src) return; const seen = new Set();
    for (const o of src) { seen.add(o.id); const p = S.wk.get(o.id); S.wk.set(o.id, [o.x, o.y, o.wade]); if (!p || !(o.wade || p[2])) continue;   // last frame's hex counts too
      const d = Math.hypot(o.x - p[0], o.y - p[1]); if (d < .3 || d > CW.HW * 4) continue;
      CW.WAKE.trail(p[0], p[1], o.x, o.y, Math.min(1, d / dt / 900) * WAKE_S * (o.cav ? 1.3 : 1)); }
    for (const k of S.wk.keys()) if (!seen.has(k)) S.wk.delete(k); }
  const FOG0 = window.THREE && new THREE.Color(0xd9c49a), FOG1 = window.THREE && new THREE.Color(0xe2c18e);   // haze: base → a touch warmer, same 60 s cycle as the shader
  function warmFog() { if (scene && scene.fog) scene.fog.color.lerpColors(FOG0, FOG1, S.live ? .5 + .5 * Math.sin(U.uT.value * .10472) : 0); }
  function setLive(on) { on = !!(on && ok); if (on === S.live) return; S.live = on; U.uLive.value = on ? 1 : 0; if (S.threads) S.threads.visible = on; S.wk.clear(); if (CW.WAKE) CW.WAKE.clear();
    if (on) { S.prev = performance.now(); S.acc = S.n = 0; S.win0 = 0; if (!S.raf) S.raf = requestAnimationFrame(tick); } else { if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; } warmFog(); } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.live && !S.raf) { S.prev = performance.now(); S.acc = S.n = 0; S.win0 = 0; S.raf = requestAnimationFrame(tick); } });
  // timing helper for tests: ms per ground render (synchronised with a 1-px read)
  function bench(n = 30, live = S.live) { if (!ok || !S.last) return null; const keep = U.uLive.value, px = new Uint8Array(4), gl = ren.getContext(); U.uLive.value = live ? 1 : 0;
    ren.render(scene, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t0 = performance.now();
    for (let i = 0; i < n; i++) { U.uT.value += .033; ren.render(scene, cam); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const ms = (performance.now() - t0) / n; U.uLive.value = keep; return ms; }
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
      ren.debug.onShaderError = (gl, prog, vs, fs) => { console.warn('Living landscape shader failed; effects off'); S.mats.forEach(m => { m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => 'plain'; m.needsUpdate = true; }); setLive(false); S.broken = true; };
      U.uWater.value = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat); U.uWater.value.needsUpdate = true;
      U.uForest.value = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat); U.uForest.value.needsUpdate = true;
      buildHeights(); scene = new THREE.Scene();
      // sky: blue overhead fading to a warm haze at the horizon; the haze also swallows distant ground (aerial perspective)
      const sk = document.createElement('canvas'); sk.width = 4; sk.height = 256; const kx = sk.getContext('2d'), g = kx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#5f84ad'); g.addColorStop(.45, '#a9b9c4'); g.addColorStop(.62, '#d9c49a'); g.addColorStop(1, '#d9c49a'); kx.fillStyle = g; kx.fillRect(0, 0, 4, 256);
      const skt = new THREE.CanvasTexture(sk); skt.colorSpace = THREE.SRGBColorSpace; scene.background = skt; scene.fog = new THREE.Fog(0xd9c49a, 1400, 5200);
      // ground mesh: ~10 vertices per hex
      const geo = new THREE.PlaneGeometry(MW, MH, M.cols * 10, M.rows * 10); geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hAt(p.getX(i) + MW / 2, p.getZ(i) + MH / 2)); geo.computeVertexNormals();
      ttex = new THREE.CanvasTexture(document.createElement('canvas')); ttex.colorSpace = THREE.SRGBColorSpace; ttex.anisotropy = ren.capabilities.getMaxAnisotropy();
      const ground = new THREE.Mesh(geo, living(new THREE.MeshStandardMaterial({ map: ttex, roughness: 1, metalness: 0 }), true)); ground.receiveShadow = ground.castShadow = true; scene.add(ground);
      // decal: the markings canvas laid over the same hills
      dcv = document.createElement('canvas'); dcv.width = MW; dcv.height = MH; dctx = dcv.getContext('2d');
      dtex = new THREE.CanvasTexture(dcv); dtex.colorSpace = THREE.SRGBColorSpace; dtex.anisotropy = ren.capabilities.getMaxAnisotropy();
      const decal = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: dtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false }));
      decal.renderOrder = 2; scene.add(decal);
      // land beyond the board so the edge sits on countryside, not in a void
      const skirt = new THREE.Mesh(new THREE.PlaneGeometry(MW * 8, MH * 8), living(new THREE.MeshStandardMaterial({ color: 0x6f6a3e, roughness: 1 }), false));
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
  const tex = img => { if (img === terrainSrc) return; terrainSrc = img; ttex.image = img; ttex.needsUpdate = true; try { buildWater(); } catch (e) { console.warn('water mask skipped:', e.message); } try { buildForest(); } catch (e) { console.warn('forest mask skipped:', e.message); }   // grass under the board edge, from the painting's own colours
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
      place(gc, w, h); dtex.needsUpdate = true; U.uT.value = performance.now() / 1000; warmFog(); ren.render(scene, cam); return true; }
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
  return { init, on: opts => ok && !(opts && opts.flat), decal: () => dctx, render, project, local, pick, tilt, sweep, hAt, get tiltDeg() { return S.tilt; }, animating: () => !!S.anim, setLive, bench, onSlow: f => { S.onSlow = f; }, wakeSource: f => { S.src = f; }, wade: (x0, y0, x1, y1, s) => { if (S.live && CW.WAKE && CW.WAKE.ok) CW.WAKE.trail(x0, y0, x1, y1, s * WAKE_S); }, get live() { return S.live; }, get avgMs() { return S.avg || 0; }, get waterTex() { return U.uWater.value; }, get renderer() { return ren; }, get threads() { return S.threads; }, get camera() { return cam; }, get forestTex() { return U.uForest.value; }, get failed() { return failed; } };
})();
