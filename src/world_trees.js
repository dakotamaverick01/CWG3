'use strict';
// Living fields, piece 1: our own painterly trees (tools/gen_trees.py -> assets/art/trees.js = CW.TREES: 10 species x 2-4 variants + painted leaf atlas).
// Placement is a pure function of the map file: forest (f), orchard (o), lone trees on grass (g), hedgerow trees on fence edges, and the yard
// trees that world_structures.js picks for towns and farms. Each hex has its own seeded random numbers, so editing one hex changes only that hex.
// Rendering: per species variant one instanced bark draw (opaque) + one instanced leaf-card draw (alpha-to-coverage edges), plus ONE instanced
// soft ground shadow for all trees (cast east, away from the low western sun). Where a unit stands the hex thins out (same rule as before:
// half the trees vanish, the rest are ~60% height). Wind runs only while Living landscape is on (uLive); off = frozen, same layout.
CW.WorldTrees = (function () {
  const PX = 2.4;   // map px per metre (same as the buildings)
  const CANOPY = [['oak', .35], ['maple', .2], ['poplar', .15], ['sycamore', .1], ['pine', .1], ['cedar', .1]];
  const FIELD = [['oak', .4], ['maple', .2], ['sycamore', .12], ['cedar', .14], ['dead', .06], ['poplar', .08]];
  const YARD = [['maple', .35], ['oak', .3], ['sycamore', .15], ['apple', .2]];
  const pick = (table, x, boost) => { let s = 0; const tot = table.reduce((a, [k, w]) => a + w * (boost && boost[k] || 1), 0); x *= tot;
    for (const [k, w] of table) { s += w * (boost && boost[k] || 1); if (x < s) return k; } return table[0][0]; };

  // pure placement: [{sp, v, x, y, s (px per m, horizontal), sy (vertical), yaw, rnd, hex, sh (shadow strength)}] in map pixels
  function place(M) {
    const R = CW.R, out = [], T = CW.TREES.species, isF = (c, r) => M.in(c, r) && M.ter(c, r) === 'f';
    const add = (sp, x, y, s, rand, hex, sh) => { const n = T[sp].length, v = Math.floor(rand() * n) % n, k = .9 + rand() * .2;
      out.push({ sp, v, x, y, s: s * k, sy: s * (.92 + rand() * .16), yaw: rand() * 6.283, rnd: rand(), hex, sh }); };
    const scatter = (cx, cy, rad, n, minD, rand, pts) => { const mine = []; let tries = 0;
      while (mine.length < n && tries++ < n * 12) { const a = rand() * 6.283, d = Math.sqrt(rand()) * rad, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .92;
        if (pts.every(p => (p[0] - x) ** 2 + (p[1] - y) ** 2 > minD * minD)) { pts.push([x, y]); mine.push([x, y]); } } return mine; };
    for (const [c, r] of M.all) {
      const t = M.ter(c, r), rand = CW.rng(c * 7919 + r * 104729 + 23), [cx, cy] = CW.center(c, r), hex = r * M.cols + c;
      if (t === 'f') {
        const wet = M.nbrs(c, r).some(([a, b]) => 'wbds'.includes(M.ter(a, b))), pts = [];
        for (const [x, y] of scatter(cx, cy, R * .9, 8 + Math.floor(rand() * 5), 10, rand, pts))
          add(rand() < .04 ? 'dead' : pick(CANOPY, rand(), wet ? { sycamore: 3 } : null), x, y, PX * (.85 + rand() * .3), rand, hex, .16);
        for (const [x, y] of scatter(cx, cy, R * .85, 5 + Math.floor(rand() * 3), 5, rand, pts.map(p => p)))
          add(rand() < .4 ? 'sapling' : 'shrub', x, y, PX * (.8 + rand() * .45), rand, hex, .12);
        for (const [a, b] of M.nbrs(c, r)) {   // forest edge facing open ground: a band of shrubs and saplings
          if (isF(a, b) || 'wbd'.includes(M.ter(a, b))) continue; const [nx, ny] = CW.center(a, b), dx = (nx - cx) / (2 * R * .866), dy = (ny - cy) / (2 * R * .866);
          for (let k = 0, n = 1 + Math.floor(rand() * 2); k < n; k++) { const along = (rand() - .5) * R * .9, d = R * (.72 + rand() * .14);
            add(rand() < .25 ? 'sapling' : 'shrub', cx + dx * d - dy * along, cy + dy * d + dx * along, PX * (.9 + rand() * .5), rand, hex, .14); }
        }
      } else if (t === 'o') {   // orchard: apple rows, lightly jittered, the odd gap
        for (const j of [-1, 0, 1]) for (const i of [-1, 0, 1]) { if (rand() < .06) continue;
          add('apple', cx + i * R * .5 + (j & 1) * 6 + (rand() - .5) * 3, cy + j * R * .46 + (rand() - .5) * 3, PX * (.95 + rand() * .2), rand, hex, .26); }
      } else if (t === 'g') {   // a few lone field trees and bush clumps
        const q = rand();
        if (q < .07) add(pick(FIELD, rand()), cx + (rand() - .5) * R * 1.1, cy + (rand() - .5) * R, PX * (1.1 + rand() * .3), rand, hex, .3);
        else if (q < .1) for (let k = 0; k < 2 + (rand() * 2 | 0); k++) add('shrub', cx + (rand() - .5) * R, cy + (rand() - .5) * R * .8, PX * (1 + rand() * .5), rand, hex, .2);
      }
    }
    if (CW.WorldEdges) for (const e of CW.WorldEdges.edgesOf(M, 'fence')) {   // hedgerow trees on ~12% of fence edges, a shrub on some more
      const rand = CW.rng(e.k + 7), q = rand(), dx = e.q[0] - e.p[0], dy = e.q[1] - e.p[1], L = Math.hypot(dx, dy), t = .2 + rand() * .6, sd = rand() < .5 ? -1 : 1, o = 3 + rand() * 3;
      const x = e.p[0] + dx * t - dy / L * o * sd, y = e.p[1] + dy * t + dx / L * o * sd, hx = CW.pixelToHex(M, x, y), hex = hx ? hx[1] * M.cols + hx[0] : 0;
      if (q < .12) { add(pick(FIELD, rand(), { cedar: 1.8 }), x, y, PX * (.95 + rand() * .3), rand, hex, .28); add('shrub', x + dx * .12, y + dy * .12, PX * (1 + rand() * .4), rand, hex, .18); }
      else if (q < .27) add('shrub', x, y, PX * (1 + rand() * .5), rand, hex, .18);
    }
    if (CW.WorldStructures) for (const o of CW.WorldStructures.place(M)) {   // town and farm yard trees (world_structures.js picks the spots)
      if (o.kind !== 'broadleaf') continue; const rand = CW.rng(Math.round(o.x * 13 + o.y * 7)), sp = pick(YARD, o.rnd), hx = CW.pixelToHex(M, o.x, o.y);
      add(sp, o.x, o.y, Math.max(PX * .8, Math.min(PX * 1.3, o.sy / T[sp][0].h * (sp === 'apple' ? .5 : 1.1))), rand, hx ? hx[1] * M.cols + hx[0] : 0, .28);
    }
    return out;
  }

  // ---------- shaders ----------
  // the one wind for the whole world: gust bands roll across the map towards the east-south-east (grass and crops will reuse cwGust)
  const WIND = `const vec2 WDIR = vec2(0.866, 0.5);
    float cwGust(vec2 p, float t) { float s = dot(p, WDIR) / 300.0 - t * 0.28 + 0.9 * sin(dot(p, vec2(-WDIR.y, WDIR.x)) / 520.0 + t * 0.05);
      float g = 0.5 + 0.5 * sin(s * 6.2832); return g * g * (0.75 + 0.25 * sin(t * 0.37 + p.x * 0.002)); }`;
  const HEAD = `attribute vec3 aBase; attribute vec4 aPar; attribute vec2 aSc; uniform sampler2D uOcc; uniform vec2 uOccN; uniform float uT, uLive, uH;
    ${WIND}
    float occK() { float hx = aPar.z; float o = texture2D(uOcc, (vec2(mod(hx, uOccN.x), floor(hx / uOccN.x)) + 0.5) / uOccN).r; return o > 0.5 ? (aPar.y < 0.5 ? 0.0 : 0.62) : 1.0; }
    vec3 rotY(vec3 v) { float c = cos(aPar.x), s = sin(aPar.x); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
    // sway: whole tree leans with the gust by wind weight^2 (trunk foot 0 -> twig tips 1); a little side-to-side sine on top
    vec3 sway(float wt, float H) { if (uLive < 0.5) return vec3(0.0); float g = cwGust(aBase.xz, uT), ph = aPar.y * 6.283;
      vec2 d = WDIR * (0.25 + 0.75 * g) * 0.022 + vec2(-WDIR.y, WDIR.x) * 0.006 * sin(uT * 1.1 + ph);
      return vec3(d.x, 0.0, d.y) * H * wt * wt; }`;
  const LIGHT = `const vec3 SUN = vec3(-0.5, 0.75, 0.25);
    vec3 finish(vec3 c, float dist) { float fd = smoothstep(uFogR.x * 0.4, uFogR.y, dist); c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), fd * 0.35);
      return mix(c, uFog, smoothstep(uFogR.x, uFogR.y, dist)); }`;
  const BVS = `${HEAD} attribute vec4 aC; varying vec3 vCol, vN; varying float vDist, vY;
    void main() { float k = occK(); if (k <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec3 l = rotY(vec3(position.x * aSc.x, position.y * aSc.y, position.z * aSc.x)) * k; float H = uH * aSc.y * k;
      vec3 w = aBase + l + sway(aC.a, H); vN = rotY(normal); vCol = pow(aC.rgb, vec3(2.2)); vY = position.y;
      vec4 mv = viewMatrix * vec4(w, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const BFS = `uniform vec3 uFog; uniform vec2 uFogR; uniform float uCb; varying vec3 vCol, vN; varying float vDist, vY; ${LIGHT}
    void main() { vec3 n = normalize(vN); float ndl = clamp((dot(n, normalize(SUN)) + 0.3) / 1.3, 0.0, 1.0);
      float ao = mix(0.45, 1.0, smoothstep(0.0, max(uCb, 0.5), vY)) * mix(1.0, 0.7, smoothstep(uCb, uCb + 3.0, vY));   // dark at the foot and up inside the crown
      vec3 sky = mix(vec3(0.20, 0.17, 0.12), vec3(0.38, 0.45, 0.55), n.y * 0.5 + 0.5);
      gl_FragColor = vec4(finish(vCol * (sky * 0.8 + vec3(1.0, 0.93, 0.78) * 1.1 * ndl) * ao, vDist), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const LVS = `${HEAD} attribute vec4 aL; varying vec2 vUv; varying vec3 vN, vW, vTint; varying float vAo, vDist;
    void main() { float k = occK(); if (k <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec3 l = rotY(vec3(position.x * aSc.x, position.y * aSc.y, position.z * aSc.x)) * k; float H = uH * aSc.y * k; vec3 n = rotY(normal);
      vec3 w = aBase + l + sway(aL.x, H);
      if (uLive > 0.5) w += n * aSc.x * 0.09 * aL.x * sin(uT * 6.5 + aL.z * 40.0 + position.y) * (0.3 + cwGust(aBase.xz, uT));   // leaf flutter
      float r = fract(aPar.y * 7.13), b = fract(aPar.y * 3.71);   // every tree its own green: a little yellower or bluer, lighter or darker
      vTint = mix(vec3(1.0, 0.98, 0.80), vec3(0.80, 0.94, 0.92), r) * (0.80 + 0.26 * b) * (1.0 + 0.10 * step(0.94, fract(aPar.y * 13.7)) * vec3(0.5, 0.25, -0.4));
      vUv = uv; vN = n; vAo = aL.y * aL.y; vW = w; vec4 mv = viewMatrix * vec4(w, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const LFS = `uniform sampler2D uAtlas; uniform vec2 uAtlasN; uniform vec3 uFog; uniform vec2 uFogR; varying vec2 vUv; varying vec3 vN, vW, vTint; varying float vAo, vDist; ${LIGHT}
    void main() { vec4 tx = texture2D(uAtlas, vUv);
      vec2 st = vUv * uAtlasN; float lod = max(0.0, 0.5 * log2(max(dot(dFdx(st), dFdx(st)), dot(dFdy(st), dFdy(st)))));
      float a = tx.a * (1.0 + 0.35 * lod);   // far away (blurry mip levels) keep the crowns full instead of thinning out
      a = (a - 0.5) / max(fwidth(a), 0.0001) + 0.5; if (a < 0.02) discard;   // crisp edge; alpha-to-coverage turns it into soft anti-aliased leaves
      vec3 n = normalize(vN), L = normalize(SUN), V = normalize(cameraPosition - vW); float ndl = dot(n, L), wrap = clamp((ndl + 0.35) / 1.35, 0.0, 1.0);
      float back = pow(clamp(dot(-V, L), 0.0, 1.0), 3.0) * clamp(0.6 - ndl * 0.5, 0.0, 1.0) + 0.10 * clamp(-ndl, 0.0, 1.0);   // sun shining through the leaves
      vec3 alb = tx.rgb * vTint, sky = mix(vec3(0.16, 0.15, 0.08), vec3(0.36, 0.44, 0.52), n.y * 0.5 + 0.5);
      vec3 c = alb * (sky * 0.5 + vec3(1.0, 0.93, 0.76) * 0.82 * wrap * wrap) * (0.25 + 0.75 * vAo) + alb * vec3(0.85, 1.0, 0.25) * back * 0.7 * vAo;
      gl_FragColor = vec4(finish(c, vDist), clamp(a, 0.0, 1.0));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const SVS = `attribute vec3 aBase, aShd; attribute vec4 aPar; uniform sampler2D uOcc; uniform vec2 uOccN; varying vec2 vQ; varying float vA;
    void main() { float hx = aPar.z; float o = texture2D(uOcc, (vec2(mod(hx, uOccN.x), floor(hx / uOccN.x)) + 0.5) / uOccN).r; float k = o > 0.5 ? (aPar.y < 0.5 ? 0.0 : 0.62) : 1.0;
      if (k <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec2 c = position.xy, dir = normalize(vec2(1.0, -0.45)), side = vec2(-dir.y, dir.x); float R = aShd.x * k, Hc = aShd.y * k, Lh = R * 1.05 + Hc * 0.45;
      vec2 p = dir * (Hc * 0.62 + c.x * 2.0 * Lh) + side * c.y * 2.0 * R * 1.05;   // from under the trunk to well east of it (low western sun)
      vQ = c * 2.0; vA = aShd.z; gl_Position = projectionMatrix * viewMatrix * vec4(aBase + vec3(p.x, 0.9, p.y), 1.0); }`;
  const SFS = `varying vec2 vQ; varying float vA; void main() { float d = length(vQ); gl_FragColor = vec4(0.08, 0.07, 0.12, (1.0 - smoothstep(0.25, 1.0, d)) * vA); }`;

  const dec = (s, T) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
  let atlasTex = null;
  function atlas() {   // the painted leaf atlas: a data: URL, so it never taints a canvas and works by double-click
    if (atlasTex) return atlasTex; const img = new Image(); atlasTex = new THREE.Texture(img);
    Object.assign(atlasTex, { flipY: false, colorSpace: THREE.SRGBColorSpace, anisotropy: 4 }); img.onload = () => { atlasTex.needsUpdate = true; }; img.src = CW.TREES.atlas; return atlasTex;
  }

  // draw a placed list (map px, W3 maps to world). shared: { uOcc, uOccN, uT, uLive, uFog, uFogR }. Returns the meshes (also used by the model gallery).
  function draw(scene, list, W3, shared) {
    const TS = CW.TREES, parts = [], groups = new Map(), [gc, gr] = TS.grid;
    list.forEach(t => { const k = t.sp + ':' + t.v; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
    const inst = items => { const n = items.length, base = new Float32Array(n * 3), par = new Float32Array(n * 4), sc = new Float32Array(n * 2);
      items.forEach((t, i) => { const b = W3(t.x, t.y); base.set([b.x, b.y - .5, b.z], i * 3); par.set([t.yaw, t.rnd, t.hex, 0], i * 4); sc.set([t.s, t.sy], i * 2); });
      return { n, base: new THREE.InstancedBufferAttribute(base, 3), par: new THREE.InstancedBufferAttribute(par, 4), sc: new THREE.InstancedBufferAttribute(sc, 2) }; };
    const geo = (I, attrs, idx) => { const g = new THREE.InstancedBufferGeometry(); for (const [k, a] of Object.entries(attrs)) g.setAttribute(k, a); g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.setAttribute('aBase', I.base); g.setAttribute('aPar', I.par); g.setAttribute('aSc', I.sc); g.instanceCount = I.n; return g; };
    for (const [key, items] of groups) {
      const [sp, v] = key.split(':'), m = TS.species[sp][+v], I = inst(items), own = { uH: { value: m.h }, uCb: { value: m.hc * .6 } };
      const bark = new THREE.Mesh(geo(I, { position: new THREE.BufferAttribute(dec(m.bp, Float32Array), 3), normal: new THREE.BufferAttribute(dec(m.bn, Int8Array), 3, true),
        aC: new THREE.BufferAttribute(dec(m.bc, Uint8Array), 4, true) }, dec(m.bi, Uint16Array)),
        new THREE.ShaderMaterial({ vertexShader: BVS, fragmentShader: BFS, uniforms: Object.assign({}, shared, own), side: THREE.DoubleSide }));
      bark.frustumCulled = false; scene.add(bark); parts.push(bark);
      if (!m.lp) continue;
      const leaves = new THREE.Mesh(geo(I, { position: new THREE.BufferAttribute(dec(m.lp, Float32Array), 3), normal: new THREE.BufferAttribute(dec(m.ln, Int8Array), 3, true),
        uv: new THREE.BufferAttribute(dec(m.luv, Uint16Array), 2, true), aL: new THREE.BufferAttribute(dec(m.la, Uint8Array), 4, true) }, dec(m.li, Uint16Array)),
        new THREE.ShaderMaterial({ vertexShader: LVS, fragmentShader: LFS, side: THREE.DoubleSide, alphaToCoverage: true,
          uniforms: Object.assign({}, shared, own, { uAtlas: { value: atlas() }, uAtlasN: { value: new THREE.Vector2(256 * gc, 256 * gr) } }) }));
      leaves.frustumCulled = false; scene.add(leaves); parts.push(leaves);
    }
    // one soft shadow per tree, all trees in a single draw
    const n = list.length, base = new Float32Array(n * 3), par = new Float32Array(n * 4), shd = new Float32Array(n * 3);
    list.forEach((t, i) => { const m = TS.species[t.sp][t.v], b = W3(t.x, t.y); base.set([b.x, b.y, b.z], i * 3); par.set([t.yaw, t.rnd, t.hex, 0], i * 4);
      shd.set([Math.max(1.2, m.r) * t.s, m.hc * t.sy, t.sh], i * 3); });
    const sg = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1); sg.index = q.index; sg.setAttribute('position', q.attributes.position);
    sg.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3)); sg.setAttribute('aPar', new THREE.InstancedBufferAttribute(par, 4)); sg.setAttribute('aShd', new THREE.InstancedBufferAttribute(shd, 3)); sg.instanceCount = n;
    const sh = new THREE.Mesh(sg, new THREE.ShaderMaterial({ vertexShader: SVS, fragmentShader: SFS, uniforms: { uOcc: shared.uOcc, uOccN: shared.uOccN },
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }));
    sh.frustumCulled = false; sh.renderOrder = 1; scene.add(sh); parts.push(sh);
    return parts;
  }

  // env: { scene, M, W3 (map px -> world), occ (DataTexture of unit-occupied hexes), U (shared uniforms uT, uLive) }
  function build(env) {
    const { scene, M, W3, occ, U } = env; if (!CW.TREES) throw new Error('trees.js missing');
    dispose(); const list = place(M);
    const shared = { uOcc: { value: occ }, uOccN: { value: new THREE.Vector2(M.cols, M.rows) }, uT: U.uT, uLive: U.uLive,
      uFog: { value: scene.fog.color }, uFogR: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } };
    state = { scene, parts: draw(scene, list, W3, shared) }; return list.length;
  }
  let state = null;
  function dispose() { if (!state) return; state.parts.forEach(m => { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); state = null; }
  return { place, build, dispose, draw, WIND };
})();
