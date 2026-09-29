'use strict';
// Line of sight over a height profile + movement search (Dijkstra over hex × facing).
CW.EYE = u => u && CW.isMounted(u) ? .45 : .3;
// is the line between hex a (eye ea above ground) and hex b (target height eb) clear?
CW.los = function (M, a, b, ea = .3, eb = .3) {
  const L = CW.line(a, b), n = L.length - 1; if (n <= 1) return true;
  const ha = M.h(...a) + ea, hb = M.h(...b) + eb;
  let light = 0;
  for (let i = 1; i < n; i++) { const [c, r] = L[i], t = i / n, lh = ha + (hb - ha) * t, g = M.h(c, r);
    if (g > Math.max(M.h(...a), M.h(...b)) && g > lh + 1e-3) return false; // only true crests (higher than both ends) hide ground
    const ob = CW.obsAt(M, c, r); if (ob && g + ob > lh + 1e-3) { if (CW.lightAt(M, c, r) && ++light < 2) continue; return false; } }
  return true;
};
CW.sightRange = (M, u, tgt, weather) => { const W = CW.WEATHER[weather] || {}; let s = CW.TYPES[u.type].sight + (W.sight || 0);
  s += Math.max(0, Math.min(2, M.h(u.c, u.r) - M.h(...tgt))); if (W.cap) s = Math.min(s, W.cap); return s; };
CW.sees = function (M, u, tgt, weather) {
  const d = CW.dist([u.c, u.r], tgt); if (d > CW.sightRange(M, u, tgt, weather)) return false;
  if (d > 1 && M.sunkenSet.has(CW.key(...tgt)) && M.h(u.c, u.r) <= M.h(...tgt)) return false; // sunken road hides
  return CW.los(M, [u.c, u.r], tgt, CW.EYE(u), .3);
};
// set of enemy unit ids that `side` can see
CW.visibleEnemies = function (M, units, side, weather) {
  const mine = units.filter(u => u.side === side && !u.gone), vis = new Set();
  for (const e of units) if (e.side !== side && !e.gone && mine.some(u => CW.sees(M, u, [e.c, e.r], weather))) vis.add(e.id);
  return vis;
};
// all hexes visible from a point (for the LOS tool)
CW.viewshed = function (M, from, range = 12, eye = .3) {
  const out = new Set(); for (const h of M.all) if (CW.dist(from, h) <= range && CW.los(M, from, h, eye, .3)) out.add(CW.key(...h)); return out;
};

// ---------- movement ----------
CW.unitsAt = (units, c, r) => units.filter(u => !u.gone && u.c === c && u.r === r);
CW.bodiesAt = (units, c, r) => CW.unitsAt(units, c, r).filter(u => u.type !== 'ldr'); // leaders don't take up space
CW.canStack = (a, b) => a.side === b.side && ((a.type === 'art') !== (b.type === 'art')); // max 2, exactly one artillery
CW.reach = function (M, u, units, weather) {
  if (!CW.canMove(u)) { const b = new Map(); b.path = () => []; return b; }
  const mp = u.mp, turnCost = CW.isColumn(u) ? 0 : 1, zoc = new Set();
  units.filter(e => e.side !== u.side && !e.gone && CW.exertsZOC(e) && u.type !== 'ldr').forEach(e => CW.zocHexes(M, e).forEach(([c, r]) => zoc.add(CW.key(c, r))));
  const sk = (c, r, f) => c + ',' + r + ',' + f, dist = new Map(), prev = new Map(), best = new Map();
  const start = sk(u.c, u.r, u.face); dist.set(start, 0); const q = [[0, u.c, u.r, u.face]];
  while (q.length) {
    let bi = 0; for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i; const [g, c, r, f] = q.splice(bi, 1)[0];
    if (g > (dist.get(sk(c, r, f)) ?? 1e9)) continue;
    const hk = CW.key(c, r), isStart = c === u.c && r === u.r;
    if (!isStart) { const occ = CW.bodiesAt(units, c, r); const ok = u.type === 'ldr' ? !occ.some(o => o.side !== u.side) : !occ.length || (occ.length === 1 && CW.canStack(occ[0], u));
      if (ok && (!best.has(hk) || g < best.get(hk).cost)) best.set(hk, { cost: g, face: f, sk: sk(c, r, f) }); }
    if (!isStart && zoc.has(hk)) continue; // entering enemy ZOC ends movement
    const here = CW.bodiesAt(units, c, r); if (!isStart && here.length > 1 && u.type !== 'ldr') continue; // cannot pass through a stacked hex
    for (const [a, b, d] of M.nbrs(c, r)) {
      const occ = CW.bodiesAt(units, a, b); if (occ.some(o => o.side !== u.side)) continue;
      const nc = g + CW.rotDist(f, d) * turnCost + CW.stepCost(M, u, [c, r], [a, b], d, weather);
      if (nc > mp + 1e-9) continue; const k = sk(a, b, d);
      if (nc < (dist.get(k) ?? 1e9)) { dist.set(k, nc); prev.set(k, sk(c, r, f)); q.push([nc, a, b, d]); }
    }
  }
  best.path = hk => { const e = best.get(hk); if (!e) return []; const out = []; let k = e.sk; while (k) { const [c, r] = k.split(',').map(Number); out.unshift([c, r]); k = prev.get(k); } return out; };
  return best;
};
