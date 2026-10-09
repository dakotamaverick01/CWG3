'use strict';
// WORLD pass T4: roads, walls, fences and brooks as real 3D pieces built from the map file (no painted coordinates, no Millbrook hexes).
//  - roads   : M.roads (hex-centre paths) -> one smooth ribbon per road, draped on the terrain. One continuous strip, so a road can never break at a hex border.
//  - brooks  : CW.WATER.streams (the meandered hex-edge chains; they come from M.edgeAt) -> mud bank + water ribbon.
//  - fences  : M.edgeAt 'fence' -> Kenney rail fence, 2 pieces per hex edge, pitched to follow the slope.
//  - walls   : M.edgeAt 'wall'  -> a row of 4 Kenney stones + a course of 3 flat stones on top, per hex edge.
// Meshes: assets/art/edge_meshes.js (baked by tools/build_tree_meshes.py). Active only while CW.WORLD is on; with it off the painted versions are back.
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
  function ribbon(line, cross, W3, lift, mat) {
    const n = line.length, m = cross.length, pos = new Float32Array(n * m * 3), cl = new Float32Array(n * m * 4), idx = [];
    for (let i = 0; i < n; i++) { const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1, nx = -ty / L, ny = tx / L;
      for (let j = 0; j < m; j++) { const v = W3(line[i][0] + nx * cross[j][0], line[i][1] + ny * cross[j][0]), o = i * m + j; pos.set([v.x, v.y + lift, v.z], o * 3); cl.set(cross[j][1], o * 4);
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
  const IVS = `attribute vec3 aBase, aRot, aSc, color; varying vec3 vCol; varying float vDist;
    void main() {
      float cy = cos(aRot.x), sy = sin(aRot.x), cp = cos(aRot.y), sp = sin(aRot.y);
      vec3 l = position * aSc; vec3 p = vec3(l.x * cp - l.y * sp, l.x * sp + l.y * cp, l.z); p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
      vec3 n = vec3(normal.x * cp - normal.y * sp, normal.x * sp + normal.y * cp, normal.z); n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);
      float lam = max(dot(normalize(n), normalize(vec3(-0.5, 0.75, 0.25))), 0.0);   // same low western sun as the trees
      vCol = color * (0.52 + 0.62 * lam) * (0.9 + 0.2 * aRot.z) * vec3(1.04, 0.99, 0.88);
      vec4 mv = viewMatrix * vec4(aBase + p, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const IFS = `uniform vec3 uFog; uniform vec2 uFogR; varying vec3 vCol; varying float vDist;
    void main() { gl_FragColor = vec4(mix(vCol, uFog, smoothstep(uFogR.x, uFogR.y, vDist)), 1.0);
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

  // env: { scene, M, W3 (map px -> world), U (unused today) }
  function build(env) {
    const { scene, M, W3 } = env, EM = CW.EDGEMESH; if (!EM) throw new Error('edge_meshes.js missing');
    dispose(); const parts = [], stats = { roads: 0, brooks: 0, pieces: 0 };
    const fog = { uFog: { value: scene.fog.color }, uFogR: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } };
    const rmat = (tone, po) => new THREE.ShaderMaterial({ vertexShader: RVS, fragmentShader: RFS, uniforms: { ...fog, uTone: { value: new THREE.Vector3(...tone) } }, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: po, polygonOffsetUnits: po, side: THREE.DoubleSide });
    // roads
    const roadMat = rmat([.84, .80, .72], -4);
    for (const rd of M.roads) { const hw = rd.major ? 6.5 : 5, line = smooth(rd.p.map(p => CW.center(...p)), 4);
      const cross = [[-hw * 1.4, col(70, 52, 30, 0)], [-hw * 1.08, col(86, 64, 38, .5)], [-hw * .72, col(136, 108, 70, 1)], [0, col(158, 130, 88, 1)], [hw * .72, col(136, 108, 70, 1)], [hw * 1.08, col(86, 64, 38, .5)], [hw * 1.4, col(70, 52, 30, 0)]];
      const me = ribbon(line, cross, W3, 1.3, roadMat); scene.add(me); parts.push(me); stats.roads++; }
    // brooks (hex-edge chains already meandered by the data pass)
    const brookMat = rmat([.9, .9, .9], -5);
    for (const pts of ((CW.WATER && CW.WATER.streams) || [])) { if (pts.length < 2) continue; const line = smooth(pts, 4);
      const cross = [[-5.2, col(60, 44, 22, 0)], [-3.9, col(62, 46, 24, .55)], [-2.4, col(48, 88, 102, .95)], [0, col(78, 126, 136, 1)], [2.4, col(48, 88, 102, .95)], [3.9, col(62, 46, 24, .55)], [5.2, col(60, 44, 22, 0)]];
      const me = ribbon(line, cross, W3, 1.5, brookMat); me.renderOrder = 2; scene.add(me); parts.push(me); stats.brooks++; }
    // fences and walls: one instanced mesh per kind
    const list = pieces(M, W3);
    for (const kind of ['fence', 'stoneA', 'stoneB']) { const items = list.filter(t => t.kind === kind), n = items.length; if (!n) continue; const m = EM[kind];
      const base = new Float32Array(n * 3), rot = new Float32Array(n * 3), sc = new Float32Array(n * 3);
      items.forEach((t, i) => { const b = W3(t.x, t.y); base.set([b.x, b.y + t.lift, b.z], i * 3); rot.set([t.yaw, t.pitch, t.rnd], i * 3); sc.set([t.sx, t.sy, t.sz], i * 3); });
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(dec(m.p, Float32Array), 3)); g.setAttribute('normal', new THREE.BufferAttribute(dec(m.nm, Float32Array), 3));
      g.setAttribute('color', new THREE.BufferAttribute(dec(m.c, Uint8Array), 3, true)); g.setIndex(new THREE.BufferAttribute(dec(m.i, Uint16Array), 1));
      g.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3)); g.setAttribute('aRot', new THREE.InstancedBufferAttribute(rot, 3)); g.setAttribute('aSc', new THREE.InstancedBufferAttribute(sc, 3)); g.instanceCount = n;
      const me = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: IVS, fragmentShader: IFS, uniforms: { ...fog }, side: THREE.DoubleSide })); me.frustumCulled = false; me.renderOrder = 0;
      scene.add(me); parts.push(me); stats.pieces += n; }
    state = { scene, parts }; return stats;
  }
  function dispose() { if (!state) return; state.parts.forEach(m => { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); state = null; }
  return { build, dispose, edgesOf, smooth };
})();
