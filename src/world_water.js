'use strict';
// WORLD pass T6: water geometry as a pure function of the map file (no painted pass, no coordinates, no Millbrook hexes).
//   rivers : every connected group of river/bridge/ford hexes (letters w, b, d) becomes a centre line walked hex to hex.
//            A line that ends on the map border is carried off the map so the river never stops in view.
//   streams: every chain of 'stream' hex edges becomes a meandering centre line; the end that lies nearer a river is run on
//            into that river (the mouth, listed LAST); the other end is the spring.
// Result: { river (the longest line, for the wake field), rivers: [...], rw (river width px), streams: [...] }, all in map px.
CW.WorldWater = (function () {
  const WET = 'wbd';

  function rivers(M) {
    const R = CW.R, wet = M.all.filter(([c, r]) => WET.includes(M.ter(c, r))), key = (c, r) => c + ',' + r, left = new Map(wet.map(h => [key(...h), h])), out = [];
    const adj = h => M.nbrs(h[0], h[1]).filter(([a, b]) => left.has(key(a, b)) || WET.includes(M.ter(a, b))).map(([a, b]) => [a, b]);
    const seen = new Set();
    for (const start0 of wet) { if (seen.has(key(...start0))) continue;
      // component by flood fill, then start the walk at an end hex (one wet neighbour) or, for a loop, the top hex
      const comp = [], stack = [start0]; seen.add(key(...start0));
      while (stack.length) { const h = stack.pop(); comp.push(h); for (const n of adj(h)) if (!seen.has(key(...n))) { seen.add(key(...n)); stack.push(n); } }
      const cset = new Set(comp.map(h => key(...h))), deg = h => adj(h).filter(n => cset.has(key(...n))).length;
      const ends = comp.filter(h => deg(h) <= 1).sort((p, q) => CW.center(...p)[1] - CW.center(...q)[1]);
      const visited = new Set(); let todo = comp.length, first = ends[0] || comp.slice().sort((p, q) => CW.center(...p)[1] - CW.center(...q)[1])[0];
      while (todo > 0) {   // greedy walk; a branch left over starts a new line from the hex it forks off
        let line = [], cur = first, from = null;
        if (visited.has(key(...cur))) { const rest = comp.find(h => !visited.has(key(...h))); if (!rest) break; const pre = adj(rest).find(n => visited.has(key(...n))); cur = rest; if (pre) line.push(pre); }
        while (cur) { visited.add(key(...cur)); todo--; line.push(cur);
          const nx = adj(cur).filter(n => cset.has(key(...n)) && !visited.has(key(...n))).sort((p, q) => CW.center(...p)[1] - CW.center(...q)[1] || CW.center(...p)[0] - CW.center(...q)[0]);
          cur = nx[0] || null; }
        const pts = line.map(h => CW.center(...h));
        if (pts.length > 1) { const pad = (p, q, edge) => { if (!edge) return null; const dx = p[0] - q[0], dy = p[1] - q[1], L = Math.hypot(dx, dy) || 1; return [p[0] + dx / L * R * 1.4, p[1] + dy / L * R * 1.4]; };
          const a = line[0], b = line[line.length - 1], onEdge = h => h[0] === 0 || h[1] === 0 || h[0] === M.cols - 1 || h[1] === M.rows - 1;
          const head = pad(pts[0], pts[1], onEdge(a)), tail = pad(pts[pts.length - 1], pts[pts.length - 2], onEdge(b)); if (head) pts.unshift(head); if (tail) pts.push(tail); out.push(pts); }
        first = line[line.length - 1]; }
    }
    return out.sort((p, q) => q.length - p.length);
  }

  function nearOn(polys, p) { let best = [0, 0, 1e9]; for (const poly of polys) for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1,
      t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)), x = a[0] + dx * t, y = a[1] + dy * t, d = Math.hypot(p[0] - x, p[1] - y); if (d < best[2]) best = [x, y, d]; } return best; }

  function streams(M, rv, rhw) {
    const R = CW.R, segs = [], rand = CW.rng(7771), out = [], key = v => Math.round(v[0]) + ',' + Math.round(v[1]);
    M.edgeAt.forEach((types, k) => { if (!types.has('stream')) return; const [c, r, d] = k.split(',').map(Number), [x, y] = CW.center(c, r), p = CW.corner(x, y, d), q = CW.corner(x, y, d + 1);
      if (!segs.some(s => (s.a === key(p) && s.b === key(q)) || (s.a === key(q) && s.b === key(p)))) segs.push({ a: key(p), b: key(q), m: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] }); });
    const used = new Set();
    for (let i = 0; i < segs.length; i++) { if (used.has(i)) continue; used.add(i); const chain = [segs[i]]; let grow = true;
      while (grow) { grow = false; for (let j = 0; j < segs.length; j++) { if (used.has(j)) continue; const s = segs[j], h = chain[0], t = chain[chain.length - 1];
          if ([t.a, t.b].includes(s.a) || [t.a, t.b].includes(s.b)) { chain.push(s); used.add(j); grow = true; } else if ([h.a, h.b].includes(s.a) || [h.a, h.b].includes(s.b)) { chain.unshift(s); used.add(j); grow = true; } } }
      let pts = chain.map(s => s.m); if (pts.length < 2) pts.unshift(CW.unkey(chain[0].a));
      const mp = []; for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;   // meander: slow wave + jitter
        for (let u = 0; u < 3; u++) { const f = u / 3, v = (k * 3 + u) * .38 + i, w = (Math.sin(v) * .6 + Math.sin(v * 2.3 + 1) * .3) * R * .22 + (rand() - .5) * R * .06; mp.push([a[0] + dx * f - dy / L * w, a[1] + dy * f + dx / L * w]); } }
      mp.push(pts[pts.length - 1]); pts = mp;
      if (rv.length) {   // the end nearer a river is the mouth; carry it on into the water so the brook never stops in open grass
        const d0 = nearOn(rv, pts[0]), d1 = nearOn(rv, pts[pts.length - 1]); if (d0[2] < d1[2]) pts = pts.slice().reverse();
        const last = pts[pts.length - 1], e = nearOn(rv, last);
        if (e[2] > 2 && e[2] < R * 3) { const n = Math.max(2, Math.ceil(e[2] / 12)), dx = e[0] - last[0], dy = e[1] - last[1], L = Math.hypot(dx, dy), stop = Math.max(0, e[2] - rhw * .15) / e[2];
          for (let k = 1; k <= n; k++) pts.push([last[0] + dx * stop * k / n + (dy / L) * Math.sin(k * 1.7) * 2, last[1] + dy * stop * k / n - (dx / L) * Math.sin(k * 1.7) * 2]); } }
      out.push(pts); }
    return out;
  }

  // Living world phase 1: each map mill stands on the bank of open river (clear of bridge and ford). Its wheel wall faces the viewer
  // (+map y); a short tailrace runs from under the wheel back into the river, so the wheel turns over real flowing water.
  // Result per mill: { x, y (mill centre, map px), yaw (model +X = wheel side), wx, wy (wheel side unit), race: [pts] spring -> mouth }
  function mills(M, rv, rw) {
    const R = CW.R, K = 2.4, out = [], keep = M.all.filter(([q, r]) => 'bd'.includes(M.ter(q, r))).map(h => CW.center(...h));
    for (const [c, r, kind] of (M.structures || [])) { if (kind !== 'mill' || !M.in(c, r)) continue;
      const [cx, cy] = CW.center(c, r); let best = null;
      for (const ln of rv) for (let i = 0; i < ln.length - 1; i++) { const p = ln[i], q = ln[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
        for (let k = 0; k <= 12; k++) { const x = p[0] + dx * k / 12, y = p[1] + dy * k / 12;
          if (keep.some(b => Math.hypot(b[0] - x, b[1] - y) < R * 1.85)) continue;
          const d = Math.hypot(x - cx, y - cy); if (!best || d < best.d) best = { d, x, y, tx: dx / L, ty: dy / L }; } }
      if (!best) continue;
      let { x: px, y: py, tx, ty } = best; let nx = cx - px, ny = cy - py; const dt = nx * tx + ny * ty; nx -= tx * dt; ny -= ty * dt;
      const nl = Math.hypot(nx, ny); if (nl < 1) { nx = -ty; ny = tx; } else { nx /= nl; ny /= nl; }       // n: from the river toward the land the mill stands on
      const sx = ty >= 0 ? tx : -tx, sy = ty >= 0 ? ty : -ty;                                               // wheel side: along the river, toward the viewer
      const half = rw * .52 * .84, D2 = 13 * K / 2, mx = px + nx * (half + D2 + 3), my = py + ny * (half + D2 + 3), off = 16;
      const race = []; const a0 = D2 + 9, a1 = -(half + 5);                                                  // from the land end of the mill to inside the river
      for (let k = 0; k <= 10; k++) { const a = a0 + (a1 - a0) * k / 10; race.push([mx + sx * off + nx * a, my + sy * off + ny * a]); }
      out.push({ x: mx, y: my, yaw: Math.atan2(-sy, sx), wx: sx, wy: sy, race }); }
    return out;
  }

  function fromMap(M) {
    const rv = rivers(M), rw = CW.R * .92, ml = mills(M, rv, rw);
    return { river: rv[0] || null, rivers: rv, rw, streams: streams(M, rv, rw * .5).concat(ml.map(m => m.race)), mills: ml };
  }
  return { fromMap, rivers, streams };
})();
