'use strict';
// World paint (17 Oct 2026, "painted diorama" reboot). ONE colour map for the whole battlefield, generated from the map file at load:
// pasture patchwork, farm-shaped crop fields in strips (wheat, oats, stubble, hay, corn), woods floor, yards, roads, creek banks, swamp.
// It is the single source of ground colour at every zoom: the ground shader shows it (plus fine detail grain), and the 3D grass blades and
// crop stalks copy their colour from it, so zooming changes the amount of detail, never the colour (the cause of the old "pop").
// Also here: farm-shaped field outlines (hex zig-zags straightened; visual only, rules still use the hexes) and the fence lines that follow them.
// Outputs (cached per map): paint (canvas, sRGB colour), data (canvas: R crop stalk height class, G grass density, B woods 255 / cereal sheen ~100),
// fields [{kind, loops, ang, cx, cy}], crops {wheat: [x,y,...], corn: [...]} (map px), fenceSegs [{p, q, k}].
CW.WorldPaint = (function () {
  const PAL = {
    meadow: [100, 109, 50], pasture: [[110, 124, 55], [96, 102, 48], [132, 128, 68], [121, 131, 73], [82, 96, 44], [116, 114, 58], [104, 118, 60]],
    wheat: [[206, 170, 70], [216, 186, 96], [196, 156, 64]], stubble: [188, 158, 100], oats: [190, 176, 104], hay: [130, 138, 70],
    corn: [[64, 92, 37], [78, 106, 43]], cornYoung: [100, 122, 55], orchard: [112, 124, 62], woods: [54, 60, 32], woodsB: [74, 63, 40],
    yard: [124, 103, 70], road: [168, 136, 94], rut: [118, 92, 60], bank: [60, 74, 39], mud: [102, 86, 60], swamp: [70, 84, 52], swampW: [72, 88, 78] };
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const jit = (c, rand, s = 10) => c.map(v => v + (rand() - .5) * s);

  // ---------- farm-shaped outline of a set of hexes ('c,r' keys): boundary hex edges chained into loops, then straightened ----------
  function outline(M, set) {
    const E = new Map(), key = p => Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2), edges = [];
    for (const k of set) { const [c, r] = k.split(',').map(Number), [x, y] = CW.center(c, r);
      for (let d = 0; d < 6; d++) { const p = CW.corner(x, y, d), q = CW.corner(x, y, d + 1), o = CW.pixelToHex(M, p[0] + q[0] - x, p[1] + q[1] - y);
        if (o && set.has(o[0] + ',' + o[1])) continue; const e = { p, q, c, r, d, used: false }; edges.push(e); const kp = key(p); (E.get(kp) || E.set(kp, []).get(kp)).push(e); } }
    const loops = [];
    for (const e0 of edges) { if (e0.used) continue; const L = []; let e = e0;
      while (e && !e.used) { e.used = true; L.push(e.p); const nx = (E.get(key(e.q)) || []).find(f => !f.used); e = nx; }
      if (L.length > 2) loops.push(L); }
    return { loops: loops.map(straighten), edges };
  }
  function straighten(L) {
    const n = L.length; let P = L.map((p, i) => { const q = L[(i + 1) % n]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });   // edge midpoints: cut the zig-zag corners
    for (let it = 0; it < 5; it++) P = P.map((p, i) => { const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length]; return [p[0] * .5 + (a[0] + b[0]) * .25, p[1] * .5 + (a[1] + b[1]) * .25]; });
    P = simplify(P, 9);
    const out = []; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length];   // round the corners a little (one Chaikin pass)
      out.push([p[0] * .8 + q[0] * .2, p[1] * .8 + q[1] * .2], [p[0] * .2 + q[0] * .8, p[1] * .2 + q[1] * .8]); }
    return out;
  }
  function simplify(P, tol) {   // Douglas-Peucker on a closed loop (split at the two farthest points)
    if (P.length < 5) return P; let a = 0, b = 0, best = -1;
    for (let i = 0; i < P.length; i++) { const d = (P[i][0] - P[0][0]) ** 2 + (P[i][1] - P[0][1]) ** 2; if (d > best) { best = d; b = i; } }
    const dp = pts => { if (pts.length < 3) return pts; const [s, e] = [pts[0], pts[pts.length - 1]], L = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1; let m = 0, mi = 0;
      for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((e[0] - s[0]) * (s[1] - pts[i][1]) - (s[0] - pts[i][0]) * (e[1] - s[1])) / L; if (d > m) { m = d; mi = i; } }
      if (m <= tol) return [s, e]; const l = dp(pts.slice(0, mi + 1)), r = dp(pts.slice(mi)); return l.slice(0, -1).concat(r); };
    const A = dp(P.slice(a, b + 1)), B = dp(P.slice(b).concat([P[0]])); return A.slice(0, -1).concat(B.slice(0, -1));
  }
  const pathOf = (x, loops) => { x.beginPath(); for (const L of loops) { L.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); } };
  const inside = (loops, x, y) => { let k = false; for (const L of loops) for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
    const a = L[i], b = L[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
  // flood connected hexes of one kind
  function groups(M, test) { const seen = new Set(), out = [];
    for (const [c, r] of M.all) { const k0 = c + ',' + r; if (seen.has(k0) || !test(c, r)) continue; const g = new Set([k0]), st = [[c, r]]; seen.add(k0);
      while (st.length) { const [x, y] = st.pop(); for (const [u, v] of M.nbrs(x, y)) { const k = u + ',' + v; if (M.in(u, v) && !seen.has(k) && test(u, v)) { seen.add(k); g.add(k); st.push([u, v]); } } }
      out.push(g); } return out; }

  function noise(w, h, seed) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), d = x.createImageData(w, h), rand = CW.rng(seed);
    for (let i = 0; i < w * h; i++) { const v = rand() * 255 | 0; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; } x.putImageData(d, 0, 0); return c; }

  function build(M) {
    if (M._paint) return M._paint;
    const [MW, MH] = CW.mapSize(M), R = CW.R, K = Math.min(1.6, 4096 / MW, 4096 / MH), DK = .5, rand = CW.rng(18630701);
    const pc = document.createElement('canvas'); pc.width = Math.ceil(MW * K); pc.height = Math.ceil(MH * K); const x = pc.getContext('2d');
    const dc = document.createElement('canvas'); dc.width = Math.ceil(MW * DK); dc.height = Math.ceil(MH * DK); const y = dc.getContext('2d');
    x.scale(K, K); y.scale(DK, DK); x.imageSmoothingQuality = 'high';
    const both = fn => { fn(x, false); fn(y, true); };
    const T = (c, r) => M.in(c, r) ? M.ter(c, r) : 'g', Kc = CW.cropKind ? CW.cropKind(M) : new Map();
    // 1. base meadow + large soft light/dark drift (three octaves of smooth noise, soft-light)
    x.fillStyle = rgb(PAL.meadow); x.fillRect(-50, -50, MW + 100, MH + 100); y.fillStyle = 'rgb(0,255,0)'; y.fillRect(-50, -50, MW + 100, MH + 100);
    x.save(); x.globalCompositeOperation = 'soft-light';
    [[18, 11, .55], [46, 27, .35], [130, 76, .22]].forEach(([w, h, a], i) => { x.globalAlpha = a; x.drawImage(noise(w, h, 31 + i), -60, -60, MW + 120, MH + 120); });
    x.restore();
    // 2. pasture patchwork: parcels on a jittered, slightly rotated grid (enclosed fields of different grass), faint hedge lines between some
    const a0 = .06 + (rand() - .5) * .1, cs = Math.cos(a0), sn = Math.sin(a0), S = 150, nI = Math.ceil(MW / S) + 4, nJ = Math.ceil(MH / S) + 4, G = [];
    for (let j = 0; j <= nJ; j++) { G[j] = []; for (let i = 0; i <= nI; i++) { const u = (i - 2) * S * (1 + (rand() - .5) * .0) + (rand() - .5) * S * .45, v = (j - 2) * S * .78 + (rand() - .5) * S * .35;
      G[j][i] = [u * cs - v * sn, u * sn + v * cs]; } }
    const hedges = [];
    for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) { const q = [G[j][i], G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]], col = jit(PAL.pasture[Math.floor(rand() * PAL.pasture.length)], rand, 8);
      x.beginPath(); q.forEach((p, k) => k ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.fillStyle = rgb(col, .36 + rand() * .2); x.fill();
      if (rand() < .3) { x.save(); x.clip(); x.translate(...q[0]); x.rotate(a0 + (rand() < .5 ? 0 : 1.5708)); x.strokeStyle = rgb([150, 150, 90], .06); x.lineWidth = 6;   // mown stripes
        for (let s = -S * 2; s < S * 2; s += 14) { x.beginPath(); x.moveTo(-S * 2, s); x.lineTo(S * 2, s); x.stroke(); } x.restore(); }
      if (rand() < .55) hedges.push([q[0], q[1]]); if (rand() < .45) hedges.push([q[1], q[2]]); }
    x.save(); x.lineCap = 'round'; x.strokeStyle = rgb([58, 68, 30], .32); x.lineWidth = 2.2; hedges.forEach(([p, q]) => { x.beginPath(); x.moveTo(...p); x.lineTo(...q); x.stroke(); }); x.restore();
    // 3. knolls a touch drier; swamp; farm and town yards (soft trodden earth), fort ground
    for (const [c, r] of M.all) { const t = T(c, r), [cx, cy] = CW.center(c, r);
      const blob = (ctx, col, rad, a) => { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, rgb(col, a)); g.addColorStop(1, rgb(col, 0)); ctx.fillStyle = g; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); };
      if (t === 'k') blob(x, [140, 134, 74], R * 1.3, .45);
      if (t === 'h' || t === 't' || t === 'x') { blob(x, PAL.yard, R * (t === 't' ? 1.05 : .8), .75); blob(y, [0, 70, 0], R * .9, 1); }
      if (t === 's') { blob(x, PAL.swamp, R * 1.2, .9); for (let i = 0; i < 6; i++) { const px = cx + (rand() - .5) * R * 1.4, py = cy + (rand() - .5) * R * 1.2, rr = 4 + rand() * 9;
        x.fillStyle = rgb(PAL.swampW, .5); x.beginPath(); x.ellipse(px, py, rr * 1.6, rr, rand() * 3, 0, 7); x.fill(); } } }
    // 4. woods floor: soft-edged dark loam under the forests (trees stand on it), mottled
    const woods = groups(M, (c, r) => T(c, r) === 'f');
    for (const g of woods) { const O = outline(M, g);
      both((ctx, data) => { ctx.save(); ctx.filter = data ? 'none' : `blur(${8 * K}px)`; pathOf(ctx, O.loops); ctx.fillStyle = data ? 'rgb(0,64,255)' : rgb(PAL.woods, .95); ctx.fill('evenodd'); ctx.restore(); });
      x.save(); pathOf(x, O.loops); x.clip('evenodd'); x.globalCompositeOperation = 'soft-light'; x.globalAlpha = .5; x.drawImage(noise(90, 52, 77), 0, 0, MW, MH);
      x.globalCompositeOperation = 'source-over'; for (let i = 0; i < 40; i++) { const px = rand() * MW, py = rand() * MH; x.fillStyle = rgb(PAL.woodsB, .25); x.beginPath(); x.arc(px, py, 6 + rand() * 18, 0, 7); x.fill(); } x.restore(); }
    // 5. crop fields: farm-shaped outline, strips of different crops along one row direction, rows painted in
    const fields = [], crops = { wheat: [], corn: [] };
    const fieldSets = groups(M, (c, r) => T(c, r) === 'c').map(g => ({ g, kind: Kc.get([...g][0]) === 'corn' ? 'corn' : 'wheat' }))
      .concat(groups(M, (c, r) => T(c, r) === 'o').map(g => ({ g, kind: 'orchard' })));
    for (const { g, kind } of fieldSets) {
      const O = outline(M, g), fr = CW.rng([...g].sort()[0].split(',').reduce((a, v) => a * 131 + +v, 7)), ang = fr() * Math.PI;
      let cx = 0, cy = 0; [...g].forEach(k => { const [c, r] = k.split(',').map(Number), p = CW.center(c, r); cx += p[0]; cy += p[1]; }); cx /= g.size; cy /= g.size;
      let ext = 0; O.loops.forEach(L => L.forEach(p => { ext = Math.max(ext, Math.hypot(p[0] - cx, p[1] - cy)); })); ext += 10;
      // strips across the rows: [from, to, kind] in field-local v
      const strips = []; for (let v = -ext; v < ext;) { const w = 34 + fr() * 70, q = fr();
        const sk = kind === 'corn' ? (q < .82 ? 'corn' : 'cornYoung') : kind === 'orchard' ? 'orchard' : (q < .72 ? 'wheat' : q < .86 ? 'oats' : 'stubble');
        strips.push([v, v + w, sk, fr()]); v += w; }
      const stripAt = v => strips.find(s => v >= s[0] && v < s[1]) || strips[strips.length - 1];
      const ca = Math.cos(ang), sa = Math.sin(ang);
      // headland: a lighter grass margin just outside the field edge
      x.save(); pathOf(x, O.loops); x.strokeStyle = rgb([122, 128, 66], .55); x.lineWidth = 9; x.lineJoin = 'round'; x.stroke(); x.restore();
      both((ctx, data) => { ctx.save(); pathOf(ctx, O.loops); ctx.clip('evenodd'); ctx.translate(cx, cy); ctx.rotate(ang);
        for (const [v0, v1, sk, sr] of strips) { const base = sk === 'wheat' ? PAL.wheat[Math.floor(sr * 3)] : sk === 'corn' ? PAL.corn[Math.floor(sr * 2)] : PAL[sk];
          if (data) { const R0 = { wheat: 150, oats: 125, corn: 255, cornYoung: 0, stubble: 0, hay: 0, orchard: 0 }[sk], B0 = { wheat: 100, oats: 100, stubble: 60 }[sk] || 0;
            ctx.fillStyle = `rgb(${R0},${sk === 'hay' || sk === 'orchard' || sk === 'cornYoung' ? 150 : 0},${B0})`; ctx.fillRect(-ext, v0, ext * 2, v1 - v0); continue; }
          ctx.fillStyle = rgb(jit(base, fr, 10)); ctx.fillRect(-ext, v0, ext * 2, v1 - v0);
          const step = sk === 'corn' || sk === 'cornYoung' ? 4.6 : sk === 'orchard' ? 999 : sk === 'hay' ? 7 : 2.9;
          ctx.strokeStyle = rgb(base.map(c => c * .62), sk === 'stubble' ? .28 : .22); ctx.lineWidth = sk === 'corn' ? 1.6 : .9;
          for (let v = v0 + step / 2; v < v1; v += step) { ctx.beginPath(); ctx.moveTo(-ext, v); ctx.lineTo(ext, v); ctx.stroke(); }
          if (sk === 'stubble') { ctx.fillStyle = rgb([150, 112, 66], .5); for (let i = 0; i < 6; i++) { const u = (fr() - .5) * ext * 1.6, v = v0 + fr() * (v1 - v0); ctx.fillRect(u, v, 5, 3.5); } } }   // a few sheaves
        ctx.restore(); });
      x.save(); pathOf(x, O.loops); x.clip('evenodd'); x.globalCompositeOperation = 'soft-light'; x.globalAlpha = .45; x.drawImage(noise(60, 34, 99 + fields.length), 0, 0, MW, MH); x.restore();
      x.save(); pathOf(x, O.loops); x.strokeStyle = rgb([70, 64, 36], .35); x.lineWidth = 1.6; x.stroke(); x.restore();
      fields.push({ kind, loops: O.loops, edges: O.edges, ang, cx, cy, g });
      // 3D stalk positions: rows along the field direction, kept inside the outline, by strip kind
      if (kind !== 'orchard') for (let v = -ext; v < ext;) { const s = stripAt(v), sk = s[2], RS = sk === 'corn' ? 4.6 : 2.9, AS = sk === 'corn' ? 3.4 : 2.6, mid = v + RS / 2;
        if (sk === 'wheat' || sk === 'oats' || sk === 'corn') for (let u = -ext; u < ext; u += AS) { const uu = u + (fr() - .5) * AS * .5, px = cx + ca * uu - sa * mid, py = cy + sa * uu + ca * mid;
          if (inside(O.loops, px, py)) (sk === 'corn' ? crops.corn : crops.wheat).push(px, py); }
        v += RS; }
    }
    // 6. roads: soft ochre dirt with darker wheel ruts (the 3D road ribbons sit on top; this keeps the far view and the edges consistent)
    const roads = (M.roads || []).map(rd => ({ major: rd.major, pts: rd.p.map(p => CW.center(...p)) }));
    both((ctx, data) => { ctx.save(); ctx.lineCap = ctx.lineJoin = 'round';
      for (const rd of roads) { CW.smoothPath(ctx, rd.pts); ctx.strokeStyle = data ? 'rgb(0,0,0)' : rgb(PAL.road, .9); ctx.lineWidth = rd.major ? 15 : 11; ctx.stroke();
        if (!data) { ctx.strokeStyle = rgb([92, 98, 46], .35); ctx.lineWidth = rd.major ? 21 : 16; ctx.globalCompositeOperation = 'destination-over'; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; } }
      ctx.restore(); });
    // 7. creek banks: damp dark grass then mud at the water's edge (the 3D water sits on top)
    let Wd = null; try { Wd = CW.WorldWater ? CW.WorldWater.fromMap(M) : null; } catch (e) { Wd = null; }
    if (Wd) both((ctx, data) => { ctx.save(); ctx.lineCap = ctx.lineJoin = 'round';
      const st = (l, w, col) => { if (!l || l.length < 2) return; CW.smoothPath(ctx, l); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
      if (!data) { ctx.filter = `blur(${5 * K}px)`; (Wd.rivers || []).forEach(l => st(l, Wd.rw * 2.4, rgb(PAL.bank, .8))); (Wd.streams || []).forEach(l => st(l, 26, rgb(PAL.bank, .7))); ctx.filter = 'none';
        (Wd.rivers || []).forEach(l => st(l, Wd.rw * 1.3, rgb(PAL.mud, .9))); (Wd.streams || []).forEach(l => st(l, 10, rgb(PAL.mud, .85))); }
      else { (Wd.rivers || []).forEach(l => st(l, Wd.rw * 1.1, 'rgb(0,0,0)')); (Wd.streams || []).forEach(l => st(l, 7, 'rgb(0,0,0)')); }
      ctx.restore(); });
    // 8. fine grain over everything (reads at mid zoom; the shader adds finer grain up close)
    x.save(); x.globalCompositeOperation = 'soft-light'; x.globalAlpha = .3; x.imageSmoothingEnabled = false; x.drawImage(noise(Math.ceil(MW / 3), Math.ceil(MH / 3), 5), 0, 0, MW, MH); x.restore();
    // fences: a field whose hex boundary is mostly fenced gets ONE fence along its farm-shaped outline (gaps where roads cross); other fence edges stay on their hex edge
    const fenced = (e) => { const t = M.edgeAt && M.edgeAt.get(e.c + ',' + e.r + ',' + e.d); if (t && t.has('fence')) return true;
      const [x0, y0] = CW.center(e.c, e.r), o = CW.pixelToHex(M, e.p[0] + e.q[0] - x0, e.p[1] + e.q[1] - y0); if (!o) return false; const t2 = M.edgeAt && M.edgeAt.get(o[0] + ',' + o[1] + ',' + ((e.d + 3) % 6)); return !!(t2 && t2.has('fence')); };
    const used = new Set(), fenceSegs = [], nearRoad = (px, py) => roads.some(rd => rd.pts.some((p, i) => { const q = rd.pts[i + 1]; if (!q) return false;
      const dx = q[0] - p[0], dy = q[1] - p[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - p[0]) * dx + (py - p[1]) * dy) / L2)); return Math.hypot(p[0] + dx * t - px, p[1] + dy * t - py) < 13; }));
    for (const f of fields) { const fe = f.edges.filter(fenced); if (fe.length < f.edges.length * .5) continue;
      fe.forEach(e => { used.add(e.c + ',' + e.r + ',' + e.d); const [x0, y0] = CW.center(e.c, e.r), o = CW.pixelToHex(M, e.p[0] + e.q[0] - x0, e.p[1] + e.q[1] - y0); if (o) used.add(o[0] + ',' + o[1] + ',' + ((e.d + 3) % 6)); });
      f.loops.forEach(L => { for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length], n = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 40));
        for (let k = 0; k < n; k++) { const a = [p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n], b = [p[0] + (q[0] - p[0]) * (k + 1) / n, p[1] + (q[1] - p[1]) * (k + 1) / n];
          if (!nearRoad((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) fenceSegs.push({ p: a, q: b, k: Math.round(a[0] * 7 + a[1] * 131) }); } } }); }
    M.edgeAt && M.edgeAt.forEach((types, k) => { if (!types.has('fence') || used.has(k)) return; const [c, r, d] = k.split(',').map(Number), [x0, y0] = CW.center(c, r);
      fenceSegs.push({ p: CW.corner(x0, y0, d), q: CW.corner(x0, y0, d + 1), k: c * 7919 + r * 104729 + d * 31 }); });
    M._paint = { paint: pc, data: dc, fields, crops, fenceSegs, K, DK }; CW.WorldPaint.last = M._paint;
    return M._paint;
  }
  return { build, fenceSegs: M => build(M).fenceSegs, PAL };
})();
