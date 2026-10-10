'use strict';
// WORLD pass T4: roads, walls, fences and brooks as real 3D pieces built from the map file (no painted coordinates, no Millbrook hexes).
//  - roads   : M.roads (hex-centre paths) -> one smooth ribbon per road, draped on the terrain. One continuous strip, so a road can never break at a hex border.
//  - brooks  : CW.WATER.streams (the meandered hex-edge chains; they come from M.edgeAt) -> mud bank + water ribbon.
//  - fences  : M.edgeAt 'fence' -> Kenney rail fence, 2 pieces per hex edge, pitched to follow the slope.
//  - walls   : M.edgeAt 'wall'  -> a row of 4 Kenney stones + a course of 3 flat stones on top, per hex edge.
// Meshes: assets/art/models.js (baked by tools/bake_models.py). Active only while CW.WORLD is on; with it off the painted versions are back.
CW.WorldEdges = (function () {
  const dec = (s, T) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
  const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  const col = (r, g, b, a) => [lin(r), lin(g), lin(b), a];
  let state = null;

  // ---------- placement: pure functions of the map ----------
  // every unique hex edge of a given type: [{p:[x,y], q:[x,y], k}] in map px (p->q runs along the edge)
  function edgesOf(M, type) {
    const out = [];
    M.edgeAt.forEach((types, k) => { if (!types.has(type)) return; const [c, r, d] = k.split(',').map(Number), [x, y] = CW.center(c, r);
      out.push({ p: CW.corner(x, y, d), q: CW.corner(x, y, d + 1), k: c * 7919 + r * 104729 + d * 31 }); });
    return out;
  }
  // Catmull-Rom through the points, resampled about every `step` px
  function smooth(pts, step) {
    if (pts.length < 2) return pts.slice(); const P = [pts[0], ...pts, pts[pts.length - 1]], out = [];
    for (let i = 1; i < P.length - 2; i++) { const a = P[i - 1], b = P[i], c = P[i + 1], d = P[i + 2], n = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / step));
      for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, f = j => .5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3); out.push([f(0), f(1)]); } }
    out.push(pts[pts.length - 1]); return out;
  }

  // ---------- ribbons (roads, brooks) ----------
  // cross = [[offset px, [r,g,b,a]], ...] from one side to the other; returns a Mesh draped on the terrain
  function ribbon(line, cross, W3, lift, mat, wf, af) {   // wf[i] widens/narrows the cross-section at point i, af[i] fades its alpha (both optional)
    const n = line.length, m = cross.length, pos = new Float32Array(n * m * 3), cl = new Float32Array(n * m * 4), idx = [];
    for (let i = 0; i < n; i++) { const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1, nx = -ty / L, ny = tx / L;
      for (let j = 0; j < m; j++) { const w = wf ? wf[i] : 1, v = W3(line[i][0] + nx * cross[j][0] * w, line[i][1] + ny * cross[j][0] * w), o = i * m + j; pos.set([v.x, v.y + lift, v.z], o * 3); cl.set(cross[j][1], o * 4); if (af) cl[o * 4 + 3] *= af[i];
        if (i < n - 1 && j < m - 1) { const q = o, r = o + 1, s = o + m, t = o + m + 1; idx.push(q, s, r, r, s, t); } } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(cl, 4)); g.setIndex(idx);
    const me = new THREE.Mesh(g, mat); me.frustumCulled = false; me.renderOrder = 1; return me;
  }
  const RVS = `attribute vec4 aCol; varying vec4 vC; varying vec3 vW; varying float vDist;
    void main() { vC = aCol; vW = position; vec4 mv = viewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const RFS = `uniform vec3 uFog, uTone; uniform vec2 uFogR; varying vec4 vC; varying vec3 vW; varying float vDist;
    void main() { float h = fract(sin(dot(floor(vW.xz * 0.7), vec2(12.9898, 78.233))) * 43758.5453); vec3 c = vC.rgb * uTone * (0.90 + 0.20 * h);
      gl_FragColor = vec4(mix(c, uFog, smoothstep(uFogR.x, uFogR.y, vDist)), vC.a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  // ---------- instanced pieces (fence, stones) ----------
  // Pattern 0 (fences, kit stones, trees' kin) keeps the original flat look. Patterns 1-12 (our buildings, see palette.json '_patterns')
  // are drawn here from the model's own coordinates in metres, so no texture files are needed: clapboard, brick, stone blocks,
  // shingles, tin, board-and-batten, planks, log grain, earth, hay, canvas, dirt. Every line is anti-aliased and fades out
  // when it would be thinner than ~2 screen pixels (zoomed out), so nothing shimmers. Lighting: low western sun + sky/ground fill.
  const IVS = `attribute vec3 aBase, aRot, aSc, color; attribute float aK; varying vec3 vCol, vL, vNl, vN, vW; varying float vDist, vK, vR;
    void main() {
      float cy = cos(aRot.x), sy = sin(aRot.x), cp = cos(aRot.y), sp = sin(aRot.y);
      vec3 l = position * aSc; vec3 p = vec3(l.x * cp - l.y * sp, l.x * sp + l.y * cp, l.z); p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
      vec3 n = vec3(normal.x * cp - normal.y * sp, normal.x * sp + normal.y * cp, normal.z); n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);
      float lam = max(dot(normalize(n), normalize(vec3(-0.5, 0.75, 0.25))), 0.0);   // same low western sun as the trees
      vCol = color * (0.52 + 0.62 * lam) * (0.9 + 0.2 * aRot.z) * vec3(1.04, 0.99, 0.88);
      vL = position; vNl = normal; vN = n; vK = aK; vR = aRot.z; vW = aBase + p;
      vec4 mv = viewMatrix * vec4(aBase + p, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const IFS = `uniform vec3 uFog; uniform vec2 uFogR; varying vec3 vCol, vL, vNl, vN, vW; varying float vDist, vK, vR;
    float h1(float n) { return fract(sin(n * 91.73) * 43758.5453); }
    float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
    float line(float c, float w) { float f = fract(c), d = min(f, 1.0 - f), a = fwidth(c) + 1e-4; return 1.0 - smoothstep(w - a, w + a, d); }   // 1 on a joint
    float fade(vec2 c) { vec2 f = fwidth(c); return 1.0 - smoothstep(0.22, 0.55, max(f.x, f.y)); }                                          // 0 when a cell < ~2 px
    vec3 pattern(float k, vec3 L, vec3 Nl) {
      vec2 t = normalize(vec2(-Nl.z, Nl.x) + 1e-5); float u = dot(L.xz, t), v = L.y;                      // wall-plane coordinates (metres)
      if (abs(Nl.y) > 0.92) { u = L.x; v = L.z; }                                                        // flat tops/floors
      if (k < 1.5) { float c = v / 0.30; float m = mix(0.80, 1.04, smoothstep(0.0, 0.45, fract(c))) * (0.97 + 0.06 * h1(floor(c)));   // clapboard
        return vec3(mix(0.96, m, fade(vec2(c)))); }
      if (k < 2.5) { float r = v / 0.24, x = u / 0.50 + 0.5 * mod(floor(r), 2.0); float mo = max(line(r, 0.08), line(x, 0.05));        // brick
        vec3 b = vec3(0.88 + 0.22 * h2(vec2(floor(x), floor(r)))) * vec3(1.0, 0.97, 0.95), c = mix(b, vec3(1.42, 1.36, 1.24), mo * 0.85);
        return mix(vec3(1.0), c, fade(vec2(r, x))); }
      if (k < 3.5) { float r = v / 0.50, x = u / 0.85 + h1(floor(r) + 3.0); float jo = max(line(r, 0.06), line(x, 0.05));              // stone blocks
        float m = mix(0.84 + 0.30 * h2(vec2(floor(x), floor(r))), 0.62, jo); return vec3(mix(0.98, m, fade(vec2(r, x)))); }
      if (k < 4.5) { float r = v / 0.32, x = u / 0.38 + 0.5 * mod(floor(r), 2.0);                                                     // shingles
        float m = mix(0.70, 1.02, smoothstep(0.0, 0.35, fract(r))) * (0.86 + 0.26 * h2(vec2(floor(x), floor(r)))) * (1.0 - 0.25 * line(x, 0.04));
        return vec3(mix(0.93, m, fade(vec2(r, x)))); }
      if (k < 5.5) { float x = u / 0.55; float m = 1.0 + 0.22 * line(x, 0.06) - 0.10 * line(x + 0.1, 0.05);                            // tin roof seams + rust
        vec3 c = vec3(m) * mix(vec3(1.0), vec3(1.10, 0.92, 0.80), smoothstep(0.55, 0.9, n2(L.xz * 0.9 + L.y)) * 0.6); return mix(vec3(1.0), c, fade(vec2(x))); }
      if (k < 6.5) { float x = u / 0.50; float m = (0.88 + 0.18 * h1(floor(x))) * (1.0 + 0.16 * line(x, 0.07)) * (1.0 - 0.14 * line(x + 0.12, 0.04));   // board and batten
        m *= 0.94 + 0.10 * n2(vec2(u * 2.0, v * 0.35)); return vec3(mix(0.97, m, fade(vec2(x)))); }
      if (k < 7.5) { float x = u / 0.28; float m = (0.90 + 0.16 * h1(floor(x))) * (1.0 - 0.28 * line(x, 0.05)); return vec3(mix(0.97, m, fade(vec2(x)))); }   // planks
      if (k < 8.5) return vec3(0.86 + 0.20 * n2(vec2((L.x + L.z) * 0.7, L.y * 9.0)));                                                      // log grain
      if (k < 9.5) return vec3(0.82 + 0.30 * n2(L.xz * 0.45) + 0.08 * n2(L.xz * 2.3));                                                     // earth / grass
      if (k < 10.5) return vec3(0.82 + 0.28 * n2(vec2(atan(L.z, L.x) * 6.0, L.y * 1.2)));                                                   // hay
      if (k < 11.5) return vec3((0.96 + 0.06 * n2(L.xy * 1.7)) * (1.0 - 0.12 * line(u / 0.9, 0.03)));                                     // canvas seams
      return vec3(0.86 + 0.24 * n2(L.xz * 0.6) + 0.06 * n2(L.xz * 3.0));                                                                    // dirt road
    }
    void main() {
      vec3 col = vCol;
      if (vK > 0.5) {
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        vec3 S = normalize(vec3(-0.5, 0.75, 0.25)), V = normalize(cameraPosition - vW);
        float lam = max(dot(N, S), 0.0);
        vec3 hemi = mix(vec3(0.40, 0.37, 0.32), vec3(0.50, 0.53, 0.58), N.y * 0.5 + 0.5);                   // warm ground bounce .. cool sky
        vec3 base = vCol / max((0.52 + 0.62 * max(dot(N, S), 0.0)) * (0.9 + 0.2 * vR) * vec3(1.04, 0.99, 0.88), vec3(0.05));   // undo the vertex light, keep colour + AO
        base *= pattern(vK, vL, normalize(vNl)) * (0.93 + 0.12 * n2(vW.xz * 0.04)) * (0.92 + 0.16 * vR);   // pattern, big weathering patches, per-building tint
        col = base * (hemi + 0.68 * lam * vec3(1.06, 0.98, 0.84));
        if (vK > 4.5 && vK < 5.5) col += vec3(0.20, 0.19, 0.17) * pow(max(dot(reflect(-S, N), V), 0.0), 18.0);   // tin glints
      }
      gl_FragColor = vec4(mix(col, uFog, smoothstep(uFogR.x, uFogR.y, vDist)), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  // pieces: [{kind, x, y (map px), lift, yaw, pitch, rnd, sx, sy, sz}]
  function pieces(M, W3) {
    const out = [];
    // fences: 2 pieces per hex edge, each pitched along the ground
    for (const e of edgesOf(M, 'fence')) { const rand = CW.rng(e.k + 1);
      for (let h = 0; h < 2; h++) { const a = [e.p[0] + (e.q[0] - e.p[0]) * h / 2, e.p[1] + (e.q[1] - e.p[1]) * h / 2], b = [e.p[0] + (e.q[0] - e.p[0]) * (h + 1) / 2, e.p[1] + (e.q[1] - e.p[1]) * (h + 1) / 2],
          A = W3(...a), B = W3(...b), dx = B.x - A.x, dz = B.z - A.z, run = Math.hypot(dx, dz) || 1;
        out.push({ kind: 'fence', x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, lift: 0, yaw: Math.atan2(-dz, dx), pitch: Math.atan2(B.y - A.y, run), rnd: rand(), sx: run * 1.05, sy: run * 1.6, sz: run * 1.9 }); } }
    // walls: 4 big stones along the edge + 3 flat capstones between them
    for (const e of edgesOf(M, 'wall')) { const rand = CW.rng(e.k + 2), dx = e.q[0] - e.p[0], dy = e.q[1] - e.p[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, yaw0 = Math.atan2(-dy, dx);
      for (let i = 0; i < 4; i++) { const t = (i + .5) / 4, j = (rand() - .5) * 2.4;
        out.push({ kind: 'stoneA', x: e.p[0] + dx * t + nx * j, y: e.p[1] + dy * t + ny * j, lift: -.6, yaw: yaw0 + (rand() - .5) * .4, pitch: 0, rnd: rand(), sx: 12.5 * (.9 + rand() * .25), sy: 21 * (.85 + rand() * .3), sz: 6.6 * (.9 + rand() * .25) }); }
      for (let i = 1; i < 4; i++) { const t = i / 4, j = (rand() - .5) * 2;
        out.push({ kind: 'stoneB', x: e.p[0] + dx * t + nx * j, y: e.p[1] + dy * t + ny * j, lift: 5.6, yaw: yaw0 + (rand() - .5) * .5, pitch: 0, rnd: rand(), sx: 11 * (.9 + rand() * .2), sy: 26, sz: 7 * (.9 + rand() * .2) }); } }
    return out;
  }

  // one instanced mesh per kind. items: [{kind, x, y (map px), lift, yaw, pitch, rnd, sx, sy, sz}]; MESH = baked meshes (edge_meshes.js / struct_meshes.js); also used by world_structures.js
  function instanced(scene, list, EM, kinds, fog) {
    const out = [];
    for (const kind of kinds) { const items = list.filter(t => t.kind === kind), n = items.length; if (!n) continue; const m = EM[kind], W3 = list.W3;
      const base = new Float32Array(n * 3), rot = new Float32Array(n * 3), sc = new Float32Array(n * 3);
      items.forEach((t, i) => { const b = W3(t.x, t.y); base.set([b.x, b.y + t.lift, b.z], i * 3); rot.set([t.yaw, t.pitch, t.rnd], i * 3); sc.set([t.sx, t.sy, t.sz], i * 3); });
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(dec(m.p, Float32Array), 3)); g.setAttribute('normal', new THREE.BufferAttribute(dec(m.nm, Float32Array), 3));
      g.setAttribute('color', new THREE.BufferAttribute(dec(m.c, Uint8Array), 3, true)); g.setIndex(new THREE.BufferAttribute(dec(m.i, Uint16Array), 1));
      g.setAttribute('aK', new THREE.BufferAttribute(m.k ? new Float32Array(dec(m.k, Uint8Array)) : new Float32Array(m.n), 1));   // surface pattern id per vertex
      g.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3)); g.setAttribute('aRot', new THREE.InstancedBufferAttribute(rot, 3)); g.setAttribute('aSc', new THREE.InstancedBufferAttribute(sc, 3)); g.instanceCount = n;
      const me = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: IVS, fragmentShader: IFS, uniforms: { ...fog }, side: THREE.DoubleSide })); me.frustumCulled = false; me.renderOrder = 0;
      scene.add(me); out.push(me); }
    return out;
  }

  // env: { scene, M, W3 (map px -> world), U (unused today) }
  function build(env) {
    const { scene, M, W3 } = env, EM = CW.EDGEMESH; if (!EM) throw new Error('models.js missing');
    dispose(); const parts = [], stats = { roads: 0, brooks: 0, pieces: 0 };
    const fog = { uFog: { value: scene.fog.color }, uFogR: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } };
    const rmat = (tone, po) => new THREE.ShaderMaterial({ vertexShader: RVS, fragmentShader: RFS, uniforms: { ...fog, uTone: { value: new THREE.Vector3(...tone) } }, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: po, polygonOffsetUnits: po, side: THREE.DoubleSide });
    // roads
    const roadMat = rmat([.84, .80, .72], -4);
    for (const rd of M.roads) { const hw = rd.major ? 6.5 : 5, line = smooth(rd.p.map(p => CW.center(...p)), 4);
      const cross = [[-hw * 1.4, col(70, 52, 30, 0)], [-hw * 1.08, col(86, 64, 38, .5)], [-hw * .72, col(136, 108, 70, 1)], [0, col(158, 130, 88, 1)], [hw * .72, col(136, 108, 70, 1)], [hw * 1.08, col(86, 64, 38, .5)], [hw * 1.4, col(70, 52, 30, 0)]];
      const me = ribbon(line, cross, W3, 1.3, roadMat); scene.add(me); parts.push(me); stats.roads++; }
    // brooks: the water itself is the river's own water ribbon (render3d.js buildRibbon); here only the mud bank under it and the gravel beside it.
    // Lines come from the map file alone (world_water.js), spring first, mouth last.
    const bankMat = rmat([.86, .84, .78], -1), pebbles = [], pr = CW.rng(4242);
    for (const pts of (CW.WorldWater ? CW.WorldWater.fromMap(M).streams : [])) { if (pts.length < 2) continue;
      const line = smooth(pts, 4), n = line.length, wf = new Float32Array(n), af = new Float32Array(n); let run = 0;
      for (let i = 1; i < n; i++) run += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      let acc = 0; for (let i = 0; i < n; i++) { if (i) acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); const u = acc / (run || 1);
        wf[i] = .55 + .75 * u; af[i] = Math.min(1, acc / 70);                                              // same taper as the water ribbon
        if (i % 4 === 1 && i < n - 1) { const a = line[i - 1], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, sd = (i % 2 ? 1 : -1) * (7.6 * wf[i] + pr() * 2.5), sz = 1.3 + pr() * 1.5;
          pebbles.push({ kind: 'stoneB', x: line[i][0] + nx * sd, y: line[i][1] + ny * sd, lift: .4, yaw: pr() * 6.283, pitch: 0, rnd: pr(), sx: sz * 1.4, sy: sz * 4, sz: sz * 1.2 }); } }
      const cross = [[-11, col(70, 56, 34, 0)], [-8, col(72, 56, 34, .55)], [-5.4, col(60, 48, 30, .95)], [0, col(46, 38, 26, 1)], [5.4, col(60, 48, 30, .95)], [8, col(72, 56, 34, .55)], [11, col(70, 56, 34, 0)]];
      const me = ribbon(line, cross, W3, 1.0, bankMat, wf, af); me.renderOrder = 0; scene.add(me); parts.push(me); stats.brooks++; }
    // fences and walls: one instanced mesh per kind
    const list = pieces(M, W3).concat(pebbles); list.W3 = W3;
    const inst = instanced(scene, list, EM, ['fence', 'stoneA', 'stoneB'], fog); inst.forEach(m => parts.push(m)); stats.pieces += list.length;
    state = { scene, parts }; return stats;
  }
  function dispose() { if (!state) return; state.parts.forEach(m => { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); state = null; }
  return { build, dispose, edgesOf, smooth, instanced };
})();
