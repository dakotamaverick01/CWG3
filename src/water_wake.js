'use strict';
// Session 18 — wake field on the main creek (CW.WATER.river) only. Brooks are not simulated.
// Heightfield after Evan Wallace's WebGL Water (MIT, github.com/evanw/webgl-water): a small half-float texture holds
// R = height, G = velocity; each step pulls a cell toward the average of its four neighbours, damps it, and integrates.
// Two additions for a creek: the field drifts downstream (it is sampled upstream along the mask's flow direction),
// and the domain is the creek's own bounding box (256 cells on the long axis), not the map. Cells outside the creek
// mask stay at zero; at the bank a dry neighbour mirrors the cell (nothing leaks onto the field) and bank cells are
// damped hard, so a wave reflects only weakly. Drops come from wading infantry/cavalry (render3d asks game.js for them).
// Stepped only while the living landscape is on and the creek is inside the camera view.
CW.WAKE = (function () {
  const N = 256, RATE = 60, MAXSTEPS = 4, MAXD = 8;
  // K: neighbour pull (wave speed ~ sqrt(K/4) cells/step); ADV: downstream drift, cells/step; DV/DH: per-step damping of
  // velocity/height (a drop is gone in ~2 s); EDGE: velocity damping on bank cells (weak reflection); AMB: faint flow pulses
  const P = { K: 0.12, ADV: 0.12, DV: 0.996, DH: 0.997, EDGE: 0.95, R: 2.0, AMB: 0.05, AMB_EVERY: 0.15 };   // tuned session 18 (sim_test)
  let ren = null, scene, cam, quad, mat, rtA, rtB, mask = null, ok = false, gw = 0, gh = 0, cell = 1, acc = 0, quiet = 99, ambT = 0;
  let pts = null, segs = [], rw = 0;
  const box = { x0: 0, y0: 0, w: 1, h: 1, hMin: 0, hMax: 0 }, drops = [];
  const T3 = window.THREE, U = { uWake: { value: T3 ? Object.assign(new T3.DataTexture(new Uint8Array(4), 1, 1, T3.RGBAFormat), { needsUpdate: true }) : null },   // read by the ground shader
    uWBox: { value: T3 ? new T3.Vector4(0, 0, 0, 0) : null }, uWTx: { value: T3 ? new T3.Vector2(1, 1) : null } };

  const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const FS = `
    uniform sampler2D uState, uMask; uniform vec2 uTx; uniform float uK, uAdv, uDv, uDh, uEdge; uniform vec4 uDrop[${MAXD}]; uniform int uNd;
    varying vec2 vUv;
    float wet(vec2 p) { return step(0.5, texture2D(uMask, p).r); }
    void main() {
      vec4 mk = texture2D(uMask, vUv);
      if (mk.r < 0.5) { gl_FragColor = vec4(0.0); return; }
      vec2 c = vUv - (mk.gb * 2.0 - 1.0) * uAdv * uTx;            // look upstream: the field drifts with the current
      vec2 s = texture2D(uState, c).rg; float h = s.r, v = s.g;
      vec2 dx = vec2(uTx.x, 0.0), dy = vec2(0.0, uTx.y);
      float mL = wet(vUv - dx), mR = wet(vUv + dx), mD = wet(vUv - dy), mU = wet(vUv + dy);
      float avg = (mix(h, texture2D(uState, c - dx).r, mL) + mix(h, texture2D(uState, c + dx).r, mR)
                 + mix(h, texture2D(uState, c - dy).r, mD) + mix(h, texture2D(uState, c + dy).r, mU)) * 0.25;
      v += (avg - h) * uK;
      v *= mix(uDv, uEdge, 1.0 - mL * mR * mD * mU);               // bank cells soak up most of the wave
      h = h * uDh + v;
      for (int i = 0; i < ${MAXD}; i++) { if (i >= uNd) break;
        vec2 d = (vUv - uDrop[i].xy) / uTx; h += uDrop[i].z * exp(-dot(d, d) / (2.0 * uDrop[i].w * uDrop[i].w)); }
      gl_FragColor = vec4(clamp(h, -2.0, 2.0), clamp(v, -2.0, 2.0), 0.0, 1.0);
    }`;

  function rt() { return new THREE.WebGLRenderTarget(gw, gh, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, stencilBuffer: false }); }
  function clear() { if (!ok) return; const cc = new THREE.Color(), ca = ren.getClearAlpha(), was = ren.getRenderTarget(); ren.getClearColor(cc); ren.setClearColor(0x000000, 0);
    for (const t of [rtA, rtB]) { ren.setRenderTarget(t); ren.clear(true, false, false); } ren.setRenderTarget(was); ren.setClearColor(cc, ca); quiet = 99; drops.length = 0; }
  function dispose() { [rtA, rtB, mask].forEach(t => t && t.dispose()); rtA = rtB = mask = null; ok = false; pts = null; segs = []; if (U.uWBox.value) U.uWBox.value.set(0, 0, 0, 0); }

  // build(renderer, CW.WATER, hAt, MW, MH): once per map load
  function build(renderer, W, hAt, MW, MH) {
    dispose(); ren = renderer;
    if (!W || !W.river || W.river.length < 2) { U.uWBox.value.set(0, 0, 0, 0); return false; }
    pts = W.river.map(p => p.slice()); rw = W.rw || CW.R * .46;
    if (hAt(...pts[0]) < hAt(...pts[pts.length - 1]) - 1) pts.reverse();                         // runs downhill
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const pad = rw / 2 + 6;
    pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(MW, x1 + pad); y1 = Math.min(MH, y1 + pad);
    const bw = x1 - x0, bh = y1 - y0; cell = Math.max(bw, bh) / N; gw = Math.max(8, Math.ceil(bw / cell)); gh = Math.max(8, Math.ceil(bh / cell));
    Object.assign(box, { x0, y0, w: gw * cell, h: gh * cell });
    let hMin = 1e9, hMax = -1e9; for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const v = hAt(x0 + bw * i / 8, y0 + bh * j / 8); hMin = Math.min(hMin, v); hMax = Math.max(hMax, v); }
    box.hMin = hMin - 4; box.hMax = hMax + 4;
    // mask: R = water (the painted creek's width), GB = downstream direction
    let A = document.createElement('canvas'), B = document.createElement('canvas'); A.width = B.width = gw; A.height = B.height = gh;
    const a = A.getContext('2d'), b = B.getContext('2d'); for (const x of [a, b]) { x.setTransform(1 / cell, 0, 0, 1 / cell, -x0 / cell, -y0 / cell); x.lineCap = x.lineJoin = 'round'; }
    segs = [];
    for (let i = 0; i < pts.length - 1; i++) { const [px, py] = pts[i], [qx, qy] = pts[i + 1], L = Math.hypot(qx - px, qy - py) || 1; segs.push([px, py, qx, qy, L]);
      a.strokeStyle = `rgb(128,${Math.round(((qx - px) / L * .5 + .5) * 255)},${Math.round(((qy - py) / L * .5 + .5) * 255)})`; a.lineWidth = rw * 2 + 10; a.beginPath(); a.moveTo(px, py); a.lineTo(qx, qy); a.stroke(); }
    CW.smoothPath(b, pts); b.strokeStyle = '#fff'; b.lineWidth = rw * .95; b.stroke();
    const da = a.getImageData(0, 0, gw, gh).data, db = b.getImageData(0, 0, gw, gh).data, d = new Uint8Array(gw * gh * 4);
    for (let i = 0; i < d.length; i += 4) { d[i] = db[i + 3]; d[i + 1] = da[i + 1] || 128; d[i + 2] = da[i + 2] || 128; d[i + 3] = 255; }
    A.width = A.height = B.width = B.height = 0; A = B = null;
    mask = new THREE.DataTexture(d, gw, gh, THREE.RGBAFormat); mask.magFilter = mask.minFilter = THREE.LinearFilter; mask.needsUpdate = true;
    try { rtA = rt(); rtB = rt(); } catch (e) { console.warn('wake field off:', e.message); return false; }
    if (!scene) { scene = new THREE.Scene(); cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const dv = []; for (let i = 0; i < MAXD; i++) dv.push(new THREE.Vector4());
      mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, depthTest: false, depthWrite: false,
        uniforms: { uState: { value: null }, uMask: { value: null }, uTx: { value: new THREE.Vector2() }, uK: { value: P.K }, uAdv: { value: P.ADV }, uDv: { value: P.DV }, uDh: { value: P.DH }, uEdge: { value: P.EDGE }, uDrop: { value: dv }, uNd: { value: 0 } } });
      quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; scene.add(quad); }
    mat.uniforms.uMask.value = mask; mat.uniforms.uTx.value.set(1 / gw, 1 / gh);
    ok = true; clear();
    U.uWake.value = rtA.texture; U.uWBox.value.set(box.x0, box.y0, box.w, box.h); U.uWTx.value.set(1 / gw, 1 / gh);
    return true;
  }

  // drop(x, y, s): a gaussian bump at map px (x, y), strength s (≈0..0.5 per stamp); it only lands inside the creek mask
  function drop(x, y, s, r) { if (!ok || !(s > 0)) return; const u = (x - box.x0) / box.w, v = (y - box.y0) / box.h; if (u < -.02 || u > 1.02 || v < -.02 || v > 1.02) return;
    if (drops.length >= MAXD) { const w = drops.reduce((m, d, i) => d.z < drops[m].z ? i : m, 0); if (drops[w].z >= s) return; drops.splice(w, 1); }
    drops.push(new THREE.Vector4(u, v, s, r || P.R)); quiet = 0; }
  // a moving source: stamps every ~4 map px along its path this frame
  function trail(x0, y0, x1, y1, s) { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.min(MAXD, Math.ceil(L / 4))); for (let i = 1; i <= n; i++) drop(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, s / Math.sqrt(n)); }

  const fr = window.THREE && new THREE.Frustum(), pm = window.THREE && new THREE.Matrix4(), b3 = window.THREE && new THREE.Box3();
  function visible(c3, MW, MH) { pm.multiplyMatrices(c3.projectionMatrix, c3.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
    b3.min.set(box.x0 - MW / 2, box.hMin, box.y0 - MH / 2); b3.max.set(box.x0 + box.w - MW / 2, box.hMax, box.y0 + box.h - MH / 2); return fr.intersectsBox(b3); }
  function ambient(dt) { if (!(P.AMB > 0) || !segs.length) return; ambT += dt; if (ambT < P.AMB_EVERY) return; ambT = 0;   // faint pulses from the current itself
    const s = segs[Math.floor(Math.random() * segs.length)], f = Math.random(), off = (Math.random() - .5) * rw * .5;
    drop(s[0] + (s[2] - s[0]) * f - (s[3] - s[1]) / s[4] * off, s[1] + (s[3] - s[1]) * f + (s[2] - s[0]) / s[4] * off, P.AMB * (.5 + Math.random()), P.R * 1.4); }

  // step(dt s, camera, MW, MH): returns true if the field moved this frame
  function step(dt, c3, MW, MH) {
    if (!ok) return false;
    if (c3 && !visible(c3, MW, MH)) { drops.length = 0; return false; }
    ambient(dt); quiet += dt; if (quiet > 3 && !(P.AMB > 0)) return false;   // fully died out: nothing to do
    acc = Math.min(acc + dt, MAXSTEPS / RATE); let n = 0; const was = ren.getRenderTarget(), ac = ren.autoClear; ren.autoClear = false;
    while (acc >= 1 / RATE && n < MAXSTEPS) { acc -= 1 / RATE; n++;
      const m = mat.uniforms; m.uK.value = P.K; m.uAdv.value = P.ADV; m.uDv.value = P.DV; m.uDh.value = P.DH; m.uEdge.value = P.EDGE; m.uState.value = rtA.texture; m.uNd.value = n === 1 ? drops.length : 0; if (n === 1) drops.forEach((d, i) => m.uDrop.value[i].copy(d));
      ren.setRenderTarget(rtB); ren.render(scene, cam); const t = rtA; rtA = rtB; rtB = t; }
    ren.setRenderTarget(was); ren.autoClear = ac; if (n) drops.length = 0;
    U.uWake.value = rtA.texture; return n > 0; }

  // test/debug: read the field back (Float32 rows), and its peak |height|
  function read() { if (!ok) return null; const out = new Uint16Array(gw * gh * 4); ren.readRenderTargetPixels(rtA, 0, 0, gw, gh, out);
    const f = THREE.DataUtils.fromHalfFloat; let peak = 0, at = 0; for (let i = 0; i < out.length; i += 4) { const v = Math.abs(f(out[i])); if (v > peak) { peak = v; at = i / 4; } }
    return { peak, gw, gh, x: box.x0 + (at % gw + .5) * cell, y: box.y0 + (Math.floor(at / gw) + .5) * cell }; }

  return { build, drop, trail, step, clear, read, U, P, get ok() { return ok; }, get box() { return box; }, get cells() { return [gw, gh]; }, get cell() { return cell; } };
})();
