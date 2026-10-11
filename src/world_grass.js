'use strict';
// Living fields, pieces 2+3: real grass blades, reeds and cattails, wheat and corn in rows.
// Grass: ONE instanced draw of grass tufts (5 blades each) on a lattice that follows the camera. Every tuft is wrapped to the copy of its
// lattice cell nearest the view centre, so blades stay pinned to the ground while you scroll, and each one takes its height, lean, colour and
// a little extra jitter from its WORLD position, so the lattice never shows as a repeating pattern. Where grass grows comes from a small map
// texture built once from the hex letters (g full, o 70%, h/t 30% trampled, f 25% short and shaded, s tall wet grass, c/k/water/roads none),
// feathered at hex borders with noise. Grass fades in from zoom ~1.8 and is switched off below it (the ground texture carries it far away).
// Reeds and cattails: instanced tufts along every brook and both river banks (CW.WorldWater.fromMap), same shader.
// Wind: the world gust (CW.WorldTrees.WIND) only while Living is on; off = frozen. Under unit-occupied hexes the blades lie flatter.
CW.WorldGrass = (function () {
  const S = 600, SP = 2.5, NB = 5, Q = 4;   // lattice square (map px), tuft spacing, blades per tuft, data texture cell (px)
  const DENS = { g: [1, 0, 0], o: [.7, 0, 0], h: [.3, 0, 0], t: [.3, 0, 0], f: [.25, 0, 1], s: [1, 1, 0], x: [.3, 0, 0] };

  // one tuft (or reed clump): per vertex aB = (base x, base z, t along the blade, side -1/1, 0 = tip), aD = (lean angle, height, width, kind 0 blade 1 flower 2 cattail head)
  function tuft(reed, seed, crop) {
    const rand = CW.rng(seed), B = [], D = [], I = [];
    const blade = (bx, bz, ang, h, w, kind, t0 = 0, t1 = .55, t2 = 1) => { const o = B.length / 4;
      for (const [t, s] of [[t0, -1], [t0, 1], [t1, -1], [t1, 1], [t2, 0]]) { B.push(bx, bz, t, s); D.push(ang, h, w, kind); }
      I.push(o, o + 1, o + 2, o + 1, o + 3, o + 2, o + 2, o + 3, o + 4); };
    if (crop === 1) { for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + rand() * .8, r = rand() * .9; blade(Math.cos(a) * r, Math.sin(a) * r, a, .8 + rand() * .35, 1, 0, 0, .78, 1); }   // wheat: thin stalk, ear at the top
      return { B: new Float32Array(B), D: new Float32Array(D), I: new Uint16Array(I) }; }
    if (crop === 2) { const h = .9 + rand() * .2; blade(0, 0, 0, h, 1.3, 0);   // corn: stalk, 4 arching leaves, tassel
      for (let i = 0; i < 4; i++) blade(0, 0, i * 1.57 + rand() * .8, h * (.75 + rand() * .2), 2.2, 5, .22 + i * .1, .5 + i * .08, .9);
      blade(0, 0, rand() * 6.283, h, .5, 4, .92, 1.0, 1.1); return { B: new Float32Array(B), D: new Float32Array(D), I: new Uint16Array(I) }; }
    const n = reed ? 7 : NB;
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + rand() * .8, r = rand() * (reed ? .9 : .7);
      blade(Math.cos(a) * r, Math.sin(a) * r, a + (rand() - .5) * .8, (reed ? .75 : .65) + rand() * .45, (reed ? .7 : .8) + rand() * .5, 0); }
    if (reed) for (let i = 0; i < 2; i++) { const a = rand() * 6.283, r = rand() * .5, h = 1.05 + rand() * .25, ang = rand() * 6.283;   // cattails: a stiff stem + a brown head
      blade(Math.cos(a) * r, Math.sin(a) * r, ang, h, .35, 3); blade(Math.cos(a) * r, Math.sin(a) * r, ang, h, 1, 2, .70, .80, .93); }
    else { const o = B.length / 4;   // wildflower head on blade 0 (shown on ~2% of tufts)
      for (let k = 0; k < 4; k++) { B.push(B[0], B[1], 1, k); D.push(D[0], D[1], D[2], 1); } I.push(o, o + 1, o + 2, o, o + 2, o + 3); }
    return { B: new Float32Array(B), D: new Float32Array(D), I: new Uint16Array(I) };
  }

  const VS = `attribute vec4 aB, aD; attribute vec2 aOff;
    uniform vec2 uCen, uMap, uOccN; uniform float uS, uZoom, uT, uLive, uWrap, uReed, uCrop; uniform sampler2D uGD, uHex, uOcc; varying vec3 vCol; varying float vDist;
    ${CW.WorldTrees.WIND}
    const vec3 SUN = vec3(-0.5, 0.75, 0.25);
    float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), f.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main() {
      vec2 p = aOff;
      if (uWrap > 0.5) { p = aOff + uS * floor((uCen - aOff) / uS + 0.5); p += (vec2(h1(p), h1(p + 7.3)) - 0.5) * ${SP.toFixed(2)}; }
      vec2 uv = (p + uMap * 0.5) / uMap; vec4 gd = texture2D(uGD, uv);   // r height, g grass density, b tall wet grass, a forest floor
      float r1 = h1(p * 1.37), r2 = h1(p * 0.71 + 3.1), r3 = h1(p * 2.11 + 9.7), k = smoothstep(1.7, 2.6, uZoom);
      if (uWrap > 0.5 && uCrop < 0.5) { if (r1 > gd.g * (0.55 + 0.9 * vn(p / 23.0))) k = 0.0; k *= 1.0 - smoothstep(uS * 0.36, uS * 0.5, length(p - uCen)); }
      bool fl = aD.w > 0.5 && aD.w < 1.5;
      if (fl && (r3 > 0.022 || gd.b > 0.5 || gd.a > 0.5)) k = 0.0;
      if (k < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec2 hx = floor(texture2D(uHex, uv).rg * 255.0 + 0.5); float occ = step(0.5, texture2D(uOcc, (hx + 0.5) / uOccN).r) * (1.0 - uReed);
      float H = (uCrop > 1.5 ? 10.0 : uCrop > 0.5 ? 4.6 : uReed > 0.5 ? 8.0 : 3.0) * mix(1.0, 1.8, gd.b) * mix(1.0, 0.6, gd.a) * (0.65 + 0.7 * r2) * aD.y * k;
      float a = aD.x + r3 * 6.2832, t = aB.z; vec2 dir = vec2(cos(a), sin(a)), perp = vec2(-dir.y, dir.x);
      float tt = fl ? 1.0 : t, lean = (aD.w > 4.5 ? 0.55 : uCrop > 0.5 ? 0.05 : uReed > 0.5 ? 0.08 : 0.28 + 0.25 * r1) * (1.0 + 2.6 * occ);
      vec2 bend = dir * H * lean * tt * tt;
      if (uLive > 0.5) { float g = cwGust(p, uT); bend += WDIR * H * tt * tt * (0.42 * g + 0.07 * sin(uT * 2.3 + r1 * 6.283)) * (uReed > 0.5 ? 0.5 : uCrop > 1.5 ? 0.45 : uCrop > 0.5 ? 1.5 : 1.0); }
      float y = H * tt * mix(1.0, 0.3, occ);
      float w = uCrop > 0.5 && uCrop < 1.5 ? (t < 0.5 ? 0.06 : 0.34) : aD.w > 1.5 && aD.w < 2.5 ? 0.30 : 0.26 * aD.z * (1.0 - 0.85 * t) * (uReed > 0.5 ? 0.8 : 1.0);
      vec2 rot = vec2(aB.x * cos(r3 * 6.2832) - aB.y * sin(r3 * 6.2832), aB.x * sin(r3 * 6.2832) + aB.y * cos(r3 * 6.2832));
      vec3 wp = vec3(p.x + rot.x + bend.x, gd.r + y - 0.15, p.y + rot.y + bend.y);
      if (fl) { float c = aB.w; wp += vec3((c == 1.0 || c == 2.0) ? 0.4 : -0.4, 0.15, c >= 2.0 ? 0.4 : -0.4); } else wp.xz += perp * w * aB.w;
      // colour: dark foot -> sunlit tip, lush and dry patches, shade under the forest, bluer wet grass; light from the low western sun
      float dry = smoothstep(0.5, 0.85, vn(p / 61.0 + 3.0)) * 0.75 + 0.25 * smoothstep(0.6, 0.9, vn(p / 13.0));
      vec3 tip = mix(vec3(0.115, 0.19, 0.035), vec3(0.30, 0.25, 0.075), dry) * (0.82 + 0.36 * r2);
      tip = mix(tip, vec3(0.07, 0.15, 0.06), gd.b * 0.7);
      vec3 col = mix(vec3(0.022, 0.036, 0.008), tip, pow(t, 0.7));
      if (uReed > 0.5) col = mix(vec3(0.035, 0.05, 0.015), vec3(0.24, 0.29, 0.09) * (0.8 + 0.4 * r2), pow(t, 0.6));
      if (aD.w > 1.5 && aD.w < 2.5) col = vec3(0.19, 0.09, 0.035) * (0.8 + 0.3 * t);
      if (uCrop > 0.5 && uCrop < 1.5) col = mix(vec3(0.07, 0.06, 0.015), vec3(0.50, 0.35, 0.09) * (0.85 + 0.3 * r2), pow(t, 0.6)) * mix(1.0, 0.8, smoothstep(0.55, 0.9, vn(p / 40.0)));
      if (uCrop > 1.5) col = aD.w > 3.5 && aD.w < 4.5 ? vec3(0.40, 0.31, 0.12) : mix(vec3(0.02, 0.04, 0.01), vec3(0.10, 0.21, 0.04) * (0.8 + 0.4 * r2), pow(t, 0.6));
      if (fl) col = r2 < 0.4 ? vec3(0.85, 0.83, 0.72) : r2 < 0.75 ? vec3(0.9, 0.62, 0.05) : vec3(0.38, 0.14, 0.55);
      vec3 V = normalize(cameraPosition - wp); float face = 0.85 + 0.3 * dot(perp, normalize(SUN.xz)) * aB.w * 0.5;
      float back = pow(clamp(dot(-V, normalize(SUN)), 0.0, 1.0), 3.0) * t;
      col = col * (0.62 + 0.55 * face) * mix(1.0, 0.5, gd.a) + col * vec3(0.9, 1.0, 0.3) * back * 0.8;
      vCol = col; vec4 mv = viewMatrix * vec4(wp, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const FS = `uniform vec3 uFog; uniform vec2 uFogR; varying vec3 vCol; varying float vDist;
    void main() { vec3 c = mix(vCol, uFog, smoothstep(uFogR.x, uFogR.y, vDist)); gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  // map data: r terrain height, g grass density, b tall wet grass, a forest floor (half floats, 4 px cells) + hex id texture (for unit occupancy)
  function mapData(M, W3, MW, MH) {
    const w = Math.ceil(MW / Q), h = Math.ceil(MH / Q); let A = document.createElement('canvas'); A.width = w; A.height = h; const a = A.getContext('2d');
    a.scale(1 / Q, 1 / Q); a.filter = 'blur(1.5px)';
    M.all.forEach(([c, r]) => { const d = DENS[M.ter(c, r)]; if (!d) return; const [x, y] = CW.center(c, r);
      a.fillStyle = `rgb(${d[0] * 255 | 0},${d[1] * 255},${d[2] * 255})`; CW.hexPath(a, x, y, CW.R * 1.02); a.fill(); });
    a.filter = 'none'; a.globalCompositeOperation = 'destination-out'; a.strokeStyle = '#000'; a.lineCap = a.lineJoin = 'round';
    (M.roads || []).forEach(rd => { CW.smoothPath(a, rd.p.map(p => CW.center(...p))); a.lineWidth = rd.major ? 15 : 11; a.stroke(); });
    const water = CW.WorldWater ? CW.WorldWater.fromMap(M) : { streams: [] };
    water.streams.forEach(l => { a.beginPath(); l.forEach((p, i) => i ? a.lineTo(...p) : a.moveTo(...p)); a.lineWidth = 7; a.stroke(); });
    const px = a.getImageData(0, 0, w, h).data; A.width = A.height = 0; A = null;
    const half = THREE.DataUtils.toHalfFloat, gd = new Uint16Array(w * h * 4), hgt = new Float32Array(w * h), hex = new Uint8Array(w * h * 4);
    const HW = CW.HW, R = CW.R;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i, x = (i + .5) * Q, y = (j + .5) * Q, al = px[k * 4 + 3] / 255; hgt[k] = W3(Math.min(x, MW - 1), Math.min(y, MH - 1)).y;
      gd[k * 4] = half(hgt[k]); gd[k * 4 + 1] = half(px[k * 4] / 255 * al); gd[k * 4 + 2] = half(px[k * 4 + 1] / 255 * al); gd[k * 4 + 3] = half(px[k * 4 + 2] / 255 * al);
      let best = 1e9, bc = 0, br = 0; const r0 = Math.round((y - R * 1.2) / (1.5 * R));   // nearest hex centre = the hex this cell is in
      for (let r = r0 - 1; r <= r0 + 1; r++) { const c0 = Math.round((x - R * .3 - (r & 1 ? HW / 2 : 0)) / HW - .5);
        for (let c = c0 - 1; c <= c0 + 1; c++) { const [cx, cy] = CW.center(c, r), d = (cx - x) ** 2 + (cy - y) ** 2; if (d < best) { best = d; bc = c; br = r; } } }
      hex[k * 4] = Math.max(0, Math.min(255, bc)); hex[k * 4 + 1] = Math.max(0, Math.min(255, br));
    }
    const T1 = new THREE.DataTexture(gd, w, h, THREE.RGBAFormat, THREE.HalfFloatType); T1.magFilter = T1.minFilter = THREE.LinearFilter; T1.needsUpdate = true;
    const T2 = new THREE.DataTexture(hex, w, h, THREE.RGBAFormat); T2.needsUpdate = true;   // nearest filtering (default)
    return { T1, T2, hgt, w, h, water };
  }

  function mesh(geo, inst, uniforms) {
    const g = new THREE.InstancedBufferGeometry(); g.setAttribute('aB', new THREE.BufferAttribute(geo.B, 4)); g.setAttribute('aD', new THREE.BufferAttribute(geo.D, 4));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geo.B.length / 4 * 3), 3)); g.setIndex(new THREE.BufferAttribute(geo.I, 1));
    g.setAttribute('aOff', new THREE.InstancedBufferAttribute(inst, 2)); g.instanceCount = inst.length / 2;
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms, side: THREE.DoubleSide })); m.frustumCulled = false; return m;
  }

  // reeds and cattails: clumps in beds along both banks of every brook and the river (skipping fords and bridges)
  function reedSpots(M, water, MW, MH) {
    const out = [], rand = CW.rng(4242), sm = l => CW.WorldEdges ? CW.WorldEdges.smooth(l, 3) : l;
    const bank = (line, off0, off1, keep) => { const L = sm(line); let s = 0;
      for (let i = 0; i < L.length - 1; i++) { const p = L[i], q = L[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
        for (let u = 0; u < len; u += 2.2) { s += 2.2; const x = p[0] + dx * u / len, y = p[1] + dy * u / len;
          for (const sd of [-1, 1]) { if (Math.sin(s * .045 + sd * 2 + i * .01) + Math.sin(s * .13 + sd) < keep || rand() < .35) continue;
            const o = off0 + rand() * (off1 - off0), X = x - dy / len * o * sd, Y = y + dx / len * o * sd, hx = CW.pixelToHex(M, X, Y);
            if (hx && 'bdcrt'.includes(M.ter(...hx))) continue; out.push(X - MW / 2 + (rand() - .5) * 1.5, Y - MH / 2 + (rand() - .5) * 1.5); } } } };
    water.streams.forEach(l => bank(l, 3.5, 7, -.4));
    (water.rivers || []).forEach(l => bank(l, water.rw * .42, water.rw * .62, -.1));
    return new Float32Array(out);
  }

  // crops: rows of wheat / corn tufts in every crop hex, one seeded row direction per field (CW.cropKind), one culled mesh per hex
  function cropHexes(M, MW, MH) {
    const K = CW.cropKind ? CW.cropKind(M) : new Map(), ang = new Map(), R = CW.R, out = [];
    for (const [c, r] of M.all) { const k = K.get(c + ',' + r); if (!k || ang.has(c + ',' + r)) continue;   // flood the field, one direction for all of it
      const a = CW.rng(c * 131 + r * 977)() * Math.PI, st = [[c, r]]; ang.set(c + ',' + r, a);
      while (st.length) { const [x, y] = st.pop(); for (const [u, v] of M.nbrs(x, y)) if (K.get(u + ',' + v) === k && !ang.has(u + ',' + v)) { ang.set(u + ',' + v, a); st.push([u, v]); } } }
    for (const [key, a] of ang) { const [c, r] = key.split(',').map(Number), kind = K.get(key) === 'corn' ? 2 : 1, [cx, cy] = CW.center(c, r), rand = CW.rng(c * 7 + r * 3001);
      const RS = kind === 2 ? 4.6 : 2.9, AS = kind === 2 ? 3.4 : 2.6, ca = Math.cos(a), sa = Math.sin(a), pts = [];
      const k0 = Math.floor(((cx - ca * 0) * -sa + cy * ca - R) / RS), k1 = Math.ceil(((cx) * -sa + cy * ca + R) / RS);
      for (let k = k0; k <= k1; k++) { const d = (k + .5) * RS, s0 = Math.floor((cx * ca + cy * sa - R) / AS), s1 = Math.ceil((cx * ca + cy * sa + R) / AS);
        for (let q = s0; q <= s1; q++) { const sl = (q + .5) * AS + (rand() - .5) * AS * .5, x = ca * sl - sa * d, y = sa * sl + ca * d, dx = Math.abs(x - cx), dy = Math.abs(y - cy);
          if (dx <= R * .866 && dy <= R - dx / 1.732) pts.push(x - MW / 2, y - MH / 2); } }
      out.push({ kind, cx: cx - MW / 2, cy: cy - MH / 2, pts: new Float32Array(pts) }); }
    return out;
  }

  // env: { scene, M, W3, occ, U }
  function build(env) {
    const { scene, M, W3, occ, U } = env, [MW, MH] = CW.mapSize(M); dispose();
    const D = mapData(M, W3, MW, MH), n = Math.round(S / SP), lat = new Float32Array(n * n * 2);
    let q = 0; for (let m = 0; m < n; m++) for (let j = 0; j <= m; j++) for (let i = 0; i <= m; i++) if (Math.max(i, j) === m) lat.set([(i + .5) * SP, (j + .5) * SP], 2 * q++);   // square shells: the first m*m tufts make an m x m square
    const base = { uGD: { value: D.T1 }, uHex: { value: D.T2 }, uOcc: { value: occ }, uOccN: { value: new THREE.Vector2(M.cols, M.rows) }, uMap: { value: new THREE.Vector2(MW, MH) },
      uCen: { value: new THREE.Vector2() }, uS: { value: S }, uZoom: { value: 3 }, uT: U.uT, uLive: U.uLive, uFog: { value: scene.fog.color }, uFogR: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } };
    const grass = mesh(tuft(false, 99), lat, Object.assign({}, base, { uWrap: { value: 1 }, uReed: { value: 0 }, uCrop: { value: 0 } }));
    const rs = reedSpots(M, D.water, MW, MH), reeds = rs.length ? mesh(tuft(true, 77), rs, Object.assign({}, base, { uWrap: { value: 0 }, uReed: { value: 1 }, uCrop: { value: 0 } })) : null;
    const geoW = tuft(false, 55, 1), geoC = tuft(false, 66, 2), crops = cropHexes(M, MW, MH).map(h => {
      const me = mesh(h.kind === 2 ? geoC : geoW, h.pts, Object.assign({}, base, { uWrap: { value: 0 }, uReed: { value: 0 }, uCrop: { value: h.kind } }));
      const y = W3(h.cx + MW / 2, h.cy + MH / 2).y; me.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(h.cx, y, h.cy), CW.R * 1.2); me.frustumCulled = true; scene.add(me); return me; });
    scene.add(grass); if (reeds) scene.add(reeds);
    // each frame, before three.js sorts the scene: where is the view centre on the ground, and how far are we zoomed in?
    const f = new THREE.Vector3(), sz = new THREE.Vector2(), hg = (x, z) => { const i = Math.max(0, Math.min(D.w - 1, (x + MW / 2) / Q | 0)), j = Math.max(0, Math.min(D.h - 1, (z + MH / 2) / Q | 0)); return D.hgt[j * D.w + i]; };
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (ren, sc, cam) { prev.apply(this, arguments);
      cam.getWorldDirection(f); const o = cam.position; if (f.y > -.05) return; let y = 0, x = o.x, z = o.z;
      for (let k = 0; k < 3; k++) { const t = (o.y - y) / -f.y; x = o.x + f.x * t; z = o.z + f.z * t; y = hg(x, z); }
      ren.getSize(sz); const zoom = sz.y / (2 * Math.hypot(x - o.x, y - o.y, z - o.z) * Math.tan(cam.fov * Math.PI / 360));
      base.uCen.value.set(x, z); base.uZoom.value = zoom;
      const E = Math.hypot(sz.x / 2, sz.y / 2 / Math.max(.4, -f.y)) / zoom * 1.25, m = Math.min(n, Math.ceil(2 * E / SP));   // only as much lattice as the screen shows
      base.uS.value = m * SP; grass.geometry.instanceCount = m * m; grass.visible = on && zoom > 1.7; if (reeds) reeds.visible = on && zoom > 1.7; crops.forEach(c => { c.visible = on && zoom > 1.7; }); };
    state = { scene, parts: [grass, reeds, ...crops].filter(Boolean), tex: [D.T1, D.T2], prev };
    return n * n + rs.length / 2;
  }
  let state = null, on = true;
  function dispose() { if (!state) return; state.parts.forEach(m => { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); state.tex.forEach(t => t.dispose());
    state.scene.onBeforeRender = state.prev; state = null; }
  return { build, dispose, enable: b => { on = !!b; } };   // enable(false): hide grass + reeds (for timing tests)
})();
