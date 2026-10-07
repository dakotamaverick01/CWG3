'use strict';
// 2.5D battlefield (visual-polish part 1). The painted map is draped over the height data and lit by a low sun.
// Three layers: (1) this WebGL ground, (2) map markings drawn by game.js onto a transparent "decal" canvas that is laid
// over the hills, (3) units drawn by game.js on the normal 2D canvas on top, each placed where its hex appears on screen.
// G.cam keeps its old meaning (screen = map * z + x/y at the screen centre); this file turns it into a tilted camera.
// Flat map option (G.opts.flat) or any WebGL failure → game.js falls back to the classic top-down drawing.
CW.R3 = (function () {
  const EX = 30, FOV = 30, TILT_MIN = 40, TILT_MAX = 80, TILT_DEF = 40;   // EX = height of one level in map px (hex radius 44)
  let ok = false, failed = false, ren, scene, cam, dcv, dctx, dtex, ttex, terrainSrc = null, M, MW, MH, HW, HH, HF, glc;
  const S = { tilt: TILT_DEF, anim: null, last: null, live: false, raf: 0, prev: 0, acc: 0, n: 0, win0: 0, mats: [], wk: new Map(), src: null, threads: null };
  // ---------- living landscape (sessions 17a-b, 18, 19): cloud shadows, 3D creek + wake, wind in the wheat, brook thread, tree sway, warm haze; one time uniform, patched into the ground material ----------
  const U = { uT: { value: 0 }, uLive: { value: 0 }, uWater: { value: null }, uForest: { value: null }, uWheatM: { value: null }, uWheatA: { value: null }, uWheatAvg: { value: window.THREE ? new THREE.Vector3(.31, .22, .084) : null }, uWheatOn: { value: 0 }, uMap: { value: window.THREE ? new THREE.Vector2(1, 1) : null },
    uGround: { value: 0 }, uGA: { value: null }, uGW0: { value: null }, uGW1: { value: null } };   // world-mesh pass: tiled ground textures + terrain weight maps
  const GLSL_NOISE = `
    float cwH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float cwN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(cwH(i), cwH(i + vec2(1, 0)), f.x), mix(cwH(i + vec2(0, 1)), cwH(i + vec2(1, 1)), f.x), f.y); }
    float cwF(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * cwN(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }`;
  // ---------- world-mesh pass: the valley floor is tiled ground textures blended by hex terrain (not the painted map) ----------
  // layers in uGA (one 512 px texture each); weight maps uGW0/uGW1 hold 8 terrain channels per map point (soft hex fills)
  const GROUND_LAYERS = [['sgb_0', 'rocky_3'], ['sgc_0', 'rocky_3'], ['crpb_1', 'wheat_0'], ['crpa_0', 'corn_0'], ['rocky_3'], ['farmyard_1'], ['rocky_1'], ['mud_3'], ['slpa_3', 'mud_0']];
  // channel per terrain letter: 0 grass, 1 wheat, 2 corn, 3 woods floor, 4 dirt, 5 knoll, 6 swamp, 7 creek bank (creek hexes are half grass)
  const GROUND_CH = { g: [[0, 1]], o: [[0, 1]], f: [[3, 1]], h: [[4, 1]], t: [[4, 1]], x: [[4, 1]], k: [[5, 1]], s: [[6, 1]], w: [[7, .5], [0, .5]], b: [[7, .5], [0, .5]], d: [[7, .5], [0, .5]] };
  const GLSL_GROUND = `
    uniform sampler2DArray uGA; uniform sampler2D uGW0, uGW1; uniform float uGround;
    vec3 cwT(float L, vec2 q, float rot) { float c = cos(rot), s = sin(rot); return texture(uGA, vec3(mat2(c, -s, s, c) * q, L)).rgb; }
    // two lookups per layer at different rotation / scale / offset, blended by mid-scale noise, so the 512 px repeat never lines up
    vec3 cwTile(float L, vec2 p) { float k = smoothstep(0.3, 0.7, cwN(p / 380.0 + L * 3.1));
      return mix(cwT(L, p / 215.0, 0.4 + L * 0.9), cwT(L, p / 265.0 + vec2(0.37, 0.61) * (L + 1.0), 2.1 + L * 1.3), k); }
    vec3 cwLayer(int i, vec2 p) {
      if (i == 0) return mix(cwTile(0.0, p), cwTile(1.0, p), smoothstep(0.42, 0.62, cwF(p / 650.0)));   // two meadows, swapped by large noise
      if (i == 3) return cwTile(4.0, p) * vec3(0.50, 0.60, 0.36);                                         // woods floor in the trees' shade
      return cwTile(float(i + 1), p); }
    vec3 cwGround(vec2 p) {
      vec2 wp = p + (vec2(cwN(p / 70.0), cwN(p / 70.0 + 31.7)) - 0.5) * 34.0;                          // wobble the hex borders
      vec4 a = texture2D(uGW0, wp / uMap), b = texture2D(uGW1, wp / uMap);
      float sw = max(dot(a, vec4(1.0)) + dot(b, vec4(1.0)), 1e-3); a /= sw; b /= sw;                         // weights sum to 1, so no seam can open a gap
      float w[8]; w[0] = a.r; w[1] = a.g; w[2] = a.b; w[3] = a.a; w[4] = b.r; w[5] = b.g; w[6] = b.b; w[7] = b.a;
      float m = 0.0;
      for (int i = 0; i < 8; i++) { w[i] += 0.32 * (cwN(p / 26.0 + float(i) * 13.7) * 0.65 + cwN(p / 9.0 + float(i) * 7.3) * 0.35 - 0.5); m = max(m, w[i]); }
      vec3 col = vec3(0.0); float t = 0.0;
      for (int i = 0; i < 8; i++) { float f = max(w[i] - m + 0.12, 0.0); if (f > 0.0) { col += f * cwLayer(i, p); t += f; } }   // ragged, noisy borders
      col /= max(t, 1e-4);
      // world pass 2: creek bank — a ragged, noisy grass-to-mud band near the water (creek mask uWater, 16 taps at two radii)
      float wb = 0.0; for (int k = 0; k < 8; k++) { float an = float(k) * 0.785 + 0.4; vec2 o = vec2(cos(an), sin(an));
        wb += texture2D(uWater, (p + o * 16.0) / uMap).a + texture2D(uWater, (p + o * 34.0) / uMap).a; }
      wb /= 16.0;
      if (wb > 0.0) { float bn = cwN(p / 14.0) * 0.6 + cwN(p / 41.0 + 5.3) * 0.4;
        col *= 1.0 - 0.18 * smoothstep(0.0, 0.18, wb + (bn - 0.5) * 0.2);                                   // damp, darker grass nearing the water
        col = mix(col, cwTile(8.0, p) * vec3(0.92, 0.90, 0.86), 0.9 * smoothstep(0.05, 0.30, wb + (bn - 0.5) * 0.30)); }   // ragged mud at the edge
      col *= mix(vec3(0.90, 0.94, 0.86), vec3(1.07, 1.03, 0.95), cwF(p / 1600.0));                      // gentle large-scale colour drift
      return col * vec3(1.08, 1.0, 0.84); }`;                                                            // the painter's golden grade
  // clouds on every ground surface; the creek wake only inside the creek mask
  function living(mat, water) {
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U, CW.WAKE ? CW.WAKE.U : {});
      sh.vertexShader = 'varying vec3 vCwW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vCwW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = `varying vec3 vCwW; uniform float uT, uLive; uniform sampler2D uWater, uForest, uWake, uWheatM, uWheatA; uniform vec2 uMap, uWTx; uniform vec4 uWBox; uniform vec3 uWheatAvg; uniform float uWheatOn;${GLSL_NOISE}${water ? GLSL_GROUND : ''}\n` + sh.fragmentShader
        .replace('#include <map_fragment>', (water ? `
  // tree sway: inside the forest mask only, the painted canopies wobble 1-2 px (slow sine + noise); roads, walls and open ground stay put
  vec2 cwOff = vec2(0.0);
  if (uLive > 0.5) { float fm = texture2D(uForest, (vCwW.xz + uMap * 0.5) / uMap).a;
    if (fm > 0.01) { float n = cwN(vCwW.xz / 70.0 + uT * 0.06) * 6.283;
      cwOff = fm * 1.6 * vec2(sin(uT * 0.9 + vCwW.x * 0.031 + n), 0.5 * sin(uT * 0.7 + vCwW.z * 0.027 + n)) / uMap; } }
  // world-mesh: ground from tiled textures; the map texture is then only the painted props/markings layer (walls, fences, buildings, roads...)
  vec3 cwG = vec3(1.0); if (uGround > 0.5) cwG = cwGround(vCwW.xz + uMap * 0.5);
  vec3 cwWm = vec3(1.0);
  // session 19b: wheat fields carry a Blender-rendered flipbook of stalks bending in the wind (CW.WHEATFLOW); it multiplies the
  // painted wheat (colour / its average), the gust phase drifts across a field so tiles don't repeat in step, fades out when zoomed far out
  if (uWheatOn > 0.5) { vec2 wmp = vCwW.xz + uMap * 0.5; float wq = texture2D(uWheatM, wmp / uMap).a;
    if (wq > 0.01) { float wk = wq * (1.0 - smoothstep(0.9, 2.2, length(fwidth(wmp))));
      if (wk > 0.0) { float ft = (uLive > 0.5 ? uT * 5.0 : 0.0) + cwN(wmp / 260.0) * 24.0, f0 = mod(floor(ft), 48.0), f1 = mod(f0 + 1.0, 48.0);
        // two samples at unrelated scales/phases, so the gust bands interfere instead of repeating every tile
        vec2 q = fract(wmp / 64.0) * 0.98 + 0.01, q2 = fract(wmp / 97.0 + vec2(0.31, 0.57)) * 0.98 + 0.01; float g0 = mod(f0 + 17.0, 48.0), g1 = mod(f1 + 17.0, 48.0);
        vec3 wa = texture2D(uWheatA, vec2((mod(f0, 8.0) + q.x) / 8.0, 1.0 - (floor(f0 / 8.0) + 1.0 - q.y) / 6.0)).rgb;
        vec3 wb = texture2D(uWheatA, vec2((mod(f1, 8.0) + q.x) / 8.0, 1.0 - (floor(f1 / 8.0) + 1.0 - q.y) / 6.0)).rgb;
        vec3 wc = texture2D(uWheatA, vec2((mod(g0, 8.0) + q2.x) / 8.0, 1.0 - (floor(g0 / 8.0) + 1.0 - q2.y) / 6.0)).rgb;
        vec3 wd = texture2D(uWheatA, vec2((mod(g1, 8.0) + q2.x) / 8.0, 1.0 - (floor(g1 / 8.0) + 1.0 - q2.y) / 6.0)).rgb;
        vec3 wt = sqrt(mix(wa, wb, fract(ft)) * mix(wc, wd, fract(ft)));
        cwWm = mix(vec3(1.0), clamp(wt / uWheatAvg, 0.0, 2.2), wk * 0.85); } } }
  #ifdef USE_MAP
    vec4 cwTx = texture2D(map, vMapUv + cwOff);
    if (uGround > 0.5) diffuseColor.rgb *= mix(cwG * cwWm, cwTx.rgb, cwTx.a); else diffuseColor *= vec4(cwTx.rgb * cwWm, cwTx.a);
  #endif` : '#include <map_fragment>') + `
  float cwSheen = 0.0, cwWarm = 0.0;
  if (uLive > 0.5) {
    cwWarm = 0.5 + 0.5 * sin(uT * 0.10472);   // ~60 s sun-warmth cycle, shared with the fog colour (tick)
    // cloud shadows: soft fbm blobs drifting slowly from the west; at most 18% darker, lit patches a touch warmer
    vec2 cp = vCwW.xz / 900.0 + vec2(uT * 0.010, uT * 0.004);
    float sh = smoothstep(0.50, 0.72, cwF(cp)), lit = 1.0 - sh;
    diffuseColor.rgb *= (1.0 - 0.18 * sh) * mix(vec3(1.0), vec3(1.035, 1.012, 0.975), lit);

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
    try { buildRibbon(W); } catch (e) { console.warn('3D creek skipped:', e.message); }
  }

  // ---------- session 19: the creek as a real 3D water surface ----------
  // A ribbon mesh laid along the creek, lit live: the moving surface comes from a Blender-rendered normal flipbook (CW.WATERFLOW,
  // seamless along the flow and in time), plus the wake heightfield (CW.WAKE). Sky reflection with fresnel, sun highlight,
  // deep slate-teal mid-channel, see-through shallows at the banks and fords, hidden under bridges.
  const RIB_VS = `attribute vec2 aFlow; attribute float aX, aD; varying vec2 vUv, vFlow, vMap; varying float vX, vD; varying vec3 vW; uniform vec2 uMap;
    void main() { vUv = uv; vFlow = aFlow; vX = aX; vD = aD; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vMap = w.xz + uMap * 0.5; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const RIB_FS = `uniform sampler2D uAtlas, uWake; uniform float uT, uLive, uFps; uniform vec2 uMap, uWTx; uniform vec4 uWBox; uniform vec3 uSun, uFog; uniform vec2 uFogR;
    varying vec2 vUv, vFlow, vMap; varying float vX, vD; varying vec3 vW;
    vec3 cell(float f, vec2 uv) { float c = mod(f, 8.0), r = floor(f / 8.0); vec2 q = vec2(clamp(uv.x, 0.02, 0.98), fract(uv.y) * 0.992 + 0.004);
      return texture2D(uAtlas, vec2((c + q.x) / 8.0, 1.0 - (r + 1.0 - q.y) / 6.0)).rgb; }
    void main() {
      float ft = uLive > 0.5 ? uT * uFps : 0.0, f0 = mod(floor(ft), 48.0), f1 = mod(f0 + 1.0, 48.0);
      vec3 tx = mix(cell(f0, vUv), cell(f1, vUv), fract(ft));
      vec3 tx2 = mix(cell(mod(f0 + 24.0, 48.0), vUv * vec2(1.0, 2.3) + vec2(0.0, 0.37)), cell(mod(f1 + 24.0, 48.0), vUv * vec2(1.0, 2.3) + vec2(0.0, 0.37)), fract(ft));
      vec2 nt = (tx.rg * 2.0 - 1.0) * 0.75 + (tx2.rg * 2.0 - 1.0) * 0.45;          // tangent-space slope (x across, y downstream): broad flow + finer ripples
      vec3 al = normalize(vec3(vFlow.x, 0.0, vFlow.y)), ac = vec3(-al.z, 0.0, al.x);
      vec3 N = normalize(vec3(0.0, 1.0, 0.0) + ac * nt.x + al * nt.y);
      float wk = 0.0;
      if (uWBox.z > 0.0) { vec2 wuv = (vMap - uWBox.xy) / uWBox.zw;
        if (wuv.x > 0.0 && wuv.x < 1.0 && wuv.y > 0.0 && wuv.y < 1.0) { wk = texture2D(uWake, wuv).r;
          vec2 g = vec2(texture2D(uWake, wuv + vec2(uWTx.x, 0.0)).r - texture2D(uWake, wuv - vec2(uWTx.x, 0.0)).r,
                        texture2D(uWake, wuv + vec2(0.0, uWTx.y)).r - texture2D(uWake, wuv - vec2(0.0, uWTx.y)).r);
          N = normalize(N - vec3(g.x, 0.0, g.y) * 1.6); } }
      vec3 V = normalize(cameraPosition - vW);
      float depth = vD * (1.0 - pow(abs(vX * 2.0 - 1.0), 2.2));                 // deepest mid-channel
      vec3 body = mix(vec3(0.085, 0.075, 0.040), vec3(0.012, 0.030, 0.024), smoothstep(0.0, 0.75, depth));
      body *= 1.0 - 0.35 * smoothstep(0.0, 0.5, -wk);
      vec3 R = reflect(-V, N);
      vec3 sky = mix(vec3(0.52, 0.47, 0.36), vec3(0.22, 0.29, 0.36), smoothstep(-0.05, 0.75, R.y));
      float fr = 0.06 + 0.94 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
      vec3 col = mix(body, sky, clamp(fr * 1.15, 0.0, 0.6));
      float sp = pow(max(dot(N, normalize(uSun + V)), 0.0), 140.0);
      col += vec3(1.0, 0.96, 0.88) * sp * 1.2;
      col += vec3(0.20, 0.22, 0.20) * smoothstep(0.62, 0.8, tx.b) * 0.35;        // crests catch a little light
      float edge = smoothstep(0.0, 0.16, vX) * smoothstep(1.0, 0.84, vX);
      float a = edge * mix(0.30, 0.94, smoothstep(0.0, 0.6, depth));
      col = mix(col, vec3(0.42, 0.40, 0.34), (1.0 - smoothstep(0.03, 0.14, min(vX, 1.0 - vX))) * smoothstep(0.03, 0.25, abs(wk)) * 0.6);   // foam at the bank, from the wake
      col = mix(col, uFog, smoothstep(uFogR.x, uFogR.y, length(cameraPosition - vW)));
      gl_FragColor = vec4(col, a * vD > 0.0 ? a : 0.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  function buildRibbon(W) {
    if (S.ribbon) { scene.remove(S.ribbon); S.ribbon.geometry.dispose(); S.ribbon = null; }
    if (!W.river || W.river.length < 2 || !window.CW.WATERFLOW) return;
    let pts = W.river; if (hAt(...pts[0]) < hAt(...pts[pts.length - 1]) - 1) pts = pts.slice().reverse();
    const rw = (W.rw || CW.R * .46) * 1.04, period = rw * 2, c = [];
    for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;   // CW.smoothPath's curve
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 4));
      for (let k = i ? 1 : 0; k <= n; k++) { const t = k / n, u = 1 - t; c.push([u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]]); } }
    const br = M.all.filter(([q, r]) => M.ter(q, r) === 'b').map(h => CW.center(...h)), fd = M.all.filter(([q, r]) => M.ter(q, r) === 'd').map(h => CW.center(...h));
    const near = (L, x, y, d) => L.reduce((m, p) => Math.min(m, Math.hypot(p[0] - x, p[1] - y)), 1e9) < d;
    const fall = (L, x, y, d0, d1) => { const d = L.reduce((m, p) => Math.min(m, Math.hypot(p[0] - x, p[1] - y)), 1e9); return Math.max(0, Math.min(1, (d - d0) / (d1 - d0))); };
    const COLS = 7, pos = [], uv = [], fl = [], ax = [], ad = [], idx = []; let s = 0;
    c.forEach(([x, y], i) => { const [px, py] = c[Math.max(0, i - 1)], [nx, ny] = c[Math.min(c.length - 1, i + 1)], L = Math.hypot(nx - px, ny - py) || 1, tx = (nx - px) / L, ty = (ny - py) / L;
      if (i) s += Math.hypot(x - c[i - 1][0], y - c[i - 1][1]);
      const dep = Math.min(fall(br, x, y, CW.R * .55, CW.R * .8), .12 + .88 * fall(fd, x, y, CW.R * .35, CW.R * .75));   // gone under bridges, shallow at fords
      for (let k = 0; k < COLS; k++) { const f = k / (COLS - 1), o = (f - .5) * rw, qx = x - ty * o, qy = y + tx * o;
        pos.push(qx - MW / 2, hAt(qx, qy) + .8, qy - MH / 2); uv.push(f, s / period); fl.push(tx, ty); ax.push(f); ad.push(dep); }
      if (i) for (let k = 0; k < COLS - 1; k++) { const a = (i - 1) * COLS + k, b = i * COLS + k; idx.push(a, b, a + 1, a + 1, b, b + 1); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(fl, 2)); geo.setAttribute('aX', new THREE.Float32BufferAttribute(ax, 1)); geo.setAttribute('aD', new THREE.Float32BufferAttribute(ad, 1)); geo.setIndex(idx);
    if (!S.rmat) { const WK = CW.WAKE ? CW.WAKE.U : { uWake: { value: null }, uWBox: { value: new THREE.Vector4() }, uWTx: { value: new THREE.Vector2(1, 1) } };
      const tex = new THREE.Texture(); tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.NoColorSpace;
      const img = new Image(); img.onload = () => { tex.image = img; tex.needsUpdate = true; if (S.ribbon) S.ribbon.visible = true; if (!S.live && S.last) try { ren.render(scene, cam); } catch (e) {} }; img.src = CW.WATERFLOW.src;
      S.rmat = new THREE.ShaderMaterial({ vertexShader: RIB_VS, fragmentShader: RIB_FS, side: THREE.DoubleSide, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        uniforms: { uAtlas: { value: tex }, uT: U.uT, uLive: U.uLive, uFps: { value: 6 }, uMap: U.uMap, uWake: WK.uWake, uWBox: WK.uWBox, uWTx: WK.uWTx,
          uSun: { value: new THREE.Vector3(-1000, 300, 300).normalize() }, uFog: { value: scene.fog.color }, uFogR: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } } });
      S.rtex = tex; }
    const m = new THREE.Mesh(geo, S.rmat); m.renderOrder = 1; m.frustumCulled = false; m.visible = !!S.rtex.image; S.ribbon = m; scene.add(m);
  }
  // brooks: still painted water plus one pale thread drifting downstream along each recorded stream path (living on only)
  const THREAD_VS = 'attribute float aS, aV; varying float vS, vV; void main() { vS = aS; vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const THREAD_FS = `uniform float uT; varying float vS, vV; float h1(float n) { return fract(sin(n * 91.7) * 43758.5453); }
    void main() { float p = vS / 46.0 - uT * 0.30, k = floor(p), f = fract(p), len = 0.35 + 0.3 * h1(k);
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
  // wheat mask at 1/8 scale (A), once per map load: crop hexes that the painter made wheat (not corn), roads cut out; then load the flipbook once
  function buildWheat() {
    if (!window.CW.WHEATFLOW || !CW.cropKind) return; const K = CW.cropKind(M), q = 8, w = Math.ceil(MW / q), h = Math.ceil(MH / q); let A = document.createElement('canvas'); A.width = w; A.height = h;
    const a = A.getContext('2d'); a.filter = 'blur(1px)'; a.scale(1 / q, 1 / q); a.fillStyle = '#fff';
    M.all.forEach(([c, r]) => { if (M.ter(c, r) === 'c' && K.get(c + ',' + r) !== 'corn') { const [x, y] = CW.center(c, r); CW.hexPath(a, x, y, CW.R * .98); a.fill(); } });
    a.filter = 'none'; a.globalCompositeOperation = 'destination-out'; a.strokeStyle = '#000'; a.lineCap = a.lineJoin = 'round';
    (M.roads || []).forEach(rd => { CW.smoothPath(a, rd.p.map(p => CW.center(...p))); a.lineWidth = (rd.major ? 11 : 8) + 6; a.stroke(); });
    const d = new Uint8Array(a.getImageData(0, 0, w, h).data.buffer.slice(0)); A.width = A.height = 0; A = null;
    if (U.uWheatM.value) U.uWheatM.value.dispose();
    const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; U.uWheatM.value = t;
    if (!U.uWheatA.value) { const tx = new THREE.Texture(); tx.minFilter = tx.magFilter = THREE.LinearFilter; tx.generateMipmaps = false; tx.colorSpace = THREE.SRGBColorSpace; U.uWheatA.value = tx;
      U.uWheatAvg.value.set(...CW.WHEATFLOW.avg); const img = new Image();
      img.onload = () => { tx.image = img; tx.needsUpdate = true; U.uWheatOn.value = 1; if (!S.live && S.last) try { ren.render(scene, cam); } catch (e) {} }; img.src = CW.WHEATFLOW.src; }
  }
  // world-mesh: the 9 ground textures as one array texture (once), and the 8 terrain weight channels at 1/4 scale (per map load)
  function buildGroundTex() {
    if (U.uGA.value) return true; const G = CW.ARTI && CW.ARTI.ground; if (!G) return false; const S2 = 512, data = new Uint8Array(S2 * S2 * 4 * GROUND_LAYERS.length);
    const c = document.createElement('canvas'); c.width = c.height = S2; const x = c.getContext('2d', { willReadFrequently: true });
    for (let i = 0; i < GROUND_LAYERS.length; i++) { const im = GROUND_LAYERS[i].map(n => G[n]).find(m => m && m.naturalWidth); if (!im) return false;
      x.drawImage(im, 0, 0, S2, S2); data.set(x.getImageData(0, 0, S2, S2).data, i * S2 * S2 * 4); }
    const t = new THREE.DataArrayTexture(data, S2, S2, GROUND_LAYERS.length); t.format = THREE.RGBAFormat; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = Math.min(8, ren.capabilities.getMaxAnisotropy()); t.needsUpdate = true;
    U.uGA.value = t; return true; }
  function buildGroundWeights() {
    const q = 4, w = Math.ceil(MW / q), h = Math.ceil(MH / q), K = CW.cropKind ? CW.cropKind(M) : new Map(), out = [new Uint8Array(w * h * 4), new Uint8Array(w * h * 4)];
    const chOf = (c, r) => { const t = M.ter(c, r); if (t === 'c') return [[K.get(c + ',' + r) === 'corn' ? 2 : 1, 1]]; return GROUND_CH[t] || [[0, 1]]; };
    const a = document.createElement('canvas'); a.width = w; a.height = h; const ax = a.getContext('2d'), b = document.createElement('canvas'); b.width = w; b.height = h; const bx = b.getContext('2d', { willReadFrequently: true });
    bx.filter = `blur(${CW.R * .2 / q}px)`;
    for (let ch = 0; ch < 8; ch++) { ax.setTransform(1, 0, 0, 1, 0, 0); ax.fillStyle = '#000'; ax.fillRect(0, 0, w, h); ax.scale(1 / q, 1 / q);
      for (let r = -1; r <= M.rows; r++) for (let cc = -1; cc <= M.cols; cc++) { const c2 = Math.max(0, Math.min(M.cols - 1, cc)), r2 = Math.max(0, Math.min(M.rows - 1, r)), e = chOf(c2, r2).find(v => v[0] === ch);
        if (!e) continue; const v = Math.round(e[1] * 255); ax.fillStyle = `rgb(${v},${v},${v})`; CW.hexPath(ax, ...CW.center(cc, r), CW.R + 6); ax.fill(); }   // generous overlap: anti-aliased seams between same-type hexes would show as a grid
      bx.clearRect(0, 0, w, h); bx.drawImage(a, 0, 0); const d = bx.getImageData(0, 0, w, h).data, o = out[ch >> 2], k = ch & 3;
      for (let i = 0; i < w * h; i++) o[i * 4 + k] = d[i * 4]; }
    a.width = a.height = b.width = b.height = 0;
    ['uGW0', 'uGW1'].forEach((n, i) => { if (U[n].value) U[n].value.dispose(); const t = new THREE.DataTexture(out[i], w, h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; U[n].value = t; });
  }
  // the painted props & markings alone (walls, fences, buildings, sheaves, haystacks, boulders, wagons, trees, roads, creek, labels):
  // render_art.js's own CW.paintArtFeatures drawn onto a transparent canvas with the same seed, so they sit exactly where the minimap shows them
  function buildFeatures() {
    if (!CW.paintArtFeatures || !CW.ARTI) return null; const c = document.createElement('canvas'); c.width = MW; c.height = MH; const x = c.getContext('2d'), wet = M.weather === 'mud' || M.weather === 'rain';
    const pat = (name, rot = 0, ox = 0, oy = 0, s = .42) => { const p = x.createPattern(CW.ARTI.ground[name], 'repeat'); p.setTransform(new DOMMatrix().translate(ox, oy).rotate(rot).scale(s)); return p; };
    const objs = { trees: [] }; CW.paintArtFeatures(x, M, CW.rng(11), pat, wet, objs); S.trees = objs.trees; return c; }
  function buildGround(img) {
    let feat = null; try { if (buildGroundTex()) { buildGroundWeights(); feat = buildFeatures(); } } catch (e) { console.warn('tiled ground skipped, painted map in use:', e.message); feat = null; }
    U.uGround.value = feat ? 1 : 0; try { buildObjects(feat ? S.trees || [] : []); } catch (e) { console.warn('3D trees skipped:', e.message); } if (S.feat && S.feat !== feat) { S.feat.width = S.feat.height = 0; } S.feat = feat;
    ttex.image = feat || img; ttex.needsUpdate = true; }
  // ---------- world pass 2: trees and the mill as objects standing on the mesh ----------
  // Upright camera-facing billboards from the props atlas, all trees in ONE instanced draw (plus one for their soft ground shadows).
  // Static this pass (no sway). Where a unit stands, half the trees in that hex go and the rest are shorter, so the unit reads as in the woods.
  const OBJ_VS = `attribute vec3 aBase; attribute vec4 aUv, aSz; attribute float aHex, aRnd;
    uniform sampler2D uOcc; uniform vec2 uOccN; uniform float uShadow; varying vec2 vUv, vQ; varying float vK, vDist;
    void main() {
      float k = 1.0;
      if (aHex >= 0.0) { float occ = texture2D(uOcc, (vec2(mod(aHex, uOccN.x), floor(aHex / uOccN.x)) + 0.5) / uOccN).r; if (occ > 0.5) k = aRnd < 0.5 ? 0.0 : 0.62; }
      vec2 c = position.xy + 0.5; vQ = c; vK = k; float w = aSz.x * k, h = aSz.y * k, vi = 1.0 - c.y;
      vUv = vec2(aUv.x + c.x * aUv.z, 1.0 - (aUv.y + vi * aUv.w));
      vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), Uc = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      vec3 U = normalize(mix(vec3(0.0, 1.0, 0.0), Uc, 0.3)), wp;
      if (uShadow > 0.5) wp = aBase + vec3((c.x - 0.5) * abs(w) * 1.25 + abs(w) * 0.32, 0.9, (c.y - 0.5) * abs(w) * 0.5 + abs(w) * 0.06);   // long-ish shadow to the east (sun in the west)
      else wp = aBase + R * (c.x - aSz.z) * w + U * (aSz.w - vi) * h;
      vec4 mv = viewMatrix * vec4(wp, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const OBJ_FS = `uniform sampler2D uAtlas; uniform float uShadow; uniform vec3 uLight, uFog; uniform vec2 uFogR; varying vec2 vUv, vQ; varying float vK, vDist;
    void main() {
      if (vK <= 0.0) discard;
      if (uShadow > 0.5) { float d = length((vQ - 0.5) * 2.0); gl_FragColor = vec4(0.10, 0.08, 0.14, (1.0 - smoothstep(0.35, 1.0, d)) * 0.32); return; }
      vec4 t = texture2D(uAtlas, vUv); if (t.a < 0.45) discard;
      vec3 col = mix(t.rgb * uLight, uFog, smoothstep(uFogR.x, uFogR.y, vDist));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const MILL = { hex: [6, 10], frame: 'bldg_mill', dx: .18, dy: .3, w: 1.2 };   // water mill on the west bank by Stone Bridge (John, 7 Oct); visual only
  function buildObjects(trees) {
    if (S.objs) { S.objs.forEach(m => { scene.remove(m); }); S.objs[0].geometry.dispose(); S.objs[1].geometry.dispose(); S.objs = null; }
    const A = CW.ARTI, F = A && A.frames; if (!F || !A.props || !A.props.naturalWidth) return;
    const AW = A.props.naturalWidth, AH = A.props.naturalHeight, list = trees.slice();
    if (M.in(...MILL.hex) && F[MILL.frame]) { const [x, y] = CW.center(...MILL.hex); list.push([MILL.frame, x + MILL.dx * CW.R, y + MILL.dy * CW.R, MILL.w * CW.R, false, true]); }
    const n = list.length, base = new Float32Array(n * 3), uv = new Float32Array(n * 4), sz = new Float32Array(n * 4), hx = new Float32Array(n), rn = new Float32Array(n), rnd = CW.rng(23);
    list.forEach(([nm, x, y, w, flip, fixed], i) => { const f = F[nm]; if (!f) { sz[i * 4] = 0; return; } const [sx, sy, sw, sh, ax, ay] = f, b = W3(x, y);
      base.set([b.x, b.y - 1.5, b.z], i * 3); uv.set([sx / AW, sy / AH, sw / AW, sh / AH], i * 4);
      sz.set([flip ? -w : w, w * sh / sw, ax, ay], i * 4);   // negative width mirrors the sprite about its anchor
      const h = fixed ? null : CW.pixelToHex(M, x, y); hx[i] = h ? h[1] * M.cols + h[0] : -1; rn[i] = rnd(); });
    const mk = shadow => { const g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1); g.index = q.index; g.setAttribute('position', q.attributes.position);
      g.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3)); g.setAttribute('aUv', new THREE.InstancedBufferAttribute(uv, 4)); g.setAttribute('aSz', new THREE.InstancedBufferAttribute(sz, 4));
      g.setAttribute('aHex', new THREE.InstancedBufferAttribute(hx, 1)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rn, 1)); g.instanceCount = n;
      const m = new THREE.Mesh(g, shadow ? S.omat[1] : S.omat[0]); m.frustumCulled = false; m.renderOrder = shadow ? 1 : 0; scene.add(m); return m; };
    if (!S.omat) { const t = new THREE.Texture(A.props); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      S.occ = new THREE.DataTexture(new Uint8Array(M.cols * M.rows * 4), M.cols, M.rows, THREE.RGBAFormat); S.occ.needsUpdate = true;
      const un = { uAtlas: { value: t }, uOcc: { value: S.occ }, uOccN: { value: new THREE.Vector2(M.cols, M.rows) }, uLight: { value: new THREE.Vector3(.58, .54, .49) }, uFog: { value: scene.fog.color }, uFogR: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } };
      S.omat = [0, 1].map(sh => new THREE.ShaderMaterial({ vertexShader: OBJ_VS, fragmentShader: OBJ_FS, uniforms: { ...un, uShadow: { value: sh } }, side: THREE.DoubleSide,
        transparent: !!sh, depthWrite: !sh, polygonOffset: !!sh, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); }
    S.objs = [mk(false), mk(true)]; S.occKey = null; }
  // which hexes hold a unit right now: your own units, plus the enemy infantry/cavalry the game already shows you (wake list) — never hidden enemies
  function updateOcc() { if (!S.occ || !CW.G) return; const G = CW.G, on = new Set();
    (G.units || []).forEach(u => { if (!u.gone && u.side === G.side) on.add(u.r * M.cols + u.c); });
    const src = S.src && S.src(); if (src) src.forEach(o => { const h = CW.pixelToHex(M, o.x, o.y); if (h) on.add(h[1] * M.cols + h[0]); });
    const key = [...on].sort((a, b) => a - b).join(','); if (key === S.occKey) return; S.occKey = key; const d = S.occ.image.data; d.fill(0); on.forEach(i => { d[i * 4] = 255; }); S.occ.needsUpdate = true; }
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
      U.uWheatM.value = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat); U.uWheatM.value.needsUpdate = true;
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
  const tex = img => { if (img === terrainSrc) return; terrainSrc = img; buildGround(img); try { buildWater(); } catch (e) { console.warn('water mask skipped:', e.message); } try { buildForest(); } catch (e) { console.warn('forest mask skipped:', e.message); } try { buildWheat(); } catch (e) { console.warn('wheat skipped:', e.message); }   // grass under the board edge, from the painting's own colours
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
    try { tex(terrainImg); dpr = Math.min(dpr, 1.5);   // session 19d: Retina draws the 3D board at 1.5x, not 2x (about 44% fewer pixels); units stay sharp on their own canvas
      if (ren.getPixelRatio() !== dpr || ren.domElement.width !== Math.round(w * dpr) || ren.domElement.height !== Math.round(h * dpr)) { ren.setPixelRatio(dpr); ren.setSize(w, h, false); }
      place(gc, w, h); updateOcc(); dtex.needsUpdate = true; U.uT.value = performance.now() / 1000; warmFog(); ren.render(scene, cam); return true; }
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
  return { init, on: opts => ok && !(opts && opts.flat), decal: () => dctx, render, project, local, pick, tilt, sweep, hAt, get tiltDeg() { return S.tilt; }, animating: () => !!S.anim, setLive, bench, onSlow: f => { S.onSlow = f; }, wakeSource: f => { S.src = f; }, wade: (x0, y0, x1, y1, s) => { if (S.live && CW.WAKE && CW.WAKE.ok) CW.WAKE.trail(x0, y0, x1, y1, s * WAKE_S); }, get live() { return S.live; }, get avgMs() { return S.avg || 0; }, get waterTex() { return U.uWater.value; }, get renderer() { return ren; }, get threads() { return S.threads; }, get ribbon() { return S.ribbon; }, get camera() { return cam; }, get forestTex() { return U.uForest.value; }, get failed() { return failed; } };
})();
