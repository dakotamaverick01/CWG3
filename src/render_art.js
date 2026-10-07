'use strict';
// Painted-art map renderer (Phase B). Uses the textures + props made by tools/intake.py (assets/art/art.js).
// Falls back to the code-drawn painter in render_map.js if art.js is missing.
(function loadArt() {
  const A = window.ART; if (!A) return;
  const out = { ground: {}, props: new Image(), frames: A.props.frames }; let left = 1 + Object.keys(A.ground).length;
  const done = () => { if (--left) return; CW.ARTI = out; CW.resetMap && CW.resetMap(); };
  for (const k in A.ground) { const im = new Image(); im.onload = done; im.onerror = done; im.src = A.ground[k]; out.ground[k] = im; }
  out.props.onload = done; out.props.onerror = done; out.props.src = A.props.img;
})();

// smooth value noise, 0..1, for painterly masks
CW.noise = function (w, h, cell, seed, oct = 3) {
  const rnd = CW.rng(seed), f = new Float32Array(w * h); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++, cell /= 2, amp /= 2) { const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, G = new Float32Array(gw * gh).map(() => rnd()); tot += amp;
    for (let y = 0; y < h; y++) { const gy = y / cell, iy = gy | 0, fy = gy - iy, sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < w; x++) { const gx = x / cell, ix = gx | 0, fx = gx - ix, sx = fx * fx * (3 - 2 * fx), i = iy * gw + ix;
        f[y * w + x] += amp * ((G[i] * (1 - sx) + G[i + 1] * sx) * (1 - sy) + (G[i + gw] * (1 - sx) + G[i + gw + 1] * sx) * sy); } } }
  for (let i = 0; i < f.length; i++) f[i] /= tot; return f;
};

CW.renderMapArt = function (M, weather) {
  const A = CW.ARTI, R = CW.R, [MW, MH] = CW.mapSize(M), cv = document.createElement('canvas'); cv.width = MW; cv.height = MH;
  const ctx = cv.getContext('2d'), rand = CW.rng(11), Q = 4, qw = Math.ceil(MW / Q), qh = Math.ceil(MH / Q), wet = weather === 'mud' || weather === 'rain';
  const TS = .42; // texture scale: one 512px texture ≈ 2.8 hexes
  const pat = (name, rot = 0, ox = 0, oy = 0, s = TS) => { const p = ctx.createPattern(A.ground[name], 'repeat'); p.setTransform(new DOMMatrix().translate(ox, oy).rotate(rot).scale(s)); return p; };
  const nz = CW.noise(qw, qh, 40, 5), nz2 = CW.noise(qw, qh, 90, 9);
  // soft, ragged mask of every hex matching test(), built at 1/4 size then smoothed up
  const mask = (test, spread = .28, rough = .9, field = nz, grow = 1.05) => {
    const m = document.createElement('canvas'); m.width = qw; m.height = qh; const mx = m.getContext('2d'); mx.fillStyle = '#fff'; mx.scale(1 / Q, 1 / Q);
    for (let r = -1; r <= M.rows; r++) for (let c = -1; c <= M.cols; c++) { const cc = Math.max(0, Math.min(M.cols - 1, c)), rr = Math.max(0, Math.min(M.rows - 1, r));
      if (test(cc, rr)) { CW.hexPath(mx, ...CW.center(c, r), R * grow); mx.fill(); } }
    const d = mx.getImageData(0, 0, qw, qh); let a = new Float32Array(qw * qh); for (let i = 0; i < a.length; i++) a[i] = d.data[i * 4 + 3] / 255;
    a = CW.boxBlur(a, qw, qh, Math.max(1, Math.round(R * spread / Q)), 1);
    for (let i = 0; i < a.length; i++) { const v = Math.max(0, Math.min(1, (a[i] - .5) * 3.2 + (field[i] - .5) * rough * 2 + .5)); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = 255; d.data[i * 4 + 3] = v * 255; }
    mx.setTransform(1, 0, 0, 1, 0, 0); mx.putImageData(d, 0, 0); return m;
  };
  // mask from noise alone: coverage ≈ share of the field above `th`
  const nmask = (field, th, soft = .12) => { const m = document.createElement('canvas'); m.width = qw; m.height = qh; const mx = m.getContext('2d'), d = mx.createImageData(qw, qh);
    for (let i = 0; i < field.length; i++) { d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = 255; d.data[i * 4 + 3] = Math.max(0, Math.min(1, (field[i] - th) / soft + .5)) * 255; }
    mx.putImageData(d, 0, 0); return m; };
  // one scratch canvas reused for every layer (a fresh full-size canvas per layer ran laptop GPUs out of memory → garbled map)
  const LC = document.createElement('canvas'); LC.width = MW; LC.height = MH; const LX = LC.getContext('2d');
  const layer = (fill, m, alpha = 1, comp) => { const l = LC, lx = LX; lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1; lx.clearRect(0, 0, MW, MH);
    if (typeof fill === 'function') fill(lx); else { lx.fillStyle = fill; lx.fillRect(0, 0, MW, MH); }
    if (m) { lx.globalCompositeOperation = 'destination-in'; lx.imageSmoothingQuality = 'high'; lx.drawImage(m, 0, 0, MW, MH); }
    ctx.save(); ctx.globalAlpha = alpha; if (comp) ctx.globalCompositeOperation = comp; ctx.drawImage(l, 0, 0); ctx.restore(); };
  const T = (c, r) => M.ter(c, r), is = s => (c, r) => s.includes(T(c, r));
  const lx = document.createElement('canvas').getContext('2d'); // for patterns bound to layers
  const patOn = (x, name, rot, ox, oy, s = TS) => { const p = x.createPattern(A.ground[name], 'repeat'); p.setTransform(new DOMMatrix().translate(ox, oy).rotate(rot).scale(s)); return p; };
  const tex = (name, rot = 0, ox = 0, oy = 0, s) => x => { x.fillStyle = patOn(x, name, rot, ox, oy, s); x.fillRect(0, 0, MW, MH); };

  // 1. meadow: two grass textures blended by large-scale noise so the repeat never lines up
  if (A.ground.sgb_0 && CW.SEASON !== 'autumn') {   // batch 3 summer meadow: painterly flower meadow + a second meadow + worn patches + tall hay, blended by noise
    ctx.fillStyle = pat('sgb_0'); ctx.fillRect(0, 0, MW, MH);
    layer(tex('sgc_0', 90, 131, 57, TS * 1.12), nmask(nz2, .5, .2), .85);
    layer(tex('sgb_1', 0, 300, 170), nmask(nz, .7, .08), .8);                            // grazed, worn patches
    layer(tex('sgb_2', 180, 211, 377, TS * .9), nmask(nz, .56, .15), .7);                 // tall hay grass
    layer(tex('sga_0', 45, 97, 13, TS * 1.3), nmask(nz2.map(v => 1 - v), .58, .2), .45);   // richer green in the hollows
    layer('rgb(120,150,70)', nmask(nz2, .52, .25), .3, 'multiply');                        // deep green swales
    layer('rgb(235,200,120)', nmask(nz2.map(v => 1 - v), .62, .2), .1, 'overlay');         // a little sun on the rises
  } else {
    ctx.fillStyle = pat('rocky_3'); ctx.fillRect(0, 0, MW, MH);
    layer(tex('rocky_3', 90, 131, 57, TS * 1.12), nmask(nz2, .5, .2), .9);
    layer(tex('rocky_0', 0, 300, 170), nmask(nz, .66, .08), 1); // scattered stony patches
    layer(tex('rocky_3', 180, 211, 377, TS * .8), nmask(nz, .56, .15), .75);             // third scale/rotation breaks the repeat
    layer('rgb(70,110,30)', null, .38, 'soft-light');                                      // meadow greener than the wheat
    layer('rgb(120,150,70)', nmask(nz2, .52, .25), .55, 'multiply');                       // deep green swales
    layer('rgb(235,180,90)', nmask(nz2.map(v => 1 - v), .6, .2), .22, 'overlay');          // sun-bleached rises
  }
  // 2. terrain grounds
  layer(tex('farmyard_1', 0, 40, 90), mask(is('ht'), .3, .8));                       // farm & village yards
  layer(tex('mud_2', 0, 10, 10), mask(is('t'), .18, .8), .5);
  layer(tex('rocky_1', 0, 77, 33), mask(is('k'), .3, .9));                             // rocky knoll
  layer(tex('rocky_2', 30, 0, 0), mask(is('k'), .1, 1.1), .6);
  layer(tex('mud_3', 0, 0, 0), mask(is('sx'), .3, .9));                                // swamp & earthworks
  if (A.ground.wheat_0 && A.ground.corn_0) {                                              // batch 2: painted wheat & corn (each field is one crop)
    const K = CW.cropKind(M), isW = (c, r) => T(c, r) === 'c' && K.get(c + ',' + r) !== 'corn', isC = (c, r) => K.get(c + ',' + r) === 'corn';
    const S4 = A.ground.crpa_0 && CW.SEASON !== 'autumn';   // batch 4: green summer wheat + corn
    layer(tex(S4 ? 'crpb_1' : 'wheat_0', 0, 0, 0), mask(isW, .22, .5), 1); layer(tex(S4 ? 'crpa_1' : 'wheat_1', S4 ? 0 : 90, 60, 20), mask(isW, .1, .9, nz2, .9), .5);
    layer(tex(S4 ? 'crpa_0' : 'corn_0', 0, 0, 0), mask(isC, .2, .45), 1); layer(tex(S4 ? 'crpb_0' : 'corn_1', 0, 130, 70), mask(isC, .1, .9, nz2, .9), .45);
    if (wet) { layer(tex('wheat_2', 0, 0, 0), mask(isW, .1, 1.1, nz2, .8), .6); layer(tex('corn_2', 0, 0, 0), mask(isC, .1, 1.1, nz2, .8), .6); }
  } else {
  layer(tex('farmyard_2', 0, 0, 0), mask(is('c'), .22, .5), 1);                        // crop fields: golden stubble…
  layer('rgb(214,168,70)', mask(is('c'), .22, .5), .55, 'overlay');
  }
  layer(tex('rocky_3', 0, 0, 0), mask(is('fo'), .35, .7), .7);                          // woods floor
  { const fm = mask(is('f'), .3, 1.0, nz, .98);
    ctx.save(); ctx.translate(14, 9); layer('rgba(20,15,35,1)', fm, .35); ctx.restore();         // forest casts a long shadow east
    layer(x => { const g = x.createLinearGradient(0, 0, MW, MH); g.addColorStop(0, 'rgb(46,62,26)'); g.addColorStop(1, 'rgb(34,48,22)'); x.fillStyle = g; x.fillRect(0, 0, MW, MH); }, fm, .95); }
  if (wet) layer(tex('mud_1', 0, 0, 0, TS * .9), nmask(nz2, .35, .3), .5);

  // 3. light: hillshade from heights + warm golden-hour grade (per pixel)
  const hc = document.createElement('canvas'); hc.width = MW; hc.height = MH; const hx = hc.getContext('2d'); hx.fillStyle = '#000'; hx.fillRect(0, 0, MW, MH);
  for (let r = -1; r <= M.rows; r++) for (let c = -1; c <= M.cols; c++) { const cc = Math.max(0, Math.min(M.cols - 1, c)), rr = Math.max(0, Math.min(M.rows - 1, r)), hv = M.h(cc, rr) * 50;
    hx.fillStyle = `rgb(${hv},${hv},${hv})`; CW.hexPath(hx, ...CW.center(c, r), R + 1); hx.fill(); }
  const hd = hx.getImageData(0, 0, MW, MH).data, cd = ctx.getImageData(0, 0, MW, MH), o = cd.data, N = MW * MH;
  let H = new Float32Array(N); for (let i = 0; i < N; i++) H[i] = hd[i * 4] / 50; H = CW.boxBlur(H, MW, MH, Math.round(R * .7), 1);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x, xl = Math.max(0, x - 1), xr = Math.min(MW - 1, x + 1), yu = Math.max(0, y - 1), yd = Math.min(MH - 1, y + 1);
    // sun low in the west-north-west: west/north-facing slopes lit gold, east slopes in cool shade
    const dx = (H[y * MW + xr] - H[y * MW + xl]) * R, dy = (H[yd * MW + x] - H[yu * MW + x]) * R, s = Math.max(-.5, Math.min(.4, -(dx * .9 + dy * .35) * .34)), h = H[i];
    let r = o[i * 4], g = o[i * 4 + 1], b = o[i * 4 + 2];
    if (s >= 0) { r += s * 120; g += s * 80; b += s * 20; } else { const k = 1 + s; r *= k * .96; g *= k; b = b * k + (-s) * 30; }
    r += 6 * h; g += 4 * h; b -= 3 * h;                                                      // high ground catches more light
    r = r * 1.05 + 4; b = b * .9;                                                            // golden grade
    if (wet) { r *= .86; g *= .88; b *= .92; }
    o[i * 4] = r < 0 ? 0 : r > 255 ? 255 : r; o[i * 4 + 1] = g < 0 ? 0 : g > 255 ? 255 : g; o[i * 4 + 2] = b < 0 ? 0 : b > 255 ? 255 : b; }
  ctx.putImageData(cd, 0, 0); hc.width = hc.height = 0;   // free the height map

  CW.paintArtFeatures(ctx, M, rand, pat, wet);
  // gentle vignette so the eye stays on the field
  const vg = ctx.createRadialGradient(MW / 2, MH / 2, Math.min(MW, MH) * .45, MW / 2, MH / 2, Math.max(MW, MH) * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,20,5,.35)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, MW, MH);
  LC.width = LC.height = 0;   // release the scratch memory now, not whenever the garbage collector gets to it
  return cv;
};

// draw one atlas prop: anchor (bottom-centre) at x,y, width w (px), optional mirror
CW.prop = function (ctx, name, x, y, w, flip = false, rot = 0) {
  const A = CW.ARTI, f = A && A.frames[name]; if (!f) return; const [sx, sy, sw, sh, ax, ay] = f, s = w / sw;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(A.props, sx, sy, sw, sh, -ax * sw * s, -ay * sh * s, sw * s, sh * s); ctx.restore();
};

CW.paintArtFeatures = function (ctx, M, rand, pat, wet, objs) {   // objs (3D view only): trees are collected as objects instead of painted; same rand order, so every other prop lands where the minimap shows it
  CW.WATER = { river: null, rw: 0, streams: [] };   // session 17a: water paths recorded for the 3D flow mask (data only)
  const R = CW.R, P = CW.prop, each = (t, fn) => M.all.forEach(([c, r]) => { if (M.ter(c, r) === t) fn(...CW.center(c, r), c, r); }), sprites = [];
  const put = (y, fn) => sprites.push([y, fn]); // upright objects, drawn back-to-front after the flat stuff
  // crop rows: painted wheat strokes
  const realCrops = !!(CW.ARTI && CW.ARTI.ground.wheat_0 && CW.ARTI.ground.corn_0), K = CW.cropKind(M);
  if (realCrops) each('c', (x, y, c, r) => { if (K.get(c + ',' + r) !== 'corn' && rand() < .3) put(y + R * .3, () => P(ctx, rand() < .6 ? 'clut_sheaves' : 'clut_haystack', x + (rand() - .5) * R, y + R * .3, R * .45)); });
  else each('c', (x, y) => { ctx.save(); CW.hexPath(ctx, x, y, R * 1.02); ctx.clip();
    for (let i = -R; i < R; i += 5) for (let j = -R; j < R; j += 3) { const px = x + j + (rand() - .5) * 2, py = y + i + j * .18 + (rand() - .5) * 2, l = 3 + rand() * 3;
      ctx.strokeStyle = rand() < .7 ? `rgba(${230 + rand() * 25},${190 + rand() * 30},${90 + rand() * 30},.55)` : 'rgba(110,80,30,.45)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (rand() - .3) * 1.5, py - l); ctx.stroke(); }
    ctx.restore(); if (rand() < .35) put(y + R * .3, () => P(ctx, rand() < .5 ? 'clut_sheaves' : 'clut_haystack', x + (rand() - .5) * R, y + R * .3, R * .45)); });
  // swamp reeds and pools
  each('s', (x, y) => { for (let i = 0; i < 9; i++) { const px = x + (rand() - .5) * R * 1.4, py = y + (rand() - .5) * R * 1.2;
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(70,95,105,.55)'; ctx.beginPath(); ctx.ellipse(px, py + 4, 8 + rand() * 6, 3 + rand() * 2, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,210,140,.25)'; ctx.beginPath(); ctx.ellipse(px - 2, py + 3, 4, 1.2, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(60,70,25,.85)'; ctx.lineWidth = 1.1; for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(px + j * 2, py); ctx.lineTo(px + j * 3.2, py - 6 - rand() * 5); ctx.stroke(); } } });
  // river: muddy banks, deep water, faint pale sky reflections (session 18: pale dashes, not gold)
  const riv = M.all.filter(([c, r]) => 'wbd'.includes(M.ter(c, r))).map(h => CW.center(...h)).sort((a, b) => a[1] - b[1]);
  if (riv.length) { riv.unshift([riv[0][0], riv[0][1] - R * 1.4]); riv.push([riv[riv.length - 1][0], riv[riv.length - 1][1] + R * 1.4]);
    const rw = R * .92; CW.WATER.river = riv.map(p => p.slice()); CW.WATER.rw = rw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const RW = !!CW.ARTI.ground.water_1;                                                   // batch 2: painted river water + mud banks
    CW.smoothPath(ctx, riv); ctx.strokeStyle = pat(RW ? 'water_2' : 'mud_0', 0, 0, 0, .3); ctx.lineWidth = rw + 16; ctx.stroke();
    ctx.strokeStyle = 'rgba(40,30,15,.35)'; ctx.lineWidth = rw + 5; ctx.stroke();
    ctx.strokeStyle = RW ? pat('water_1', 0, 0, 0, .3) : '#2f5566'; ctx.lineWidth = rw; ctx.stroke();
    ctx.strokeStyle = 'rgba(70,120,130,.8)'; ctx.lineWidth = rw * .6; ctx.stroke();
    ctx.setLineDash([6, 22, 2, 30]); ctx.strokeStyle = 'rgba(222,230,228,.28)'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]); }
  // roads: packed-earth texture with ruts
  for (const rd of M.roads) { const pts = rd.p.map(p => CW.center(...p)), w = rd.major ? 11 : 8; CW.smoothPath(ctx, pts); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(60,42,20,.45)'; ctx.lineWidth = w + 4; ctx.stroke();
    const G = CW.ARTI.ground, rt = G.road_0 ? (wet ? 'road_2' : rd.major ? 'road_1' : 'road_0') : (wet ? 'mud_1' : 'farmyard_0');   // batch 2 road surfaces
    ctx.strokeStyle = pat(rt, 0, 0, 0, .25); ctx.lineWidth = w; ctx.stroke();
    if (G.road_3 && !wet) { ctx.strokeStyle = pat('road_3', 0, 30, 10, .25); ctx.globalAlpha = .35; ctx.lineWidth = w + 3; ctx.stroke(); ctx.globalAlpha = 1; }   // dusty verges
    ctx.strokeStyle = wet ? 'rgba(40,28,12,.35)' : 'rgba(255,225,160,.18)'; ctx.lineWidth = w * .45; ctx.stroke(); }
  M.sunken.forEach(([c, r]) => { const [x, y] = CW.center(c, r); ctx.strokeStyle = 'rgba(35,25,12,.7)'; ctx.lineWidth = 2.5; for (const s of [-8, 8]) { ctx.beginPath(); ctx.moveTo(x - CW.HW / 2, y + s); ctx.lineTo(x + CW.HW / 2, y + s); ctx.stroke(); } });
  // streams: chain hex-edge segments into smooth curves through their midpoints
  { const segs = []; M.edgeAt.forEach((types, k) => { if (![...types].includes('stream')) return; const [c, r, d] = k.split(',').map(Number), [x, y] = CW.center(c, r);
      const p = CW.corner(x, y, d), q = CW.corner(x, y, d + 1), key = v => Math.round(v[0]) + ',' + Math.round(v[1]);
      if (!segs.some(s => (s.a === key(p) && s.b === key(q)) || (s.a === key(q) && s.b === key(p)))) segs.push({ a: key(p), b: key(q), m: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] }); });
    const used = new Set();
    for (let i = 0; i < segs.length; i++) { if (used.has(i)) continue; used.add(i); let chain = [segs[i]], grow = true;
      while (grow) { grow = false; for (let j = 0; j < segs.length; j++) { if (used.has(j)) continue; const s = segs[j], h = chain[0], t = chain[chain.length - 1];
          if ([t.a, t.b].includes(s.a) || [t.a, t.b].includes(s.b)) { chain.push(s); used.add(j); grow = true; } else if ([h.a, h.b].includes(s.a) || [h.a, h.b].includes(s.b)) { chain.unshift(s); used.add(j); grow = true; } } }
      let pts = chain.map(s => s.m); if (pts.length < 2) pts.unshift(CW.unkey(chain[0].a));
      // meander: subdivide and push sideways with a slow wave + jitter
      const mp = []; for (let k = 0; k < pts.length - 1; k++) { const [a, b] = [pts[k], pts[k + 1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        for (let u = 0; u < 3; u++) { const f = u / 3, v = (k * 3 + u) * .38 + i, w = (Math.sin(v) * .6 + Math.sin(v * 2.3 + 1) * .3) * R * .22 + (rand() - .5) * R * .06; mp.push([a[0] + dx * f - dy / L * w, a[1] + dy * f + dx / L * w]); } }
      mp.push(pts[pts.length - 1]); pts = mp; CW.WATER.streams.push(pts); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const WG = CW.ARTI.ground.water_0 ? [[pat('water_2', 0, 0, 0, .2), 9], ['rgba(40,30,15,.3)', 6], [pat('water_0', 0, 0, 0, .2), 4.4], ['rgba(53,96,111,.55)', 3], ['rgba(140,185,190,.45)', 1.3], ['rgba(255,214,150,.3)', .8]]   // batch 2: mud bank + pebbly water
        : [['rgba(60,45,20,.45)', 8], ['#35606f', 4.2], ['rgba(110,160,165,.7)', 2], ['rgba(255,214,150,.35)', .8]];
      for (const [col, w] of WG) { CW.smoothPath(ctx, pts); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); }
      if (CW.ARTI.frames.wx_reeds) pts.forEach(([px, py], k) => { if (k % 2 || rand() > .22) return; const side = rand() < .5 ? -1 : 1, qx = px + side * 5, qy = py + 3;   // reeds & cattails on the banks
        put(qy, () => P(ctx, rand() < .6 ? 'wx_reeds' : 'wx_cattails', qx, qy, R * .16, rand() < .5)); }); } }
  // batch 2: painted trees (Grok sheets 11-12) — woodland clumps fill forest hexes, single trees on the edges, orchards in rows
  const TF = CW.ARTI && CW.ARTI.frames;
  if (TF && TF.wood_clump_a && TF.tree_oak) {
    const PT = objs ? (c, n, x, y, w, f) => objs.trees.push([n, x, y, w, !!f]) : P;
    const T = (c, r) => M.in(c, r) ? M.ter(c, r) : null, pick = a => a[rand() * a.length | 0];
    // batch 3: summer trees (5 sheets) when loaded; a rare red maple / dogwood as colour accents
    const SU = TF.sta_oak && CW.SEASON !== 'autumn', has = n => TF[n], L = a => a.filter(has);
    const P_CLUMP = SU ? L(['sta_clump', 'stb_clump', 'sta_oak', 'stb_oak', 'stc_oak', 'std_oak', 'sta_maple', 'stb_maple', 'std_walnut', 'stc_maple', 'ste_oak', 'sta_pine', 'stc_cedar']) : ['wood_clump_a', 'wood_clump_b', 'wood_clump_c', 'wood_clump_a', 'wood_clump_b', 'wood_cedar'];
    const P_EDGE = SU ? L(['sta_poplar', 'stb_poplar', 'stc_elm', 'std_elm', 'std_sycamore', 'stc_ash', 'ste_ash', 'stb_pine', 'ste_pine', 'sta_hickory', 'stb_hickory', 'ste_poplar', 'std_maple']) : ['tree_oak', 'tree_elm', 'tree_hickory', 'tree_pine', 'tree_sycamore', 'tree_maple'];
    const P_LONE = SU ? L(['sta_oak', 'stb_oak', 'stc_oak', 'std_oak', 'sta_oak_young', 'stb_oak_young', 'std_walnut', 'std_elm', 'stc_sassafras', 'ste_maple', 'stc_dogwood', 'ste_dogwood', 'ste_sumac', 'sta_thicket', 'stb_thicket']) : ['tree_oak', 'tree_oak', 'tree_elm', 'tree_oak_young', 'tree_hickory', 'tree_oak_gnarled', 'tree_dead'];
    const P_FARM = SU ? L(['stc_magnolia', 'std_magnolia', 'std_sycamore', 'sta_maple', 'ste_maple', 'ste_magnolia']) : ['tree_oak', 'tree_sycamore', 'tree_maple'];
    const P_ORCH = SU ? L(['sta_apple', 'stb_apple']) : null;
    const accent = n => SU && rand() < .03 && has('ste_red_maple') ? 'ste_red_maple' : n;
    each('f', (x, y, c, r) => { const edge = M.nbrs(c, r).some(([a, b]) => T(a, b) !== 'f');
      for (let i = 0; i < 7; i++) { const px = x + (rand() - .5) * R * 1.7, py = y + (rand() - .5) * R * 1.5 + R * .35;
        put(py - 20, () => PT(ctx, pick(P_CLUMP), px, py, R * (1.15 + rand() * .5), rand() < .5)); }
      if (edge) for (let i = 0; i < 2; i++) { const px = x + (rand() - .5) * R * 1.4, py = y + (rand() - .2) * R * .9 + R * .4;
        put(py - 19, () => PT(ctx, accent(pick(P_EDGE)), px, py, R * (.8 + rand() * .3), rand() < .5)); } });
    each('o', (x, y) => { for (let j = -1; j <= 1; j++) { const py = y + j * R * .5 + R * .25;
      for (let i = -1; i <= 1; i++) { const px = x + i * R * .5 + (j & 1) * R * .22; put(py - 19, () => PT(ctx, P_ORCH ? pick(P_ORCH) : rand() < .8 ? 'wood_apple' : 'wood_peach', px, py, R * .55, rand() < .5)); } } });
    each('g', (x, y) => { if (rand() < .07) { const px = x + (rand() - .5) * R, py = y + (rand() - .5) * R * .8 + R * .3; put(py, () => PT(ctx, accent(pick(P_LONE)), px, py, R * (.8 + rand() * .3), rand() < .5)); } });
    each('h', (x, y) => { if (rand() < .5) { const px = x + R * .45, py = y - R * .1; put(py, () => PT(ctx, pick(P_FARM), px, py, R * .8, rand() < .5)); } });
  }
  // trees: long shadows first, then canopies with gold rim light (code-drawn fallback)
  const trees = []; if (!(TF && TF.wood_clump_a && TF.tree_oak)) {
  each('f', (x, y) => { for (let i = 0; i < 40; i++) trees.push([x + (rand() - .5) * R * 1.8, y + (rand() - .5) * R * 1.7, 6 + rand() * 6]); });
  each('o', (x, y) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) trees.push([x + i * R * .48 + (j & 1) * 7, y + j * R * .45, 4.5, 1]); });
  trees.forEach(([x, y, s, orch]) => { if (orch) { ctx.fillStyle = 'rgba(25,20,40,.3)'; ctx.beginPath(); ctx.ellipse(x + s * 1.4, y + s * .4, s * 1.6, s * .6, .2, 0, 7); ctx.fill(); } });
  trees.forEach(([x, y, s, orch]) => put(y - 20, () => {   // canopies sit on the forest mass, so draw them under units-on-edge props
    const t = rand(), g = ctx.createRadialGradient(x - s * .5, y - s * .6, .5, x, y - s * .2, s * 1.15);
    g.addColorStop(0, orch ? 'rgb(206,190,92)' : `rgb(${168 + t * 40},${150 + t * 25},66)`);
    g.addColorStop(.35, orch ? 'rgb(104,128,44)' : `rgba(${76 + t * 26},${96 + t * 18},38,.9)`);
    g.addColorStop(1, orch ? 'rgb(40,56,24)' : 'rgba(38,52,24,0)');
    if (orch) { ctx.fillStyle = 'rgb(66,48,30)'; ctx.fillRect(x - 1, y - s * .2, 2, s * .6); }
    ctx.fillStyle = g; ctx.beginPath(); const n = 5 + (rand() * 3 | 0);
    for (let k = 0; k < n; k++) { const a = k / n * 6.283 + t, rr = s * (.55 + rand() * .3); ctx.moveTo(x + Math.cos(a) * s * .38 + rr, y - s * .3 + Math.sin(a) * s * .3); ctx.arc(x + Math.cos(a) * s * .38, y - s * .3 + Math.sin(a) * s * .3, rr, 0, 7); }
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,130,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x - s * .15, y - s * .45, s * .6, 3.4, 4.6); ctx.stroke(); }));
  }
  // hex features with props
  const town = ['bldg_church', 'bldg_store', 'bldg_tavern', 'bldg_brick_house', 'bldg_school', 'bldg_frame_house_b', 'bldg_smithy', 'bldg_brick_house_b', 'bldg_store_b', 'bldg_tavern_b'];
  let ti = 0;
  M.all.forEach(([c, r]) => { const t = M.ter(c, r), [x, y] = CW.center(c, r);
    if (t === 't') { const spots = [[-.42, -.3], [.38, -.22], [-.1, .38]]; spots.forEach(([dx, dy], k) => { const nm = town[(ti++) % town.length], px = x + dx * R, py = y + dy * R + R * .25;
      put(py, () => P(ctx, nm, px, py, R * (nm.includes('church') ? .9 : 1.0), (c + k) % 2 === 1)); }); put(y + R * .6, () => P(ctx, 'clut_well', x + R * .45, y + R * .55, R * .22)); }
    if (t === 'h') { put(y + R * .05, () => P(ctx, 'bldg_frame_house', x - R * .2, y + R * .05, R * .9)); put(y - R * .25, () => P(ctx, 'bldg_smithy_b', x + R * .45, y - R * .25, R * .7, true));
      put(y + R * .55, () => P(ctx, 'clut_haystack', x + R * .45, y + R * .55, R * .4)); put(y + R * .6, () => P(ctx, 'clut_woodpile', x - R * .55, y + R * .6, R * .3)); }
    if (t === 'k') for (let i = 0; i < 3; i++) { const px = x + (rand() - .5) * R * 1.1, py = y + (rand() - .5) * R * .9; put(py, () => P(ctx, 'clut_boulder', px, py, R * (.22 + rand() * .15), rand() < .5)); }
    if (t === 'b') put(y + R * .3, () => P(ctx, 'ruin_arch_bridge_b', x, y + R * .3, R * 1.5));
    if (t === 'd' && CW.ARTI.frames.wx_ford_stones) { ctx.save(); CW.hexPath(ctx, x, y, R * .7); ctx.clip(); ctx.fillStyle = pat('water_3', 0, 0, 0, .3); ctx.globalAlpha = .8; ctx.fillRect(x - R, y - R, R * 2, R * 2); ctx.restore();   // batch 2 ford
      put(y + R * .15, () => P(ctx, 'wx_ford_stones', x, y + R * .15, R * 1.25, rand() < .5)); }
    else if (t === 'd') { ctx.fillStyle = 'rgba(225,210,170,.85)'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(x + i * 6, y + (i % 2) * 2, 2.6, 1.8, 0, 0, 7); ctx.fill(); } }
    if (t === 'x') { ctx.save(); ctx.translate(x, y); ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, rr = i % 2 ? R * .42 : R * .7; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
      ctx.strokeStyle = 'rgba(40,28,14,.55)'; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = pat('mud_2', 0, 0, 0, .3); ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = 'rgba(255,220,160,.3)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
    if (t === 'g' && rand() < .05) { const px = x + (rand() - .5) * R, py = y + (rand() - .5) * R; put(py, () => P(ctx, rand() < .5 ? 'clut_stump' : 'clut_boulder', px, py, R * .2)); } });
  // walls & fences on hex edges: 3/4-view sprites fitted to each edge
  M.edgeAt.forEach((types, k) => { const [c, r, d] = k.split(',').map(Number), [x, y] = CW.center(c, r), p = CW.corner(x, y, d), q = CW.corner(x, y, d + 1);
    for (const t of types) { if (t !== 'wall' && t !== 'fence') continue;
      const vert = Math.abs(p[0] - q[0]) < 2, slashUp = (q[1] - p[1]) * (q[0] - p[0]) < 0; // "/" edge vs "\" edge
      const F = CW.ARTI.frames;
      if (t === 'wall' && F.fsw_vert && F.fsw_diag) {                                        // batch 2: fieldstone cut to the edge angle
        if (vert) { const nm = rand() < .1 ? 'fsw_vert_gate' : 'fsw_vert', f = F[nm], h = Math.abs(q[1] - p[1]) * 1.18;
          put(Math.max(p[1], q[1]), () => P(ctx, nm, p[0], Math.max(p[1], q[1]) + 3, h * f[2] / f[3])); }
        else { const nm = ['fsw_diag', 'fsw_diag', 'fsw_diag_mossy', 'fsw_diag_broken'][rand() * 4 | 0], my = Math.max(p[1], q[1]), mx = (p[0] + q[0]) / 2;
          put(my, () => P(ctx, nm, mx, my + 3, Math.abs(q[0] - p[0]) * 1.2, slashUp)); }
        continue; }
      if (vert) { const n = 3; for (let i = 0; i < n; i++) { const f = (i + .9) / n, px = p[0] + (q[0] - p[0]) * f, py = p[1] + (q[1] - p[1]) * f;
          put(py, () => P(ctx, t === 'wall' ? 'wall_short' : 'fence_worm_short', px, py, R * .36, rand() < .5)); } }
      else { const my = Math.max(p[1], q[1]), mx = (p[0] + q[0]) / 2, nm = t === 'wall' ? (rand() < .25 ? 'wall_mossy' : 'wall_long') : (rand() < .5 ? 'fence_worm_a' : 'fence_worm_b');
        put(my, () => P(ctx, nm, mx, my + 2, Math.abs(q[0] - p[0]) * 1.12, !slashUp)); } } });
  // supply wagons
  M.supply.forEach(([c, r, s]) => { const [x, y] = CW.center(c, r); put(y + R * .5, () => { P(ctx, 'clut_wagon', x, y + R * .5, R * .6); ctx.fillStyle = s === 'US' ? '#2d4f8f' : '#8f2d2d'; ctx.fillRect(x - 3, y + R * .5 - R * .5, 6, 5); }); });
  sprites.sort((a, b) => a[0] - b[0]).forEach(s => s[1]());
  // labels
  ctx.textAlign = 'center'; ctx.font = "italic 13px 'Libre Baskerville',Georgia,serif"; ctx.lineWidth = 3;
  M.labels.forEach(([t, c, r, dy]) => { const [x, y] = CW.center(c, r); ctx.strokeStyle = 'rgba(245,232,200,.75)'; ctx.fillStyle = '#2b2116'; ctx.strokeText(t, x, y + dy * R); ctx.fillText(t, x, y + dy * R); });
};

// crop fields: connected 'c' hexes form one field; fields alternate wheat / corn (stable per map)
CW.cropKind = function (M) { if (M._crop) return M._crop; const K = new Map(); let n = 0;
  M.all.forEach(([c, r]) => { if (M.ter(c, r) !== 'c' || K.has(c + ',' + r)) return; const kind = n++ % 3 === 1 ? 'corn' : 'wheat', st = [[c, r]]; K.set(c + ',' + r, kind);
    while (st.length) { const [a, b] = st.pop(); for (let d = 0; d < 6; d++) { const [x, y] = CW.step(a, b, d); if (M.in(x, y) && M.ter(x, y) === 'c' && !K.has(x + ',' + y)) { K.set(x + ',' + y, kind); st.push([x, y]); } } } });
  return (M._crop = K); };
