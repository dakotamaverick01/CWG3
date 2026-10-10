'use strict';
// WORLD structures: buildings, bridge, ford, fort and rocks placed from the map file (no painted coordinates, no Millbrook hexes).
// Rules (table: docs/WORLD_RECIPE.md section 6):
//   t town   : every hex gets up to 3 lots; buildings face the road through the hex (or the nearest road / the town's middle).
//              Each connected town gets one church (hex nearest its middle, if it has 3+ hexes) and one store; the rest are houses.
//   h farm   : farmhouse facing the road, barn behind it, haystacks, well, woodpile.
//   b bridge : three-arch stone bridge laid along the road (else across the river).   d ford: stepping stones.
//   x fort   : ring of earthwork sections facing outward, wedge tents inside.          k knoll: boulders.
//   map field structures:[[c, r, 'mill'], ...]: stone grist mill with its wheel on the water side.
// Models: assets/art/models.js (CW.MODELS, baked by tools/bake_models.py from assets/models/MANIFEST.json). Our own buildings are in
// metres and drawn at K px per metre; kit pieces are normalised and drawn at a pixel height.
CW.WorldStructures = (function () {
  let parts = [], scene = null;
  const WATER = new Set(['w', 'b', 'd']), K = 2.4;           // px per metre for our buildings (a 9 m farmhouse = ~22 px, trees are 36-50 px)
  const front = (fx, fy) => Math.atan2(fx, fy);             // yaw that turns a model's front (+Z) toward map direction (fx, fy)
  const side = (dx, dy) => Math.atan2(-dy, dx);              // yaw that turns a model's +X toward map direction (dx, dy)

  function roadDir(M, c, r) {   // unit direction of a road through this hex, or null
    for (const rd of M.roads) { const i = rd.p.findIndex(p => p[0] === c && p[1] === r); if (i < 0) continue;
      const a = CW.center(...rd.p[Math.max(0, i - 1)]), b = CW.center(...rd.p[Math.min(rd.p.length - 1, i + 1)]), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L > 1) return [dx / L, dy / L]; }
    return null;
  }
  function towardSet(M, c, r, test) {   // unit vector toward the neighbours that pass `test`, or [0, 0]
    const here = CW.center(c, r); let wx = 0, wy = 0;
    for (const [a, b] of M.nbrs(c, r)) if (test(a, b)) { const q = CW.center(a, b); wx += q[0] - here[0]; wy += q[1] - here[1]; }
    const L = Math.hypot(wx, wy); return L > 1 ? [wx / L, wy / L] : [0, 0];
  }
  const onRoad = (M, a, b) => M.roads.some(rd => rd.p.some(p => p[0] === a && p[1] === b));
  function crossDir(M, c, r) {
    const d = roadDir(M, c, r); if (d) return d;
    const [wx, wy] = towardSet(M, c, r, (a, b) => WATER.has(M.ter(a, b))); return wx || wy ? [-wy, wx] : [1, 0];
  }
  // connected groups of one letter -> Map(hexKey -> {centre, size, rank}) where rank orders hexes by distance to the group's middle
  function groups(M, letter) {
    const key = (c, r) => c + ',' + r, seen = new Set(), info = new Map();
    for (const [c0, r0] of M.all) { if (M.ter(c0, r0) !== letter || seen.has(key(c0, r0))) continue;
      const comp = [], st = [[c0, r0]]; seen.add(key(c0, r0));
      while (st.length) { const h = st.pop(); comp.push(h); for (const [a, b] of M.nbrs(...h)) if (M.ter(a, b) === letter && !seen.has(key(a, b))) { seen.add(key(a, b)); st.push([a, b]); } }
      const cs = comp.map(h => CW.center(...h)), mx = cs.reduce((s, p) => s + p[0], 0) / cs.length, my = cs.reduce((s, p) => s + p[1], 0) / cs.length;
      comp.map((h, i) => [h, Math.hypot(cs[i][0] - mx, cs[i][1] - my)]).sort((a, b) => a[1] - b[1] || a[0][0] - b[0][0] || a[0][1] - b[0][1])
        .forEach(([h], rank) => info.set(key(...h), { mid: [mx, my], size: comp.length, rank })); }
    return info;
  }

  // pure placement: [{kind, x, y (map px), lift, yaw, pitch, rnd, sx, sy, sz}]
  function place(M) {
    const R = CW.R, MD = CW.MODELS || {}, out = [], taken = [];
    const kit = (kind, x, y, h, yaw, rnd, lift) => out.push({ kind, x, y, lift: lift || 0, yaw, pitch: 0, rnd, sx: h, sy: h, sz: h });
    const bld = (kind, x, y, yaw, rnd, lift, k = K, j = 1) => { const q = (rnd * 7.31) % 1, kk = k * (1 + (q - .5) * .10 * j);   // every copy a little turned and sized
      out.push({ kind, x, y, lift: lift || 0, yaw: yaw + (rnd - .5) * .12 * j, pitch: 0, rnd, sx: kk, sy: kk * (1 + ((rnd * 3.7) % 1 - .5) * .08 * j), sz: kk }); };
    const foot = kind => { const m = MD[kind]; return m ? Math.max(m.x || m.w, m.d) * K * .5 : 10; };
    const segs = []; for (const rd of M.roads) for (let i = 0; i < rd.p.length - 1; i++) segs.push([CW.center(...rd.p[i]), CW.center(...rd.p[i + 1])]);
    const roadDist = (x, y) => segs.reduce((m, [p, q]) => { const dx = q[0] - p[0], dy = q[1] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.min(m, Math.hypot(x - p[0] - dx * t, y - p[1] - dy * t)); }, 1e9);
    const free = (x, y, rad) => taken.every(([a, b, q]) => Math.hypot(a - x, b - y) > (q + rad) * .82);                  // not on another building
    const offRoad = (kind, x, y, yaw) => { const m = MD[kind]; if (!m) return true; const hx = (m.x || m.w) * K / 2, hz = m.d * K / 2, cx = Math.cos(yaw), sx = Math.sin(yaw);
      for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1]) { const lx = u * hx, lz = v * hz; if (roadDist(x + lx * cx + lz * sx, y - lx * sx + lz * cx) < 10) return false; }   // footprint corners/edges clear of every road
      return true; };
    const claim = (x, y, rad) => taken.push([x, y, rad]);
    // a lived-in yard around a house that faces (fx, fy): picket fence out front, shade tree, kitchen garden, privy, woodpile (each by chance)
    const YARD_SKIP = new Set(['church', 'store', 'store_b']);
    function yard(kind, x, y, fx, fy, rand) {
      const m = MD[kind]; if (!m) return; const hd = m.d * K * .5, hw = (m.x || m.w) * K * .5, tx = -fy, ty = fx;
      if (kind === 'store' || kind === 'store_b') { const bx = x + tx * (hw + 3) + fx * (hd - 2), by = y + ty * (hw + 3) + fy * (hd - 2); if (free(bx, by, 3)) { bld('barrels', bx, by, rand() * 6.283, rand()); claim(bx, by, 3); } return; }
      if (YARD_SKIP.has(kind)) return;
      if (rand() < .55) for (const sd of [-1, 1]) { const px = x + fx * (hd + 2.5) + tx * sd * (hw * .62), py = y + fy * (hd + 2.5) + ty * sd * (hw * .62);
        if (offRoad('picket', px, py, front(fx, fy))) out.push({ kind: 'picket', x: px, y: py, lift: 0, yaw: front(fx, fy), pitch: 0, rnd: rand(), sx: hw * .13, sy: K * 1.7, sz: K }); }
      if (rand() < .5) { const sd = rand() < .5 ? 1 : -1, px = x - fx * (hd + 6) + tx * sd * (hw * .6), py = y - fy * (hd + 6) + ty * sd * (hw * .6); if (free(px, py, 6)) { kit('broadleaf', px, py, 21 + rand() * 9, rand() * 6.283, rand()); claim(px, py, 5); } }
      if (rand() < .4) { const px = x - fx * (hd + 9) - tx * (hw * .3), py = y - fy * (hd + 9) - ty * (hw * .3), yw = front(fx, fy); if (free(px, py, 7) && offRoad('garden', px, py, yw)) { bld('garden', px, py, yw, rand()); claim(px, py, 6); } }
      if (rand() < .45) { const sd = rand() < .5 ? 1 : -1, px = x - fx * (hd + 4) + tx * sd * (hw + 4), py = y - fy * (hd + 4) + ty * sd * (hw + 4); if (free(px, py, 3) && offRoad('outhouse', px, py, 0)) { bld('outhouse', px, py, front(fx, fy) + Math.PI, rand()); claim(px, py, 3); } }
      if (rand() < .4) { const sd = rand() < .5 ? 1 : -1, px = x + tx * sd * (hw + 3), py = y + ty * sd * (hw + 3); if (free(px, py, 3) && offRoad('outhouse', px, py, 0)) { kit('logsBig', px, py, 4.5 + rand() * 2, rand() * 6.283, rand()); claim(px, py, 3); } }
    }
    const towns = groups(M, 't');

    for (const [c, r] of M.all) {
      const t = M.ter(c, r); if (!'thxbdk'.includes(t)) continue;
      const rand = CW.rng(c * 7919 + r * 104729 + 55), [cx, cy] = CW.center(c, r), a0 = rand() * 6.283;
      if (t === 't') {
        const g = towns.get(c + ',' + r), rd = roadDir(M, c, r), lots = [];
        if (rd) {   // two lots each side of the road, fronts toward it
          const [ux, uy] = rd, nx = -uy, ny = ux;
          for (const s of [1, -1]) for (const a of [-.36, .36]) lots.push({ ax: ux * a * R, ay: uy * a * R, nx: nx * s, ny: ny * s });
        } else {    // no road here: face the nearest road hex, else the middle of the town
          let [fx, fy] = towardSet(M, c, r, (a, b) => onRoad(M, a, b)); if (!fx && !fy) { const L = Math.hypot(g.mid[0] - cx, g.mid[1] - cy) || 1; [fx, fy] = [(g.mid[0] - cx) / L, (g.mid[1] - cy) / L]; }
          for (const a of [-.42, 0, .42]) lots.push({ ax: -fy * a * R, ay: fx * a * R, nx: -fx, ny: -fy, back: true });
        }
        for (let i = lots.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [lots[i], lots[j]] = [lots[j], lots[i]]; }   // seeded shuffle
        const kinds = [];
        if (g.size >= 3 && g.rank === 0) kinds.push('church');
        if (g.rank === (g.size >= 3 ? 1 : 0)) kinds.push('store');
        if (kinds[kinds.length - 1] === 'store' && rand() < .5) kinds[kinds.length - 1] = 'store_b';
        const HOUSES = ['farmhouse', 'house_b', 'cottage', 'house_l', 'brick_house', 'brick_b', 'house_b', 'cottage', 'log_cabin'];
        while (kinds.length < 3) { const k = HOUSES[Math.floor(rand() * HOUSES.length)]; if (!kinds.includes(k) || rand() < .25) kinds.push(k); }
        let n = 0;
        for (const lot of lots) { if (n >= kinds.length) break; const kind = kinds[n], m = MD[kind]; if (!m) { n++; continue; }
          const set = lot.back ? R * .05 : 11 + m.d * K * .5;                                  // set back from the road by half the building's depth
          const x = cx + lot.ax + lot.nx * set, y = cy + lot.ay + lot.ny * set, rad = foot(kind);
          const yaw = front(-lot.nx, -lot.ny); if (!free(x, y, rad) || !offRoad(kind, x, y, yaw)) continue;
          bld(kind, x, y, yaw, rand()); claim(x, y, rad); n++;
          yard(kind, x, y, -lot.nx, -lot.ny, rand); }
        if (rand() < .6) { const x = cx + (rand() - .5) * R * .6, y = cy + (rand() - .5) * R * .6; if (free(x, y, 4) && offRoad('well', x, y, 0)) { bld('well', x, y, rand() * 6.283, rand()); claim(x, y, 4); } }
        if (rd && rand() < .55) { const [ux, uy] = rd, sd = rand() < .5 ? 1 : -1, a = (rand() - .5) * R * .7, x = cx + ux * a - uy * sd * 8.5, y = cy + uy * a + ux * sd * 8.5;   // a wagon pulled up at the roadside
          if (free(x, y, 5)) { bld(rand() < .5 ? 'wagon_covered' : 'wagon', x, y, side(ux, uy) + (rand() < .5 ? Math.PI : 0), rand()); claim(x, y, 5); } }
      } else if (t === 'h') {
        const rd = roadDir(M, c, r); let [fx, fy] = rd ? [-rd[1], rd[0]] : towardSet(M, c, r, (a, b) => onRoad(M, a, b)); if (!fx && !fy) [fx, fy] = [0, 1];
        const hk = ['farmhouse', 'house_b', 'house_l', 'cottage'][Math.floor(rand() * 4)], bk = rand() < .5 ? 'barn' : 'barn_b';
        const hx = cx + fx * R * .18, hy = cy + fy * R * .18; bld(hk, hx, hy, front(fx, fy), rand()); claim(hx, hy, foot(hk)); yard(hk, hx, hy, fx, fy, rand);
        const bx = cx - fx * R * .42 + fy * R * .2, by = cy - fy * R * .42 - fx * R * .2; bld(bk, bx, by, front(fx, fy) + (rand() < .5 ? 1.5708 : 0), rand()); claim(bx, by, foot(bk));
        { const x = bx + fy * R * .3, y = by - fx * R * .3; if (free(x, y, 5) && rand() < .6) { bld('wagon', x, y, rand() * 6.283, rand()); claim(x, y, 5); } }
        for (const s of [1, -1]) { const x = cx + fy * s * R * .55 - fx * R * .1, y = cy - fx * s * R * .55 - fy * R * .1; if (free(x, y, 5)) { bld('haystack', x, y, rand() * 6.283, rand()); claim(x, y, 5); } }
        { const x = cx + fy * R * .32 + fx * R * .45, y = cy - fx * R * .32 + fy * R * .45; if (free(x, y, 3)) bld('well', x, y, rand() * 6.283, rand()); }
        { const x = cx - fy * R * .5 + fx * R * .3, y = cy + fx * R * .5 + fy * R * .3; if (free(x, y, 6)) { bld('shed', x, y, front(fx, fy), rand()); claim(x, y, 6); } }
      } else if (t === 'x') {
        const N = 7, rad = R * .56, seg = 2 * Math.PI * rad / N, sl = seg / (10 * K) * 1.12;   // earthwork sections overlap a little at the corners
        for (let k = 0; k < N; k++) { const a = k / N * 6.283 + a0, fx = Math.cos(a), fy = Math.sin(a);
          out.push({ kind: 'earthwork', x: cx + fx * rad, y: cy + fy * rad * .95, lift: -.3, yaw: front(fx, fy), pitch: 0, rnd: rand(), sx: K * sl, sy: K, sz: K }); }
        for (const [dx, dy] of [[-.16, -.1], [.12, -.16], [.02, .16]]) bld('wedge_tent', cx + dx * R, cy + dy * R, a0 + rand() * .4, rand());
      } else if (t === 'k') {
        for (let k = 0; k < 3; k++) kit(k === 1 ? 'rockC' : 'rockA', cx + (rand() - .5) * R * 1.1, cy + (rand() - .5) * R * .9, 8 + rand() * 6, rand() * 6.283, rand(), -1);
      } else if (t === 'b') {
        const [dx, dy] = crossDir(M, c, r); out.push({ kind: 'stone_bridge', x: cx, y: cy, lift: 0, yaw: side(dx, dy), pitch: 0, rnd: rand(), sx: K, sy: K, sz: K });
      } else if (t === 'd') {
        const [dx, dy] = crossDir(M, c, r); out.push({ kind: 'stepRocks', x: cx, y: cy, lift: 1.2, yaw: side(dx, dy), pitch: 0, rnd: rand(), sx: R * 1.5, sy: R * 1.5, sz: R * .5 });
      }
    }
    for (const [c, r, kind] of (M.structures || [])) {       // named structures listed in the map file
      if (!M.in(c, r)) continue;
      const rand = CW.rng(c * 7919 + r * 104729 + 99), [cx, cy] = CW.center(c, r);
      if (kind === 'mill') {   // wheel (+X) toward the water; set back so the wheel just reaches the bank
        let [wx, wy] = towardSet(M, c, r, (a, b) => WATER.has(M.ter(a, b))); if (!wx && !wy) [wx, wy] = [1, 0];
        const x = cx + wx * R * .22, y = cy + wy * R * .22; bld('grist_mill', x, y, side(wx, wy), rand()); claim(x, y, foot('grist_mill'));
        kit('logsBig', x - wy * R * .5 - wx * R * .2, y + wx * R * .5 - wy * R * .2, 8, rand() * 6.283, rand());
      }
    }
    return out;
  }

  // soft sun shadows: each building's footprint swept away from the low western sun (the same sun as every other light in the game)
  const SVS = `attribute vec3 aBase; attribute vec4 aBox; varying vec2 vQ; varying vec4 vB; varying vec2 vS;
    void main() {
      float cy = cos(aBox.x), sy = sin(aBox.x); vec2 sw = vec2(0.5, -0.25) / 0.75 * aBox.w * 1.35;            // ground shadow vector (world x, z) for sun (-0.5, 0.75, 0.25), stretched a little: late-afternoon light
      vec2 sl = vec2(sw.x * cy - sw.y * sy, sw.x * sy + sw.y * cy);                                       // same vector in the building's own axes
      vec2 e = aBox.yz + 3.0, lo = min(-e, -e + sl), hi = max(e, e + sl), q = mix(lo, hi, position.xy + 0.5);
      vQ = q; vB = vec4(aBox.yz, 0.0, 0.0); vS = sl;
      vec3 wp = aBase + vec3(q.x * cy + q.y * sy, 1.1, -q.x * sy + q.y * cy);
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`;
  const SFS = `varying vec2 vQ; varying vec4 vB; varying vec2 vS;
    float box(vec2 p) { vec2 d = abs(p) - vB.xy; return 1.0 - smoothstep(-2.5, 2.5, max(d.x, d.y)); }
    void main() { float a = 0.0; for (int k = 0; k <= 6; k++) { float t = float(k) / 6.0; a = max(a, box(vQ - vS * t) * (1.0 - 0.3 * t)); }
      gl_FragColor = vec4(0.08, 0.07, 0.12, a * 0.55); }`;
  const NO_SHADOW = new Set(['stone_bridge', 'earthwork', 'stepRocks', 'rockA', 'rockC', 'logsBig', 'picket', 'garden', 'barrels']);
  function shadows(list) {
    const MD = CW.MODELS, items = list.filter(o => MD[o.kind] && MD[o.kind].norm === 'meters' && !NO_SHADOW.has(o.kind)), n = items.length; if (!n) return null;
    const base = new Float32Array(n * 3), box = new Float32Array(n * 4);
    items.forEach((o, i) => { const m = MD[o.kind], b = list.W3(o.x, o.y); base.set([b.x, b.y + o.lift, b.z], i * 3);
      box.set([o.yaw, (m.x || m.w) * o.sx * .5, m.d * o.sz * .5, Math.min(m.h, 12) * o.sy], i * 4); });
    const g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1); g.index = q.index; g.setAttribute('position', q.attributes.position);
    g.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3)); g.setAttribute('aBox', new THREE.InstancedBufferAttribute(box, 4)); g.instanceCount = n;
    const me = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: SVS, fragmentShader: SFS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); me.frustumCulled = false; me.renderOrder = 1; return me;
  }

  // chimney smoke: soft puffs rising from some chimneys and drifting east on the breeze. Runs on the shared Living clock (uT, uLive);
  // with Living off the puffs stay where they are (still wisps), so nothing moves and nothing disappears.
  const PVS = `attribute vec3 aBase; attribute vec2 aSeed; uniform float uT, uLive; varying float vA; varying vec2 vUV;
    void main() {
      float t = fract((uLive > 0.5 ? uT * 0.05 : 0.0) + aSeed.x);
      vec3 c = aBase + vec3(t * t * 26.0 + sin(t * 6.0 + aSeed.y * 9.0) * 1.5, t * 30.0, -t * t * 9.0);
      float size = 1.6 + t * 8.5; vec4 mv = viewMatrix * vec4(c, 1.0); mv.xy += position.xy * size;
      vA = smoothstep(0.0, 0.10, t) * (1.0 - t) * (0.30 + 0.15 * aSeed.y); vUV = position.xy * 2.0;
      gl_Position = projectionMatrix * mv; }`;
  const PFS = `varying float vA; varying vec2 vUV;
    void main() { float d = length(vUV); float a = vA * (1.0 - smoothstep(0.25, 1.0, d)); if (a < 0.004) discard; gl_FragColor = vec4(0.64, 0.64, 0.68, a); }`;
  function smoke(list, U) {
    const MD = CW.MODELS, pts = [];
    for (const o of list) { const m = MD[o.kind]; if (!m || !m.smoke) continue;
      m.smoke.forEach((a, i) => { if (((o.rnd * 9.7 + i * .37) % 1) > .55) return;                    // about half the chimneys are lit
        const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw), lx = a[0] * o.sx, lz = a[2] * o.sz; pts.push([o.x + lx * cy + lz * sy, o.y - lx * sy + lz * cy, o.lift + a[1] * o.sy, o.rnd + i]); }); }
    if (!pts.length || !U) return null;
    const P = 7, n = pts.length * P, base = new Float32Array(n * 3), seed = new Float32Array(n * 2);
    pts.forEach(([x, y, h, r], i) => { const b = list.W3(x, y); for (let k = 0; k < P; k++) { base.set([b.x, b.y + h, b.z], (i * P + k) * 3); seed.set([k / P + (r * 3.1 % 1) * .13, (r * 7.7 + k * .29) % 1], (i * P + k) * 2); } });
    const g = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1); g.index = q.index; g.setAttribute('position', q.attributes.position);
    g.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3)); g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 2)); g.instanceCount = n;
    const me = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: PVS, fragmentShader: PFS, uniforms: { uT: U.uT, uLive: U.uLive }, transparent: true, depthWrite: false })); me.frustumCulled = false; me.renderOrder = 3; return me;
  }

  // env: { scene, M, W3, U (shared Living uniforms) }
  function build(env) {
    const SM = CW.MODELS; if (!SM) throw new Error('models.js missing');
    dispose(); scene = env.scene; const list = place(env.M); list.W3 = env.W3;
    const fog = { uFog: { value: scene.fog.color }, uFogR: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } };
    parts = CW.WorldEdges.instanced(scene, list, SM, [...new Set(list.map(o => o.kind))], fog);
    const sh = shadows(list); if (sh) { scene.add(sh); parts.push(sh); }
    const sm = smoke(list, env.U); if (sm) { scene.add(sm); parts.push(sm); }
    return list.length;
  }
  function dispose() { parts.forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); parts = []; }
  return { place, build, dispose };
})();
