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
  function ribbon(line, cross, W3, lift, mat, wf, af, road) {   // wf[i] widens/narrows the cross-section at point i, af[i] fades its alpha (both optional)
    const n = line.length, m = cross.length, pos = new Float32Array(n * m * 3), cl = new Float32Array(n * m * 4), st = new Float32Array(n * m * 4), idx = [], amax = Math.max(...cross.map(c => Math.abs(c[0])));
    let run = 0;
    for (let i = 0; i < n; i++) { if (i) run += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1, nx = -ty / L, ny = tx / L;
      for (let j = 0; j < m; j++) { const w = wf ? wf[i] : 1, v = W3(line[i][0] + nx * cross[j][0] * w, line[i][1] + ny * cross[j][0] * w), o = i * m + j; pos.set([v.x, v.y + lift, v.z], o * 3); cl.set(cross[j][1], o * 4); if (af) cl[o * 4 + 3] *= af[i]; st.set([run, cross[j][0] / amax, road ? road.major : 0, road ? road.seed : 0], o * 4);
        if (i < n - 1 && j < m - 1) { const q = o, r = o + 1, s = o + m, t = o + m + 1; idx.push(q, s, r, r, s, t); } } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(cl, 4)); if (road) g.setAttribute('aST', new THREE.BufferAttribute(st, 4)); g.setIndex(idx);
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

  // Roads: a dirt ribbon with two wheel ruts that wander together (an axle's width apart), fade and deepen unevenly; a grass strip down
  // country lanes; puddles in the ruts here and there; churned, pebbly surface; ragged edges. Every road has its own seed.
  const ROAD_VS = `attribute vec4 aCol, aST; varying vec4 vC, vST; varying vec3 vW; varying float vDist;
    void main() { vC = aCol; vST = aST; vW = position; vec4 mv = viewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const ROAD_FS = `uniform vec3 uFog, uTone; uniform vec2 uFogR; varying vec4 vC, vST; varying vec3 vW; varying float vDist;
    float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
    float n1(float x) { return n2(vec2(x, 0.37)); }
    void main() {
      float s = vST.x + vST.w * 977.0, a = vST.y, major = vST.z;
      vec3 c = vC.rgb * uTone;
      float off = (n1(s * 0.011) - 0.5) * 0.22 + (n1(s * 0.041 + 5.0) - 0.5) * 0.06;                   // the cart track drifts across the road
      float gauge = 0.30 * (1.0 + (n1(s * 0.02 + 9.0) - 0.5) * 0.18), rut = 0.0, wet = 0.0;
      for (int k = 0; k < 2; k++) { float sd = k == 0 ? -1.0 : 1.0, d = abs(a - off - sd * gauge);
        float w = 0.10 + 0.05 * n1(s * 0.05 + sd * 3.0), deep = smoothstep(0.15, 0.75, n1(s * 0.023 + sd * 11.0 + 2.0));
        float aa = fwidth(a) * 1.5; rut = max(rut, (1.0 - smoothstep(w * 0.35 - aa, w + aa, d)) * deep); wet = max(wet, 1.0 - smoothstep(w * 0.6, w * 1.3, d)); }
      c *= 1.0 - 0.44 * rut; c = mix(c, c * vec3(0.86, 0.84, 0.88), rut * 0.5);                         // ruts: darker, slightly damp
      float hump = (1.0 - major) * (1.0 - smoothstep(0.05, 0.14, abs(a - off))) * smoothstep(0.35, 0.62, n2(vec2(s * 0.09, a * 5.0)));
      c = mix(c, vec3(0.105, 0.135, 0.050) * (0.8 + 0.5 * n2(vW.xz * 0.9)), hump * 0.75);               // grass down the middle of a lane
      float pud = smoothstep(0.80, 0.88, n2(vec2(s * 0.014, 0.5) + vST.w * 3.1)) * wet;
      c = mix(c, vec3(0.085, 0.10, 0.11) + 0.05 * n2(vW.xz * 0.6), pud * 0.85);                           // puddles
      c *= 0.88 + 0.22 * n2(vW.xz * 0.22) + 0.05 * n2(vW.xz * 1.7);                                         // churned by hooves and boots
      c += vec3(0.05, 0.045, 0.035) * step(0.955, h2(floor(vW.xz * 1.6))) * (1.0 - rut);                // stray pebbles
      float alpha = vC.a * smoothstep(0.0, 0.16, (1.0 - abs(a)) - 0.30 * (n2(vec2(s * 0.06, a > 0.0 ? 3.0 : 9.0)) - 0.5));   // ragged edges
      gl_FragColor = vec4(mix(c, uFog, smoothstep(uFogR.x, uFogR.y, vDist)), alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  // ---------- instanced pieces (fence, stones) ----------
  // Pattern 0 (fences, kit stones, trees' kin) keeps the original flat look. Patterns 1-12 (our buildings, see palette.json '_patterns')
  // are drawn here from the model's own coordinates in metres, so no texture files are needed: clapboard, brick, stone blocks,
  // shingles, tin, board-and-batten, planks, log grain, earth, hay, canvas, dirt. Every line is anti-aliased and fades out
  // when it would be thinner than ~2 screen pixels (zoomed out), so nothing shimmers. Lighting: low western sun + sky/ground fill.
  const IVS = `attribute vec3 aBase, aRot, aSc, color; attribute float aK; varying vec3 vCol, vL, vNl, vN, vW; varying float vDist, vK, vR0;
    void main() {
      float cy = cos(aRot.x), sy = sin(aRot.x), cp = cos(aRot.y), sp = sin(aRot.y);
      vec3 l = position * aSc; vec3 p = vec3(l.x * cp - l.y * sp, l.x * sp + l.y * cp, l.z); p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
      vec3 n = vec3(normal.x * cp - normal.y * sp, normal.x * sp + normal.y * cp, normal.z); n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);
      float lam = max(dot(normalize(n), normalize(vec3(-0.5, 0.75, 0.25))), 0.0);   // same low western sun as the trees
      vCol = color * (0.52 + 0.62 * lam) * (0.9 + 0.2 * aRot.z) * vec3(1.04, 0.99, 0.88);
      vL = position; vNl = normal; vN = n; vK = aK; vR0 = aRot.z; vW = aBase + p;
      vec4 mv = viewMatrix * vec4(aBase + p, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const IFS = `uniform vec3 uFog; uniform vec2 uFogR; varying vec3 vCol, vL, vNl, vN, vW; varying float vDist, vK, vR0;
    float vR;   // per-building random number, snapped so tiny interpolation errors can't flip a building's paint pixel by pixel
    float h1(float n) { return fract(sin(n * 91.73) * 43758.5453); }
    float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
    float line(float c, float w) { float f = fract(c), d = min(f, 1.0 - f), a = fwidth(c) + 1e-4; return 1.0 - smoothstep(w - a, w + a, d); }   // 1 on a joint
    float fade(vec2 c) { vec2 f = fwidth(c); return 1.0 - smoothstep(0.22, 0.55, max(f.x, f.y)); }                                          // 0 when a cell < ~2 px
    vec3 pattern(float k, vec3 L, vec3 Nl) {
      L += vec3(vR * 13.7, vR * 0.71, vR * 7.3);                                                        // every instance's boards/bricks start somewhere else
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
      if (k < 12.5) return vec3(0.86 + 0.24 * n2(L.xz * 0.6) + 0.06 * n2(L.xz * 3.0));                                                    // dirt road
      if (k < 13.5) { float m = 0.62 + 0.34 * n2(L.xz * 5.1 + L.y * 4.3) + 0.08 * n2(L.xz * 17.0 + L.y * 13.0);                             // fieldstone: mottled
        return mix(vec3(m), vec3(m) * vec3(1.18, 1.14, 0.86), smoothstep(0.70, 0.80, n2(L.xz * 14.0 + L.y * 11.0 + 4.0)) * 0.6); }                    //  + pale lichen
      if (k < 14.5) return vec3(0.78 + 0.32 * n2(vec2((L.x + L.z) * 1.3, L.y * 22.0)) + 0.06 * h1(floor((L.x + L.z) * 0.3)));          // weathered rail wood
      return vec3(0.78 + 0.40 * n2(L.xz * 4.0 + L.y * 3.0));                                                                                // leafy greens / moss
    }
    vec3 paint(float r) {   // house paint per building: white, cream, pale yellow, dove grey, faded red, pale green
      float i = floor(h1(r * 7.31 + 0.5) * 6.0);
      return i < 1.0 ? vec3(1.0) : i < 2.0 ? vec3(1.0, 0.95, 0.83) : i < 3.0 ? vec3(1.02, 0.93, 0.68) : i < 4.0 ? vec3(0.80, 0.82, 0.84) : i < 5.0 ? vec3(0.86, 0.60, 0.52) : vec3(0.84, 0.92, 0.80); }
    void main() {
      vR = floor(vR0 * 1000.0 + 0.5) / 1000.0;
      vec3 col = vCol;
      if (vK > 0.5) {
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        vec3 S = normalize(vec3(-0.5, 0.75, 0.25)), V = normalize(cameraPosition - vW);
        float lam = max(dot(N, S), 0.0);
        vec3 hemi = mix(vec3(0.40, 0.37, 0.32), vec3(0.50, 0.53, 0.58), N.y * 0.5 + 0.5);                   // warm ground bounce .. cool sky
        vec3 base = vCol / max((0.52 + 0.62 * max(dot(N, S), 0.0)) * (0.9 + 0.2 * vR) * vec3(1.04, 0.99, 0.88), vec3(0.05));   // undo the vertex light, keep colour + AO
        base *= pattern(vK, vL, normalize(vNl)) * (0.93 + 0.12 * n2(vW.xz * 0.04)) * (0.92 + 0.16 * vR);   // pattern, big weathering patches, per-building tint
        if (vK < 1.5) base *= paint(vR);                                                                   // clapboard: each house its own paint
        else if (vK > 3.5 && vK < 4.5) base *= mix(vec3(0.80, 0.83, 0.88), vec3(1.14, 1.04, 0.92), h1(vR * 5.3));   // roofs: new / weathered / mossy-dark
        else if (vK > 5.5 && vK < 6.5) base *= 0.82 + 0.34 * h1(vR * 3.7);                                  // barn boards: fresh paint .. faded
        else if (vK > 1.5 && vK < 2.5) base *= vec3(1.0, 0.95, 0.92) * (0.88 + 0.22 * h1(vR * 9.1));       // brick batches
        else if (vK > 12.5) base *= mix(vec3(0.92, 0.95, 1.0), vec3(1.08, 1.02, 0.92), h1(vR * 4.9));      // stones / rails / greens: warm or cool
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
    const EMm = CW.EDGEMESH, hOf = k => (EMm[k] && EMm[k].h) || .33;
    // fences: per hex edge one style (snake rail mostly, sometimes post-and-rail), 2 sections pitched along the ground, zig-zag phase random
    for (const e of edgesOf(M, 'fence')) { const rand = CW.rng(e.k + 1), r0 = rand(), kind = r0 < .45 ? 'worm_a' : r0 < .82 ? 'worm_b' : 'post_rail';
      for (let h = 0; h < 2; h++) { const a = [e.p[0] + (e.q[0] - e.p[0]) * h / 2, e.p[1] + (e.q[1] - e.p[1]) * h / 2], b = [e.p[0] + (e.q[0] - e.p[0]) * (h + 1) / 2, e.p[1] + (e.q[1] - e.p[1]) * (h + 1) / 2],
          A = W3(...a), B = W3(...b), dx = B.x - A.x, dz = B.z - A.z, run = Math.hypot(dx, dz) || 1, flip = rand() < .5, k = run / 6.2;
        out.push({ kind, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, lift: 0, yaw: Math.atan2(-dz, dx) + (flip ? Math.PI : 0), pitch: Math.atan2(B.y - A.y, run) * (flip ? -1 : 1), rnd: rand(),
          sx: k * (1.02 + rand() * .06), sy: run * (.34 + rand() * .07), sz: k * (1.1 + rand() * .4) }); } }
    // walls: 5 field stones of 6 shapes along the edge (each its own size, tilt and tint), 4 flat capstones of 3 shapes, rubble at the foot
    const BIG = ['stoneA', 'stoneC', 'stoneD', 'stoneE', 'stoneF', 'stoneG'], CAP = ['stoneB', 'capB', 'capC'];
    for (const e of edgesOf(M, 'wall')) { const rand = CW.rng(e.k + 2), dx = e.q[0] - e.p[0], dy = e.q[1] - e.p[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, yaw0 = Math.atan2(-dy, dx);
      for (let i = 0; i < 5; i++) { const t = (i + .3 + rand() * .4) / 5, j = (rand() - .5) * 2.6, kind = BIG[Math.floor(rand() * BIG.length)], ht = 6 + rand() * 2.5;
        out.push({ kind, x: e.p[0] + dx * t + nx * j, y: e.p[1] + dy * t + ny * j, lift: -.6 - rand() * .5, yaw: yaw0 + (rand() - .5) * .6, pitch: (rand() - .5) * .25, rnd: rand(),
          sx: 10 * (.85 + rand() * .35), sy: ht / hOf(kind), sz: 6.4 * (.85 + rand() * .3) }); }
      for (let i = 0; i < 4; i++) { const t = (i + .5 + (rand() - .5) * .3) / 4, j = (rand() - .5) * 2, kind = CAP[Math.floor(rand() * CAP.length)];
        out.push({ kind, x: e.p[0] + dx * t + nx * j, y: e.p[1] + dy * t + ny * j, lift: 5.2 + rand() * .8, yaw: yaw0 + (rand() - .5) * .7, pitch: (rand() - .5) * .2, rnd: rand(),
          sx: 9 * (.8 + rand() * .4), sy: (2.6 + rand() * 1.4) / hOf(kind), sz: 6.6 * (.85 + rand() * .3) }); }
      for (let i = 0; i < 2; i++) { const t = rand(), sd = rand() < .5 ? -1 : 1, kind = rand() < .5 ? 'stoneB' : BIG[Math.floor(rand() * BIG.length)], sz = 2.5 + rand() * 2;
        out.push({ kind, x: e.p[0] + dx * t + nx * sd * (4.5 + rand() * 2), y: e.p[1] + dy * t + ny * sd * (4.5 + rand() * 2), lift: -.5, yaw: rand() * 6.283, pitch: (rand() - .5) * .5, rnd: rand(), sx: sz * 1.4, sy: sz / hOf(kind) * .6, sz: sz }); } }
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
    const roadMat = new THREE.ShaderMaterial({ vertexShader: ROAD_VS, fragmentShader: ROAD_FS, uniforms: { ...fog, uTone: { value: new THREE.Vector3(.84, .80, .72) } }, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
    let ri = 0;
    for (const rd of M.roads) { const hw = rd.major ? 6.5 : 5, line = smooth(rd.p.map(p => CW.center(...p)), 4);
      const cross = [[-hw * 1.4, col(70, 52, 30, 0)], [-hw * 1.08, col(86, 64, 38, .5)], [-hw * .72, col(136, 108, 70, 1)], [0, col(158, 130, 88, 1)], [hw * .72, col(136, 108, 70, 1)], [hw * 1.08, col(86, 64, 38, .5)], [hw * 1.4, col(70, 52, 30, 0)]];
      const me = ribbon(line, cross, W3, 1.3, roadMat, null, null, { major: rd.major ? 1 : 0, seed: ++ri }); scene.add(me); parts.push(me); stats.roads++; }
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
    const inst = instanced(scene, list, EM, [...new Set(list.map(o => o.kind))], fog); inst.forEach(m => parts.push(m)); stats.pieces += list.length;
    state = { scene, parts }; return stats;
  }
  function dispose() { if (!state) return; state.parts.forEach(m => { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); state = null; }
  return { build, dispose, edgesOf, smooth, instanced };
})();
