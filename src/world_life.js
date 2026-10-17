'use strict';
// World life (17 Oct 2026, Opus look pass): cattle and sheep grazing in the pastures beside farms and towns (plus a few lone herds),
// and turkey vultures wheeling high over the valley. Pure decoration, all geometry written here (no outside assets).
// Placement is a pure function of the map (seeded per hex): the same map always shows the same herds.
// Animals step out of view while soldiers stand in their hex (same occupancy texture as the trees). Heads dip to graze, tails swish and
// the birds circle ONLY while Living landscape is on; Living off = animals stand still, birds hidden.
CW.WorldLife = (function () {
  const PX = 2.4;   // map px per metre (same as buildings and trees)
  // ---------- geometry: boxes merged into one mesh per animal kind; aA = (colour slot 0 coat, 1 head, 2 legs, 3 muzzle/hooves; part 0 body, 1 head+neck, 2 tail)
  function box(G, cx, cy, cz, sx, sy, sz, slot, part, top = 1) {
    const h = [sx / 2, sy / 2, sz / 2];
    for (const [ax, sg] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
      const u = (ax + 1) % 3, v = (ax + 2) % 3, o = G.p.length / 3;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const c = [0, 0, 0]; c[ax] = sg; c[u] = a; c[v] = b;
        let x = c[0] * h[0], y = c[1] * h[1], z = c[2] * h[2]; if (y > 0) { x *= top; z *= top; }
        const n = [0, 0, 0]; n[ax] = sg; G.p.push(cx + x, cy + y, cz + z); G.n.push(...n); G.a.push(slot, part); }
      G.i.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  }
  const geom = G => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(G.n, 3)); g.setAttribute('aA', new THREE.Float32BufferAttribute(G.a, 2)); g.setIndex(G.i); return g; };
  function cow() { const G = { p: [], n: [], a: [], i: [] };   // metres, facing +x
    box(G, 0, 1.05, 0, 2.1, .82, .74, 0, 0, .92);                                   // barrel
    box(G, .7, 1.12, 0, .55, .78, .78, 0, 0, .9);                                   // shoulders
    box(G, 1.17, 1.22, 0, .62, .34, .30, 0, 1);                                     // neck
    box(G, 1.55, 1.10, 0, .46, .38, .30, 1, 1); box(G, 1.8, 1.02, 0, .14, .24, .24, 3, 1);   // head, muzzle
    for (const [x, z] of [[.78, .24], [.78, -.24], [-.78, .24], [-.78, -.24]]) { box(G, x, .34, z, .17, .68, .17, 2, 0); box(G, x, .04, z, .19, .08, .19, 3, 0); }
    box(G, -1.08, .86, 0, .07, .7, .07, 1, 2);                                       // tail
    return geom(G); }
  function sheep() { const G = { p: [], n: [], a: [], i: [] };
    box(G, 0, .64, 0, 1.05, .58, .66, 0, 0, .82);                                   // woolly body
    box(G, .55, .74, 0, .26, .26, .26, 0, 1); box(G, .72, .68, 0, .26, .24, .19, 1, 1);   // wool collar, face
    for (const [x, z] of [[.34, .18], [.34, -.18], [-.34, .18], [-.34, -.18]]) box(G, x, .2, z, .09, .4, .09, 2, 0);
    return geom(G); }
  function bird() { const G = { p: [], n: [], a: [], i: [] };   // a vulture: body + two long wings (x = forward); slot 1 = wing, part 1 = wing tip
    const P = (x, y, z, part) => { G.p.push(x, y, z); G.n.push(0, 1, 0); G.a.push(1, part); };
    let o = 0; const tri = (a, b, c) => { G.i.push(o + a, o + b, o + c); };
    P(.55, 0, 0, 0); P(-.65, 0, .12, 0); P(-.65, 0, -.12, 0); tri(0, 1, 2); o = 3;               // body
    for (const s of [1, -1]) { P(.18, 0, 0, 0); P(-.22, 0, 0, 0); P(-.05, 0, .95 * s, 1); P(-.35, 0, .82 * s, 1); tri(0, 1, 2); tri(1, 3, 2); o += 4; }
    return geom(G); }

  // ---------- shaders ----------
  const AVS = `attribute vec2 aA; attribute vec3 aBase, aCoat; attribute vec4 aPar; uniform sampler2D uOcc; uniform vec2 uOccN; uniform float uT, uLive, uKind;
    varying vec3 vCol, vN; varying float vDist;
    void main() { float hx = aPar.z; if (texture2D(uOcc, (vec2(mod(hx, uOccN.x), floor(hx / uOccN.x)) + 0.5) / uOccN).r > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec3 p = position, n = normal;
      if (aA.y > 0.5 && aA.y < 1.5) {   // head and neck: graze (down) or look about (up), each animal its own slow rhythm
        float g = uLive > 0.5 ? smoothstep(-0.2, 0.7, sin(uT * (0.22 + 0.18 * aPar.y) + aPar.y * 40.0)) : step(0.45, aPar.y);
        vec3 piv = uKind > 0.5 ? vec3(0.45, 0.7, 0.0) : vec3(0.92, 1.22, 0.0); float an = -(uKind > 0.5 ? 0.9 : 1.3) * g + 0.12 * (1.0 - g);
        vec3 q = p - piv; float c = cos(an), s = sin(an); p = piv + vec3(q.x * c - q.y * s, q.x * s + q.y * c, q.z); n = vec3(n.x * c - n.y * s, n.x * s + n.y * c, n.z); }
      if (aA.y > 1.5 && uLive > 0.5) p.z += 0.22 * sin(uT * 2.6 + aPar.y * 20.0) * (1.25 - p.y);   // tail swish
      float c = cos(aPar.x), s = sin(aPar.x), k = ${PX.toFixed(2)} * aPar.w;
      vec3 r = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c) * k; vN = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
      vCol = aA.x < 0.5 ? aCoat : aA.x < 1.5 ? aCoat * (uKind > 0.5 ? 0.18 : 0.78) : aA.x < 2.5 ? aCoat * (uKind > 0.5 ? 0.16 : 0.62) : vec3(0.05, 0.04, 0.035);
      vec4 mv = viewMatrix * vec4(aBase + r, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const BVS = `attribute vec2 aA; attribute vec4 aF, aB; uniform float uT, uLive; varying vec3 vCol, vN; varying float vDist;
    void main() { if (uLive < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      // aF = flock centre x, z, circle radius, height; aB = phase, speed, own offset, size. Long lazy circles, mostly gliding, a few slow flaps.
      float a = aB.x + uT * aB.y, rad = aF.z * (1.0 + 0.18 * sin(uT * 0.05 + aB.z * 9.0)) + aB.z * 26.0;
      vec2 cxz = aF.xy + vec2(cos(a), sin(a)) * rad, fw = normalize(vec2(-sin(a), cos(a)) * sign(aB.y)), sd = vec2(-fw.y, fw.x);
      float flap = smoothstep(0.75, 0.95, sin(uT * 0.4 + aB.z * 13.0)) * sin(uT * 7.0 + aB.z * 20.0), bank = 0.35 * sign(aB.y);
      vec3 p = position * aB.w; p.y += (aA.y > 0.5 ? 0.55 * flap + 0.12 : 0.0) * aB.w + p.z * bank;
      vec3 w = vec3(cxz.x + fw.x * p.x + sd.x * p.z, aF.w + p.y + 6.0 * sin(uT * 0.3 + aB.z * 5.0), cxz.y + fw.y * p.x + sd.y * p.z);
      vCol = vec3(0.07, 0.055, 0.05); vN = vec3(0.0, 1.0, 0.0); vec4 mv = viewMatrix * vec4(w, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const FS = `uniform vec3 uFog; uniform vec2 uFogR; varying vec3 vCol, vN; varying float vDist; const vec3 SUN = ${CW.SUN.glsl};
    void main() { vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; float ndl = clamp((dot(n, normalize(SUN)) + 0.25) / 1.25, 0.0, 1.0);
      vec3 sky = mix(vec3(0.20, 0.17, 0.12), vec3(0.38, 0.45, 0.55), n.y * 0.5 + 0.5), c = vCol * (sky * 0.8 + vec3(1.0, 0.93, 0.78) * 1.15 * ndl);
      gl_FragColor = vec4(mix(c, uFog, smoothstep(uFogR.x, uFogR.y, vDist)), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  // soft shadow under each animal, lying on the hill (height texture), cast a little east by the low western sun
  const SVS = `attribute vec3 aBase; attribute vec4 aPar; uniform sampler2D uOcc, uHgt; uniform vec2 uOccN, uHgtSz, uMapW; varying vec2 vQ;
    void main() { float hx = aPar.z; if (texture2D(uOcc, (vec2(mod(hx, uOccN.x), floor(hx / uOccN.x)) + 0.5) / uOccN).r > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      float c = cos(aPar.x), s = sin(aPar.x), L = (aPar.y > 1.5 ? 1.5 : 2.6) * ${PX.toFixed(2)} * aPar.w; vec2 q = position.xy * 2.0;
      vec2 d = vec2(q.x * L * 0.62, q.y * L * 0.3), wp = aBase.xz + vec2(d.x * c + d.y * s, -d.x * s + d.y * c) - normalize(${CW.SUN.glsl}.xz) * L * 0.55;   /* the one sun */
      vQ = q; float gy = texture2D(uHgt, (wp + uMapW * 0.5) / uHgtSz).r; gl_Position = projectionMatrix * viewMatrix * vec4(wp.x, gy + 0.6, wp.y, 1.0); }`;
  const SFS = `varying vec2 vQ; void main() { gl_FragColor = vec4(0.06, 0.05, 0.09, (1.0 - smoothstep(0.35, 1.0, length(vQ))) * 0.42); }`;

  // ---------- placement (pure function of the map) ----------
  const COATS = [[[.33, .2, .11], [.07, .06, .055], [.47, .25, .12], [.6, .48, .32]], [[.78, .74, .62], [.72, .68, .56], [.82, .79, .7], [.4, .33, .26]]];
  function place(M) {
    const R = CW.R, out = [], used = new Set(), roads = [];
    (M.roads || []).forEach(rd => rd.p.forEach(p => roads.push(CW.center(...p))));
    const offRoad = (x, y) => roads.every(([a, b]) => (a - x) ** 2 + (b - y) ** 2 > (R * .55) ** 2);
    const herd = (a, b, rand) => { const k = a + ',' + b; if (used.has(k)) return; used.add(k);
      const kind = rand() < .4 ? 1 : 0, n = kind ? 7 + Math.floor(rand() * 7) : 4 + Math.floor(rand() * 5), [hx, hy] = CW.center(a, b);
      const coat = Math.floor(rand() * 4), cx = hx + (rand() - .5) * R * .5, cy = hy + (rand() - .5) * R * .4, face = rand() * 6.283;
      for (let i = 0; i < n; i++) { const an = rand() * 6.283, d = Math.sqrt(rand()) * R * (kind ? .34 : .46), x = cx + Math.cos(an) * d, y = cy + Math.sin(an) * d * .9;
        if (!offRoad(x, y)) continue;
        out.push({ kind, x, y, yaw: face + (rand() - .5) * 2.4, rnd: rand(), hex: b * M.cols + a, coat: COATS[kind][rand() < .75 ? coat : Math.floor(rand() * 4)], s: .9 + rand() * .22 }); } };
    for (const [c, r] of M.all) { const t = M.ter(c, r); if (t !== 'h' && t !== 't') continue; const rand = CW.rng(c * 3301 + r * 7717 + 5);
      const nb = M.nbrs(c, r).filter(([a, b]) => M.in(a, b) && M.ter(a, b) === 'g' && !used.has(a + ',' + b));
      for (let k = 0, n = t === 'h' ? 2 : (rand() < .5 ? 1 : 0); k < n && nb.length; k++) { const [a, b] = nb.splice(Math.floor(rand() * nb.length), 1)[0]; herd(a, b, rand); } }
    for (const [c, r] of M.all) { if (M.ter(c, r) !== 'g') continue; const rand = CW.rng(c * 911 + r * 6007 + 41);   // a few lone herds out in the meadows
      if (rand() < .028 && M.nbrs(c, r).every(([a, b]) => !M.in(a, b) || !'fwbd'.includes(M.ter(a, b)))) herd(c, r, rand); }
    return out;
  }

  let state = null;
  function dispose() { if (!state) return; state.parts.forEach(m => { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); state = null; }
  // env: { scene, M, W3, occ, U }
  function build(env) {
    const { scene, M, W3, occ, U } = env, [MW, MH] = CW.mapSize(M); dispose(); const parts = [];
    const fog = { uFog: { value: scene.fog.color }, uFogR: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } };
    const base = Object.assign({ uOcc: { value: occ }, uOccN: { value: new THREE.Vector2(M.cols, M.rows) }, uT: U.uT, uLive: U.uLive }, fog);
    const list = place(M);
    for (const kind of [0, 1]) { const L = list.filter(a => a.kind === kind); if (!L.length) continue;
      const g = kind ? sheep() : cow(), b = new Float32Array(L.length * 3), pr = new Float32Array(L.length * 4), co = new Float32Array(L.length * 3);
      L.forEach((a, i) => { const w = W3(a.x, a.y); b.set([w.x, w.y - .2, w.z], i * 3); pr.set([a.yaw, a.rnd, a.hex, a.s], i * 4); co.set(a.coat.map(v => Math.pow(v * (.88 + a.rnd * .24), 2.2)), i * 3); /* coats are screen (sRGB) values; the shader works in linear light */ });
      g.setAttribute('aBase', new THREE.InstancedBufferAttribute(b, 3)); g.setAttribute('aPar', new THREE.InstancedBufferAttribute(pr, 4)); g.setAttribute('aCoat', new THREE.InstancedBufferAttribute(co, 3)); g.instanceCount = L.length;
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: AVS, fragmentShader: FS, side: THREE.DoubleSide, uniforms: Object.assign({}, base, { uKind: { value: kind } }) }));
      m.frustumCulled = false; scene.add(m); parts.push(m); }
    if (list.length && U.uHgt && U.uHgt.value) {   // shadows: one draw for all animals
      const sg = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1), b = new Float32Array(list.length * 3), pr = new Float32Array(list.length * 4);
      list.forEach((a, i) => { const w = W3(a.x, a.y); b.set([w.x, w.y, w.z], i * 3); pr.set([a.yaw, a.kind ? 2 : 0, a.hex, a.s], i * 4); });
      sg.index = q.index; sg.setAttribute('position', q.attributes.position); sg.setAttribute('aBase', new THREE.InstancedBufferAttribute(b, 3)); sg.setAttribute('aPar', new THREE.InstancedBufferAttribute(pr, 4)); sg.instanceCount = list.length;
      const sh = new THREE.Mesh(sg, new THREE.ShaderMaterial({ vertexShader: SVS, fragmentShader: SFS, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        uniforms: { uOcc: base.uOcc, uOccN: base.uOccN, uHgt: U.uHgt, uHgtSz: U.uHgtSz, uMapW: { value: new THREE.Vector2(MW, MH) } } }));
      sh.frustumCulled = false; sh.renderOrder = 1; scene.add(sh); parts.push(sh); }
    // vultures: 3 loose flocks circling over seeded spots of the valley, high above the ground
    const rand = CW.rng(1863), F = [], B = [];
    for (let f = 0; f < 3; f++) { const x = MW * (.2 + rand() * .6), z = MH * (.2 + rand() * .6), w = W3(x, z), rad = 110 + rand() * 120, h = w.y + 150 + rand() * 90, dir = rand() < .5 ? 1 : -1;
      for (let i = 0, n = 3 + Math.floor(rand() * 4); i < n; i++) { F.push(x - MW / 2, z - MH / 2, rad, h + (rand() - .5) * 40); B.push(rand() * 6.283, dir * (.05 + rand() * .03), rand(), PX * 1.8 * (1.4 + rand() * .3)); } }
    const bg = bird(); bg.setAttribute('aF', new THREE.InstancedBufferAttribute(new Float32Array(F), 4)); bg.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(B), 4)); bg.instanceCount = F.length / 4;
    const bm = new THREE.Mesh(bg, new THREE.ShaderMaterial({ vertexShader: BVS, fragmentShader: FS, side: THREE.DoubleSide, uniforms: Object.assign({ uT: U.uT, uLive: U.uLive }, fog) }));
    bm.frustumCulled = false; scene.add(bm); parts.push(bm);
    state = { scene, parts }; return list.length;
  }
  return { place, build, dispose };
})();
