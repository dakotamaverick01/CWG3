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
  // living world phase 3: farm animals (same box style; part 1 = head+neck, 2 = tail; slot 4 = a hen's red comb)
  function horse() { const G = { p: [], n: [], a: [], i: [] };
    box(G, 0, 1.28, 0, 1.85, .7, .6, 0, 0, .94); box(G, .72, 1.34, 0, .45, .78, .6, 0, 0, .92);                         // barrel, chest
    box(G, 1.02, 1.66, 0, .42, .62, .3, 0, 1); box(G, 1.32, 1.9, 0, .62, .27, .25, 0, 1); box(G, 1.66, 1.84, 0, .14, .22, .2, 3, 1);   // neck, head, muzzle
    box(G, .92, 2.0, 0, .42, .12, .1, 1, 1);                                                                             // mane
    for (const [x, z] of [[.68, .19], [.68, -.19], [-.7, .19], [-.7, -.19]]) { box(G, x, .48, z, .13, .96, .13, 2, 0); box(G, x, .04, z, .15, .08, .15, 3, 0); }
    box(G, -1.0, 1.02, 0, .12, .8, .12, 1, 2); return geom(G); }
  function pig() { const G = { p: [], n: [], a: [], i: [] };
    box(G, 0, .5, 0, 1.2, .52, .56, 0, 0, .88); box(G, .7, .5, 0, .3, .38, .36, 0, 1); box(G, .9, .45, 0, .12, .17, .17, 3, 1);
    box(G, .7, .72, .12, .1, .1, .04, 1, 1); box(G, .7, .72, -.12, .1, .1, .04, 1, 1);                                   // ears
    for (const [x, z] of [[.36, .17], [.36, -.17], [-.38, .17], [-.38, -.17]]) box(G, x, .12, z, .12, .24, .12, 2, 0);
    box(G, -.64, .62, 0, .05, .16, .05, 0, 2); return geom(G); }
  function hen() { const G = { p: [], n: [], a: [], i: [] };
    box(G, 0, .24, 0, .34, .2, .2, 0, 0, .8); box(G, -.18, .32, 0, .12, .18, .14, 0, 2);                                // body, tail
    box(G, .17, .38, 0, .11, .15, .1, 0, 1); box(G, .19, .48, 0, .09, .05, .03, 4, 1); box(G, .25, .37, 0, .06, .03, .03, 2, 1);   // head, comb, beak
    for (const z of [.05, -.05]) box(G, .02, .07, z, .03, .14, .03, 2, 0); return geom(G); }
  function bird() { const G = { p: [], n: [], a: [], i: [] };   // a vulture: body + two long wings (x = forward); slot 1 = wing, part 1 = wing tip
    const P = (x, y, z, part) => { G.p.push(x, y, z); G.n.push(0, 1, 0); G.a.push(1, part); };
    let o = 0; const tri = (a, b, c) => { G.i.push(o + a, o + b, o + c); };
    P(.55, 0, 0, 0); P(-.65, 0, .12, 0); P(-.65, 0, -.12, 0); tri(0, 1, 2); o = 3;               // body
    for (const s of [1, -1]) { P(.18, 0, 0, 0); P(-.22, 0, 0, 0); P(-.05, 0, .95 * s, 1); P(-.35, 0, .82 * s, 1); tri(0, 1, 2); tri(1, 3, 2); o += 4; }
    return geom(G); }

  // ---------- shaders ----------
  const AVS = `attribute vec2 aA, aWan; attribute vec3 aBase, aCoat; attribute vec4 aPar; uniform sampler2D uOcc; uniform vec2 uOccN; uniform float uT, uLive, uKind, uDet, uGr, uHeadK, uLegK, uPeck; uniform vec3 uPiv;
    varying vec3 vCol, vN; varying float vDist;
    void main() { float hx = aPar.z; if (texture2D(uOcc, (vec2(mod(hx, uOccN.x), floor(hx / uOccN.x)) + 0.5) / uOccN).r > 0.5 || (uPeck > 0.5 && uDet < 0.5)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec3 p = position, n = normal; float liv = uLive * step(0.5, uDet);
      if (aA.y > 0.5 && aA.y < 1.5) {   // head and neck: graze (down) or look about (up), each animal its own slow rhythm; hens peck fast
        float g = uPeck > 0.5 ? (liv > 0.5 ? smoothstep(0.55, 0.95, sin(uT * (5.0 + 3.0 * aPar.y) + aPar.y * 40.0)) * step(0.0, sin(uT * 0.7 + aPar.y * 9.0)) : 0.0)
                             : (uLive > 0.5 ? smoothstep(-0.2, 0.7, sin(uT * (0.22 + 0.18 * aPar.y) + aPar.y * 40.0)) : step(0.45, aPar.y));
        float an = uGr * g + 0.12 * (1.0 - g);
        vec3 q = p - uPiv; float c = cos(an), s = sin(an); p = uPiv + vec3(q.x * c - q.y * s, q.x * s + q.y * c, q.z); n = vec3(n.x * c - n.y * s, n.x * s + n.y * c, n.z); }
      if (aA.y > 1.5 && uLive > 0.5) p.z += 0.22 * sin(uT * 2.6 + aPar.y * 20.0) * (1.25 - p.y);   // tail swish
      float yaw = aPar.x; vec3 off = vec3(0.0);
      if (aWan.x > 0.0) {   // hens: wander about a little loop, stopping to peck (Living on and Detail Medium/High)
        float ph = aPar.y * 40.0 + liv * (uT * aWan.y + 0.8 * sin(uT * 0.9 + aPar.y * 17.0));
        off = vec3(cos(ph), 0.0, sin(ph)) * aWan.x * ${PX.toFixed(2)}; float sg = sign(aWan.y); yaw = atan(-cos(ph) * sg, -sin(ph) * sg); }
      float c = cos(yaw), s = sin(yaw), k = ${PX.toFixed(2)} * aPar.w;
      vec3 r = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c) * k; vN = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
      vCol = aA.x < 0.5 ? aCoat : aA.x < 1.5 ? aCoat * uHeadK : aA.x < 2.5 ? aCoat * uLegK : aA.x < 3.5 ? vec3(0.05, 0.04, 0.035) : vec3(0.42, 0.03, 0.02);
      vec4 mv = viewMatrix * vec4(aBase + off + r, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  // living world phase 3: laundry on the line, billowing with the same gusts as the grass (still when Living is off or Detail is Low)
  const LVS = `attribute vec3 aBase; attribute vec4 aC; attribute vec3 aTint; uniform float uT, uLive, uDet; varying vec3 vCol, vN; varying float vDist;
    ${CW.WorldTrees ? CW.WorldTrees.WIND : 'float cwGust(vec2 p, float t) { return 0.5; }'}
    void main() { float u = position.x, v = position.y, liv = uLive * step(0.5, uDet);   // u 0..1 across, v 0 at the line .. 1 at the hem
      float gust = liv > 0.5 ? cwGust(aBase.xz, uT) : 0.25, wave = liv > 0.5 ? sin(uT * 3.1 + u * 5.0 + aC.w * 7.0) : 0.0;
      float bil = (0.18 + 0.8 * gust) * pow(v, 1.4) * (1.0 + 0.35 * wave), lx = (u - 0.5) * aC.y + aC.x, ly = 2.0 - v * aC.z * (1.0 - 0.18 * bil);
      vec3 l = vec3(lx, ly, bil * 0.55 * aC.z);
      float c = cos(aC.w), s = sin(aC.w); vec3 w = aBase + vec3(l.x * c + l.z * s, l.y, -l.x * s + l.z * c) * ${PX.toFixed(2)};
      vN = normalize(vec3(-s, 0.35 * bil, c)); vCol = aTint * (0.85 + 0.15 * (1.0 - v));
      vec4 mv = viewMatrix * vec4(w, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
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
    // living world phase 3: farm animals placed from where each farm's house and barn actually stand (CW.WorldStructures.place, pure)
    let items = []; try { items = CW.WorldStructures ? CW.WorldStructures.place(M) : []; } catch (e) { items = []; }
    const MD = CW.MODELS || {}, blds = items.filter(o => MD[o.kind] && MD[o.kind].norm === 'meters').map(o => ({ x: o.x, y: o.y, r: Math.max(MD[o.kind].x || MD[o.kind].w || 4, MD[o.kind].d || 4) * 2.4 * .55 }));
    const segs = []; (M.roads || []).forEach(rd => { for (let i = 0; i < rd.p.length - 1; i++) segs.push([CW.center(...rd.p[i]), CW.center(...rd.p[i + 1])]); });
    const roadD = (x, y) => segs.reduce((m, [p, q]) => { const dx = q[0] - p[0], dy = q[1] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.min(m, Math.hypot(x - p[0] - dx * t, y - p[1] - dy * t)); }, 1e9);
    const free = (x, y, rad) => blds.every(b => Math.hypot(b.x - x, b.y - y) > b.r + rad) && roadD(x, y) > 10 + rad && out.every(a => a.kind === 4 || Math.hypot(a.x - x, a.y - y) > rad + 2);
    const hexOf = (x, y) => { const h = CW.pixelToHex(M, x, y); return h ? h[1] * M.cols + h[0] : -1; };
    const FARM = { 2: [[.42, .24, .12], [.55, .30, .14], [.10, .08, .07], [.62, .60, .56]], 3: [[.82, .62, .55], [.15, .12, .12], [.70, .50, .36]], 4: [[.90, .88, .82], [.55, .28, .12], [.50, .48, .44], [.12, .10, .10]] };
    const put = (kind, cx, cy, spread, rad, rand, yaw0, wan) => { for (let t = 0; t < 8; t++) { const x = cx + (rand() - .5) * spread, y = cy + (rand() - .5) * spread; if (!free(x, y, rad)) continue;
      const hx = hexOf(x, y); if (hx < 0) return; const C = FARM[kind]; out.push({ kind, x, y, yaw: yaw0 + (rand() - .5) * (kind === 4 ? 6.3 : 1.6), rnd: rand(), hex: hx, coat: C[Math.floor(rand() * C.length)], s: (kind === 4 ? 1.8 : .9) + rand() * .2, wan: wan ? wan() : [0, 0] }); return; } };
    const hen = rand => () => [.6 + rand() * 1.1, (rand() < .5 ? -1 : 1) * (.12 + rand() * .22)];
    const HOUSE = /^(farmhouse|house_b|house_l|cottage|hero_house|brick_house|brick_b|log_cabin)$/, BARN = /^(barn|barn_b|hero_barn)$/;
    for (const [c, r] of M.all) { const t = M.ter(c, r); if (t !== 'h' && t !== 't') continue; const rand = CW.rng(c * 5167 + r * 9013 + 77), here = o => { const h = CW.pixelToHex(M, o.x, o.y); return h && h[0] === c && h[1] === r; };
      const hs = items.find(o => HOUSE.test(o.kind) && here(o)), bn = items.find(o => BARN.test(o.kind) && here(o));
      if (t === 'h' && hs && bn) { let ax = bn.x - hs.x, ay = bn.y - hs.y; const L = Math.hypot(ax, ay) || 1; ax /= L; ay /= L; const px = -ay, py = ax, side = rand() < .5 ? 1 : -1, yaw = Math.atan2(-py, px);
        const rad = o => (blds.find(q => q.x === o.x && q.y === o.y) || { r: 20 }).r, rb = rad(bn), rh = rad(hs);
        for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) put(2, bn.x + ax * (rb + 18) + px * side * 10, bn.y + ay * (rb + 18) + py * side * 10, 30, 5, rand, yaw);   // horses beyond the barn
        for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) put(3, bn.x - px * side * (rb + 9), bn.y - py * side * (rb + 9), 14, 3, rand, rand() * 6.3);   // pigs in the lee of the barn
        for (let i = 0, n = 6 + Math.floor(rand() * 4); i < n; i++) put(4, hs.x - px * side * (rh + 12) - ax * 6, hs.y - py * side * (rh + 12) - ay * 6, 30, 1, rand, 0, hen(rand)); }   // hens in the side yard
      else if (t === 't' && hs && rand() < .5) for (let i = 0, n = 3 + Math.floor(rand() * 3); i < n; i++) put(4, hs.x + (rand() - .5) * 20, hs.y + 16 + rand() * 8, 14, 1, rand, 0, hen(rand)); }
    out.laundry = items.filter(o => o.kind === 'washline');
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
    const KIND = { 0: [cow, [.92, 1.22, 0], -1.3, .78, .62, 0], 1: [sheep, [.45, .7, 0], -.9, .18, .16, 0], 2: [horse, [.85, 1.45, 0], -1.35, .35, .45, 0],
      3: [pig, [.55, .55, 0], -.45, .9, .8, 0], 4: [hen, [.12, .3, 0], -1.2, 1, .75, 1] };   // geometry, head pivot, graze angle, head/mane tint, leg tint, pecks
    for (const kind of [0, 1, 2, 3, 4]) { const L = list.filter(a => a.kind === kind); if (!L.length) continue; const [gf, piv, gr, hk, lk, peck] = KIND[kind];
      const g = gf(), b = new Float32Array(L.length * 3), pr = new Float32Array(L.length * 4), co = new Float32Array(L.length * 3), wn = new Float32Array(L.length * 2);
      L.forEach((a, i) => { const w = W3(a.x, a.y); b.set([w.x, w.y - .2, w.z], i * 3); pr.set([a.yaw, a.rnd, a.hex, a.s], i * 4); co.set(a.coat.map(v => Math.pow(v * (.88 + a.rnd * .24), 2.2)), i * 3); wn.set(a.wan || [0, 0], i * 2); /* coats are screen (sRGB) values; the shader works in linear light */ });
      g.setAttribute('aBase', new THREE.InstancedBufferAttribute(b, 3)); g.setAttribute('aPar', new THREE.InstancedBufferAttribute(pr, 4)); g.setAttribute('aCoat', new THREE.InstancedBufferAttribute(co, 3)); g.setAttribute('aWan', new THREE.InstancedBufferAttribute(wn, 2)); g.instanceCount = L.length;
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: AVS, fragmentShader: FS, side: THREE.DoubleSide, uniforms: Object.assign({}, base, { uKind: { value: kind }, uDet: U.uDet || { value: 1 },
        uPiv: { value: new THREE.Vector3(...piv) }, uGr: { value: gr }, uHeadK: { value: hk }, uLegK: { value: lk }, uPeck: { value: peck } }) }));
      m.frustumCulled = false; scene.add(m); parts.push(m); }
    // laundry: one small cloth grid per sheet or shirt, instanced
    if (list.laundry && list.laundry.length) { const SH = [[-2.3, 1.4, 1.3, [.88, .86, .8]], [-.6, .7, .8, [.42, .5, .66]], [.6, 1.5, 1.4, [.9, .88, .82]], [2.3, .7, .7, [.62, .2, .14]]], base3 = [], cc = [], tt = [];
      list.laundry.forEach(o => { const w = W3(o.x, o.y); SH.forEach(([x, wd, dr, col], k) => { base3.push(w.x, w.y + (o.lift || 0), w.z); cc.push(x, wd, dr, o.yaw + (x > 0 ? .14 : -.14)); tt.push(...col.map(v => Math.pow(v, 2.2))); }); });
      const pg = new THREE.PlaneGeometry(1, 1, 3, 4), pp = pg.attributes.position; for (let i = 0; i < pp.count; i++) pp.setXY(i, pp.getX(i) + .5, .5 - pp.getY(i));
      const lg = new THREE.InstancedBufferGeometry(); lg.index = pg.index; lg.setAttribute('position', pp);
      lg.setAttribute('aBase', new THREE.InstancedBufferAttribute(new Float32Array(base3), 3)); lg.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(cc), 4)); lg.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tt), 3)); lg.instanceCount = base3.length / 3;
      const lm = new THREE.Mesh(lg, new THREE.ShaderMaterial({ vertexShader: LVS, fragmentShader: FS, side: THREE.DoubleSide, uniforms: Object.assign({ uT: U.uT, uLive: U.uLive, uDet: U.uDet || { value: 1 } }, fog) }));
      lm.frustumCulled = false; scene.add(lm); parts.push(lm); }
    if (list.length && U.uHgt && U.uHgt.value) {   // shadows: one draw for all animals
      const SL = list.filter(a => a.kind !== 4), sg = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1), b = new Float32Array(SL.length * 3), pr = new Float32Array(SL.length * 4);
      SL.forEach((a, i) => { const w = W3(a.x, a.y); b.set([w.x, w.y, w.z], i * 3); pr.set([a.yaw, a.kind === 1 || a.kind === 3 ? 2 : 0, a.hex, a.s], i * 4); });
      sg.index = q.index; sg.setAttribute('position', q.attributes.position); sg.setAttribute('aBase', new THREE.InstancedBufferAttribute(b, 3)); sg.setAttribute('aPar', new THREE.InstancedBufferAttribute(pr, 4)); sg.instanceCount = SL.length;
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
