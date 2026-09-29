'use strict';
// Standing orders (docs/COMMAND_ORDERS.md). Commanders are the main way to play:
//  • select a brigade colonel or division general, then press on the map and DRAG a line
//    → the line is the new front, facing is away from the troops, length sets frontage.
//  • plain click = go there with the current frontage, facing the direction of travel.
//  • SIMPLIFIED (27 Sep): orders carry on automatically each turn; always halt on contact (a new drag presses on);
//    moving a battalion by hand detaches it, the next brigade order brings it back; column vs line is automatic.
//  • the order is stored on the colonel (so save/load/undo keep it) and carried out over turns:
//    the whole brigade advances the same fraction of its route each leg, so the shape holds and all arrive together.
(function () {
const O = CW.ORD = {}, R = () => CW.R, SLOT = () => CW.R * 1.5, ROW = () => CW.HW;
const G = () => CW.G, M = () => CW.M;
const DEG = Math.PI / 180, fvec = f => [Math.cos(f * 60 * DEG), Math.sin(f * 60 * DEG)];

// ---------- who takes part ----------
O.colonels = (units, L) => L.level === 'div' ? units.filter(x => x.level === 'bde' && x.div === L.div && x.side === L.side && !x.gone) : L.level === 'bde' ? [L] : [];
O.colonelOf = (units, u) => u.level === 'bde' ? u : u.bde ? units.find(l => l.level === 'bde' && l.bde === u.bde && l.side === u.side && !l.gone) : null;
O.members = (units, L) => units.filter(x => x.bde === L.bde && x.side === L.side && !x.gone && x.type !== 'ldr' && (!x.detached || O._rejoin) && !x.routed && CW.canMove(x));
O.detachedOf = (units, L) => units.filter(x => x.bde === L.bde && x.side === L.side && !x.gone && x.type !== 'ldr' && (x.detached || x.routed));

// ---------- fast pathfinding (same rules as CW.reach, binary heap, whole map) ----------
O.paths = function (Mp, u, units, weather, maxCost) {
  const turnCost = CW.isColumn(u) ? 0 : 1, zoc = new Set(), enemy = new Set(), occN = new Map();
  units.forEach(e => { if (e.gone) return; const k = CW.key(e.c, e.r); if (e.side !== u.side) { enemy.add(k); if (CW.exertsZOC(e) && u.type !== 'ldr') CW.zocHexes(Mp, e).forEach(h => zoc.add(CW.key(...h))); } else if (e.type !== 'ldr' && e !== u) occN.set(k, (occN.get(k) || 0) + 1); });
  const sk = (c, r, f) => (r * Mp.cols + c) * 6 + f, dist = new Float64Array(Mp.cols * Mp.rows * 6).fill(Infinity), prev = new Int32Array(dist.length).fill(-1), best = new Map();
  const heap = [], push = (g, s) => { heap.push([g, s]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } },
    pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const s0 = sk(u.c, u.r, u.face); dist[s0] = 0; push(0, s0);
  while (heap.length) {
    const [g, s] = pop(); if (g > dist[s]) continue; const f = s % 6, h = (s - f) / 6, c = h % Mp.cols, r = (h - c) / Mp.cols, hk = CW.key(c, r);
    if (!best.has(hk) || g < best.get(hk).cost) best.set(hk, { cost: g, s });
    if (!(c === u.c && r === u.r) && zoc.has(hk)) continue;
    for (const [a, b, d] of Mp.nbrs(c, r)) { const nk = CW.key(a, b); if (enemy.has(nk) || (occN.get(nk) || 0) > 1) continue;
      const nc = g + CW.rotDist(f, d) * turnCost + CW.stepCost(Mp, u, [c, r], [a, b], d, weather) + (occN.get(nk) ? 4 : 0); if (!(nc <= maxCost)) continue; // steer round friendly units
      const ns = sk(a, b, d); if (nc < dist[ns]) { dist[ns] = nc; prev[ns] = s; push(nc, ns); } } }
  best.path = hk => { const e = best.get(hk); if (!e) return []; const out = []; let s = e.s; while (s >= 0) { const h = (s - s % 6) / 6; out.unshift([h % Mp.cols, (h - h % Mp.cols) / Mp.cols]); s = prev[s]; } return out; };
  return best;
};
// step-by-step cost of walking a path (matches game.js walk())
O.pathCosts = (Mp, u, path, weather) => { const out = [0]; let f = u.face, t = 0; for (let i = 1; i < path.length; i++) { const d = CW.dirTo(path[i - 1], path[i]); t += CW.rotDist(f, d) * (CW.isColumn(u) ? 0 : 1) + CW.stepCost(Mp, u, path[i - 1], path[i], d, weather); f = d; out.push(t); } return out; };

// ---------- formation slots ----------
const passable = (Mp, h, u) => Mp.in(...h) && M().ter(...h) !== 'w' && !(u && u.type === 'art' && CW.TERRAIN[Mp.ter(...h)].noArt);
function snap(Mp, px, used, u) { const h0 = CW.pixelToHex(Mp, ...px) || CW.pixelToHex(Mp, Math.max(0, px[0]), Math.max(0, px[1]));
  const cands = h0 ? Mp.all.filter(h => CW.dist(h, h0) <= 2) : Mp.all;
  let best = null, bd = 1e9; for (const h of cands) { if (used.has(CW.key(...h)) || !passable(Mp, h, u)) continue; const c = CW.center(...h), d = (c[0] - px[0]) ** 2 + (c[1] - px[1]) ** 2; if (d < bd) { bd = d; best = h; } }
  return best; }
// order: {ax, ay (anchor px), face, front (slots in front row), tpl: 'line'|'column'}
O.slots = function (Mp, units, L, order, ms) {
  ms = ms || O.members(units, L); const n = ms.length, F = fvec(order.face), Lv = [-F[1], F[0]], P = [order.ax, order.ay], out = new Map(), used = new Set();
  units.forEach(x => { if (!x.gone && x.type !== 'ldr' && !ms.some(m => m.id === x.id)) used.add(CW.key(x.c, x.r)); });   // hexes held by other units
  units.forEach(c => { if (c !== L && c.level === 'bde' && c.side === L.side && !c.gone && c.order && c.order.fix) Object.values(c.order.fix).forEach(h => used.add(CW.key(...h))); }); // …or promised to another brigade
  const proj = (u, v) => { const c = CW.center(u.c, u.r); return (c[0] - P[0]) * v[0] + (c[1] - P[1]) * v[1]; };
  if (!n) return { slots: out, colonel: snap(Mp, P, new Set()) };
  if (order.tpl === 'column') { // head at the anchor, the rest trail back along the line of march
    const seq = [...ms].sort((a, b) => proj(b, F) - proj(a, F));
    seq.forEach((u, i) => { const h = snap(Mp, [P[0] - F[0] * ROW() * i, P[1] - F[1] * ROW() * i], used, u); if (h) { used.add(CW.key(...h)); out.set(u, h); } });
    return { slots: out, colonel: snap(Mp, [P[0] + Lv[0] * SLOT(), P[1] + Lv[1] * SLOT()], new Set()) }; }
  const front = Math.max(1, Math.min(n, order.front || n)), rows = [];
  // regiments stay together (their wings side by side)
  const regs = [...ms.reduce((m, u) => m.set(u.reg || u.id, [...(m.get(u.reg || u.id) || []), u]), new Map()).values()];
  regs.sort((a, b) => b.reduce((t, u) => t + proj(u, F), 0) / b.length - a.reduce((t, u) => t + proj(u, F), 0) / a.length);
  let cur = [], cap = front; for (const g of regs) { if (cur.length && cur.length + g.length > cap) { rows.push(cur); cur = []; } cur.push(...g); if (cur.length >= cap) { rows.push(cur); cur = []; } }
  if (cur.length) rows.push(cur);
  rows.forEach((row, ri) => { const byReg = [...row.reduce((m, u) => m.set(u.reg || u.id, [...(m.get(u.reg || u.id) || []), u]), new Map()).values()]
      .map(g => g.sort((a, b) => proj(a, Lv) - proj(b, Lv))).sort((a, b) => a.reduce((t, u) => t + proj(u, Lv), 0) / a.length - b.reduce((t, u) => t + proj(u, Lv), 0) / b.length).flat();
    const k = byReg.length, back = ri * ROW();
    byReg.forEach((u, i) => { const off = (i - (k - 1) / 2) * SLOT(), h = snap(Mp, [P[0] + Lv[0] * off - F[0] * back, P[1] + Lv[1] * off - F[1] * back], used, u); if (h) { used.add(CW.key(...h)); out.set(u, h); } }); });
  const cb = rows.length > 1 ? ROW() * .6 : ROW(); return { slots: out, colonel: snap(Mp, [P[0] - F[0] * cb, P[1] - F[1] * cb], new Set()) };
};

// ---------- planning a leg ----------
// trees: Map unit → paths(); returns per-unit {path, costs, stop (index)} with a common progress fraction t
O.trees = (ms, extraLeaders) => { const g = G(), Mp = M(), others = g.units.filter(x => !ms.includes(x)); const t = new Map();
  [...ms, ...(extraLeaders || [])].forEach(u => t.set(u, O.paths(Mp, u, others, g.weather, CW.maxMP(u) * 6 + 40))); return t; };
// slots are assigned once per order and kept, so battalions never swap targets between legs
O.fixedSlots = function (Mp, units, L, order, ms) {
  const ids = ms.map(u => u.id).sort().join(',');
  if (order.fix && order.fixIds === ids) { const sl = new Map(); ms.forEach(u => { const h = order.fix[u.id]; if (h) sl.set(u, h); }); return { slots: sl, colonel: order.fixCol }; }
  const S = O.slots(Mp, units, L, order, ms); order.fix = {}; S.slots.forEach((h, u) => { order.fix[u.id] = h; }); order.fixIds = ids; order.fixCol = S.colonel; return S; };
O.plan = function (L, order, trees, ms, keep) {
  const g = G(), Mp = M(); ms = ms || O.members(g.units, L); const S = keep ? O.fixedSlots(Mp, g.units, L, order, ms) : O.slots(Mp, g.units, L, order, ms), legs = new Map(); let t = 1;
  for (const [u, h] of S.slots) { const tr = trees.get(u); if (!tr) continue; let tgt = h, path = tr.path(CW.key(...h));
    if (!path.length) { let bd = 1e9; tr.forEach((v, k) => { const hx = CW.unkey(k), d = CW.dist(hx, h) * 100 + v.cost; if (d < bd) { bd = d; tgt = hx; } }); path = tr.path(CW.key(...tgt)); }
    const costs = O.pathCosts(Mp, u, path, g.weather), tot = costs[costs.length - 1] || 0; let can = 0; while (can + 1 < path.length && costs[can + 1] <= u.mp + 1e-6) can++;
    legs.set(u, { slot: h, tgt, path, costs, tot, steps: path.length - 1, can }); }
  // battalions that are spent this turn just wait; everyone else shares the pace of the slowest
  // line infantry sets the pace; skirmishers, guns and horse move at their own speed
  const pacer = u => u.type === 'inf' || ![...legs.keys()].some(x => x.type === 'inf');
  let N = 1; for (const [u, l] of legs) if (pacer(u) && l.steps > 0 && l.can > 0) N = Math.max(N, Math.ceil(l.steps / l.can));
  for (const [u, l] of legs) l.stop = pacer(u) ? Math.min(l.can, Math.ceil(l.steps / N)) : l.can;
  t = 1 / N;
  let est = 1; for (const [u, l] of legs) if (l.tot > 0) est = Math.max(est, Math.ceil(l.tot / Math.max(1, CW.maxMP(u))));
  return { slots: S.slots, colonel: S.colonel, legs, t, ms, est };
};

// ---------- building orders from a gesture ----------
const centroid = us => { const pts = us.map(u => CW.center(u.c, u.r)); return pts.length ? [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length] : [0, 0]; };
const toFace = v => ((Math.round(Math.atan2(v[1], v[0]) / DEG / 60) % 6) + 6) % 6;
// current frontage: how many battalions stand side by side across the direction of travel
const curFront = (ms0, face) => { const li = ms0.filter(u => u.type === 'inf' && u.form !== 'one'), ms = li.length ? li : ms0, F = fvec(face), Lv = [-F[1], F[0]], ps = ms.map(u => { const c = CW.center(u.c, u.r); return [c[0] * F[0] + c[1] * F[1], c[0] * Lv[0] + c[1] * Lv[1]]; });
  const maxF = Math.max(...ps.map(p => p[0])); return Math.max(1, ps.filter(p => maxF - p[0] < ROW() * .6).length); };
// gesture → one order per brigade.  a,b = drag start/end (world px); b null for a plain click
O.fromGesture = function (Lsel, a, b, column) {
  const g = G(), units = g.units, cols = O.colonels(units, Lsel).filter(c => O.members(units, c).length); if (!cols.length) return [];
  const all = cols.flatMap(c => O.members(units, c)), C = centroid(all), len = b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0;
  let mid = b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : a, face;
  column = false;
  if (b && len > R() * .8) { const n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len]; face = toFace(n); }   // drag top→bottom faces east, bottom→top faces west
  else face = toFace([mid[0] - C[0], mid[1] - C[1]]);
  const hx = CW.pixelToHex(M(), ...mid); if (hx) mid = CW.center(...hx);
  const stance = 'halt';
  if (column) return cols.map((c, i) => [c, { ax: mid[0] - fvec(face)[0] * ROW() * i * 4, ay: mid[1] - fvec(face)[1] * ROW() * i * 4, face, tpl: 'column', stance }]);
  const totalFront = b && len > R() * .8 ? Math.max(1, Math.round(len / SLOT()) + 1) : null;
  if (cols.length === 1) { const ms = O.members(units, cols[0]); return [[cols[0], { ax: mid[0], ay: mid[1], face, tpl: 'line', front: Math.min(ms.length, totalFront || (cols[0].order && cols[0].order.front) || cols[0].lastFront || ms.length), stance }]]; }
  // division: split the line into brigade sectors (front), the rest in support behind the centre
  const F = fvec(face), Lv = [-F[1], F[0]], nb = cols.length, nf = nb <= 2 ? nb : Math.ceil(nb / 2);
  const info = cols.map(c => { const ms = O.members(units, c), cc = centroid(ms); return { c, n: ms.length, fwd: cc[0] * F[0] + cc[1] * F[1], lat: cc[0] * Lv[0] + cc[1] * Lv[1] }; });
  const frontB = [...info].sort((x, y) => y.fwd - x.fwd).slice(0, nf).sort((x, y) => x.lat - y.lat), supB = info.filter(x => !frontB.includes(x)).sort((x, y) => x.lat - y.lat);
  const want = totalFront || frontB.reduce((t, x) => t + x.n, 0), share = frontB.map(x => Math.max(1, Math.round(want * x.n / frontB.reduce((t, y) => t + y.n, 0))));
  const W = share.reduce((t, s) => t + s, 0) * SLOT(); let off = -W / 2; const out = [];
  frontB.forEach((x, i) => { const w = share[i] * SLOT(), cOff = off + w / 2; off += w; out.push([x.c, { ax: mid[0] + Lv[0] * cOff, ay: mid[1] + Lv[1] * cOff, face, tpl: 'line', front: Math.min(x.n, share[i]), stance, role: 'front' }]); });
  const back = ROW() * 3, sw = supB.reduce((t, x) => t + x.n, 0) * SLOT(); off = -sw / 2;
  supB.forEach(x => { const w = x.n * SLOT(), cOff = off + w / 2; off += w; out.push([x.c, { ax: mid[0] + Lv[0] * cOff - F[0] * back, ay: mid[1] + Lv[1] * cOff - F[1] * back, face, tpl: 'line', front: x.n, stance, role: 'support' }]); });
  return out;
};

// ---------- carrying out a leg ----------
function setForm(u, want) { const f = CW.TYPES[u.type].forms; if (!f.includes(want) || u.form === want || CW.TERRAIN[M().ter(u.c, u.r)].noForm) return;
  const cost = CW.formCost(u); if (u.mp < cost) return; const old = CW.maxMP(u); u.form = want; u.mp = Math.floor((u.mp - cost) / old * CW.maxMP(u)); u.dug = 0; }
O.execLeg = function (L, pre) { // returns {moved, halted, arrived}
  const g = G(), Mp = M(), order = L.order; if (!order) return { moved: 0 };
  const ms = O.members(g.units, L);
  // column orders march; line orders approach in column and deploy into line on reaching their slot
  const S0 = O.fixedSlots(Mp, g.units, L, order, ms);
  ms.forEach(u => { if (u.acted || u._keepForm) return; const h = S0.slots.get(u), far = h && CW.dist([u.c, u.r], h) > 0;
    const want = order.tpl === 'column' || (far && (!order.block || !u._keepForm)) ? { inf: 'march', art: 'lim', eng: 'march' } : { inf: 'combat' }; if (want[u.type]) setForm(u, want[u.type]); });
  const trees = O.trees(ms, [L]), P = O.plan(L, order, trees, ms, true), F = fvec(order.face);
  const seq = [...P.legs].sort((x, y) => { const px = CW.center(...x[1].path[x[1].stop] || [x[0].c, x[0].r]), py = CW.center(...y[1].path[y[1].stop] || [y[0].c, y[0].r]); return (py[0] * F[0] + py[1] * F[1]) - (px[0] * F[0] + px[1] * F[1]); });
  let moved = 0, halted = false, arrived = 0;
  const keepGoing = !!order.block;   // a one-piece brigade finishes its move together even if someone spots the enemy
  for (let pass = 0; pass < 3 && (keepGoing || !halted); pass++) for (const [u, l] of seq) {
    if (l.done || (halted && !keepGoing)) continue; const at = l.path.findIndex(h => h[0] === u.c && h[1] === u.r); if (at < 0) continue;
    let i = l.stop; while (i > at) { const occ = CW.bodiesAt(g.units, ...l.path[i]).filter(o => o !== u); if (!occ.length || (occ.length === 1 && CW.canStack(occ[0], u))) break; i--; }
    if (i > at) { const sub = l.path.slice(at, i + 1); if (CW.walk(u, sub)) { halted = true; } moved++; }
    if (i === l.stop) l.done = true;
  }
  // dress the line: units on their slot face the ordered direction
  arrived = 0; for (const [u, l] of P.legs) if ((u.c === l.slot[0] && u.r === l.slot[1]) || (u.c === l.tgt[0] && u.r === l.tgt[1])) { u.face = order.face; arrived++; if (order.tpl !== 'column' && u.type === 'inf' && u.form === 'march') setForm(u, 'combat'); }
  // the colonel rides to his place behind the line
  // the colonel stays with his men: just behind the brigade while it moves, at his post once it has arrived
  const allIn = arrived === P.legs.size, cc = centroid(ms), behind = allIn ? P.colonel : CW.pixelToHex(Mp, cc[0] - F[0] * ROW(), cc[1] - F[1] * ROW()) || P.colonel;
  if (behind && (keepGoing || !halted)) { const tr = O.paths(Mp, L, g.units, g.weather, L.mp + 1), pth = tr && tr.path(CW.key(...behind)); if (pth && pth.length > 1) { const cs = O.pathCosts(Mp, L, pth, g.weather); let k = 0; while (k + 1 < pth.length && cs[k + 1] <= L.mp) k++; if (k) CW.walk(L, pth.slice(0, k + 1)); } L.face = order.face; }
  ms.forEach(u => { u.acted = 1; });
  order.done = arrived === P.legs.size && P.legs.size > 0; order.contact = halted && order.stance === 'halt';
  return { moved, halted, arrived, total: P.legs.size };
};

// ---------- player actions ----------
O.issue = function (Lsel, a, b, column) {
  const g = G(); O._rejoin = true; const pairs = O.fromGesture(Lsel, a, b, false), touched = pairs.flatMap(([c]) => [c, ...O.members(g.units, c)]); O._rejoin = false;
  if (!pairs.length) return CW.toast('No battalions to order here');
  CW.snapshot(touched.concat(g.units.filter(d => d.level === 'div' && d.side === g.side)));
  const back = touched.filter(u => u.detached); back.forEach(u => { u.detached = 0; });   // a new brigade order brings detached battalions back
  let halted = false, moved = 0;
  pairs.forEach(([c, o]) => { c.order = o; }); pairs.forEach(([c]) => O.fixedSlots(M(), g.units, c, c.order, O.members(g.units, c)));
  for (const [c, o] of pairs) { if (o.front) c.lastFront = o.front; if (halted) continue; const r = O.execLeg(c); moved += r.moved; if (r.halted) halted = true; }
  if (Lsel.level !== 'div') O.followGenerals();
  if (Lsel.level === 'div') { const cc = centroid(pairs.flatMap(([c]) => O.members(g.units, c))), o = pairs[0][1], F = fvec(o.face), tgt = CW.pixelToHex(M(), cc[0] - F[0] * ROW() * 1.5, cc[1] - F[1] * ROW() * 1.5);
    if (tgt) { const tr = O.paths(M(), Lsel, g.units, g.weather, Lsel.mp), p = tr.path(CW.key(...tgt)); if (p.length > 1) CW.walk(Lsel, p); } }
  if (halted) g.undo = [];
  const o = pairs[0][1], what = o.tpl === 'column' ? 'March column' : pairs.length > 1 ? `Division line (${pairs.filter(p => p[1].role !== 'support').length} up, ${pairs.filter(p => p[1].role === 'support').length} in support)` : `Line ${o.front} wide`;
  CW.toast(halted ? 'Enemy spotted — halting. Drag a new line to press on.' : `${what}${back.length ? ` · ${back.length} detached rejoin` : ''}${pairs.every(([c]) => c.order.done) ? ' · in position' : ' · carries on each turn'}`);
  CW.refreshVis(); CW.selectGroup(Lsel);
};
// division generals ride along behind their brigades so the chain of command holds
O.followGenerals = function () { const g = G(), Mp = M();
  g.units.filter(d => d.level === 'div' && d.side === g.side && !d.gone && d.mp > 0).forEach(D => { const cs = O.colonels(g.units, D); if (!cs.some(c => c.order)) return;
    const cc = centroid(cs), o = (cs.find(c => c.order) || {}).order, F = o ? fvec(o.face) : [0, 0], tgt = CW.pixelToHex(Mp, cc[0] - F[0] * ROW(), cc[1] - F[1] * ROW()); if (!tgt || CW.dist(tgt, [D.c, D.r]) < 2) return;
    const tr = O.paths(Mp, D, g.units, g.weather, D.mp + .01); let best = null, bd = 1e9; tr.forEach((v, k) => { const d = CW.dist(CW.unkey(k), tgt); if (d < bd) { bd = d; best = CW.unkey(k); } });
    if (best) { const pth = tr.path(CW.key(...best)); if (pth.length > 1) CW.walk(D, pth); } }); };
O.advanceAll = function () {
  const g = G(), cols = g.units.filter(l => l.level === 'bde' && l.side === g.side && !l.gone && l.order && !l.order.done);
  const go = cols.filter(c => !c.order.contact);
  if (!go.length) return;
  CW.snapshot(go.flatMap(c => [c, ...O.members(g.units, c)]).concat(g.units.filter(d => d.level === 'div' && d.side === g.side))); let halted = 0, moved = 0;
  for (const c of go) { const r = O.execLeg(c); moved += r.moved; if (r.halted) { halted++; break; } }
  O.followGenerals(); if (halted) g.undo = []; CW.refreshVis(); CW.draw();
  CW.toast(halted ? 'Enemy spotted — brigade halts. Drag a new line to press on.' : `Standing orders: ${go.length} brigade${go.length > 1 ? 's' : ''} advanced · ${go.filter(c => c.order.done).length} in position`);
  if (g.sel) (g.group ? CW.selectGroup(g.sel) : CW.select(g.sel));
};
O.pending = () => { const g = G(); return g.units.filter(l => l.level === 'bde' && l.side === g.side && !l.gone && l.order && !l.order.done && !l.order.contact).length; };
O.hold = function () { const g = G(), L = g.sel && (g.sel.level === 'div' ? g.sel : O.colonelOf(g.units, g.sel)); if (!L) return CW.toast('Select a commander');
  O.colonels(g.units, L).forEach(c => { c.order = null; }); CW.toast('Order cancelled — the brigade holds where it stands'); CW.selectGroup(g.sel); };

// ---------- drawing ----------
const ghost = (cx, h, col, solid) => { const [x, y] = CW.center(...h); CW.hexPath(cx, x, y, R() - 6);
  if (solid) { cx.fillStyle = col + '66'; cx.fill(); cx.setLineDash([]); cx.lineWidth = 3; cx.strokeStyle = 'rgba(20,12,6,.8)'; cx.stroke(); cx.lineWidth = 2; }
  else { cx.setLineDash([7, 5]); cx.lineWidth = 5; cx.strokeStyle = 'rgba(20,12,6,.7)'; cx.stroke(); cx.lineWidth = 2.4; cx.strokeStyle = '#fffbe8'; cx.stroke(); cx.setLineDash([]); return; }
  cx.strokeStyle = col; cx.stroke(); cx.setLineDash([]); };
const arrowTo = (cx, a, b, col) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 10) return; cx.strokeStyle = col; cx.lineWidth = 2; cx.setLineDash([2, 5]); cx.beginPath(); cx.moveTo(...a); cx.lineTo(...b); cx.stroke(); cx.setLineDash([]);
  const ux = dx / l, uy = dy / l; cx.fillStyle = col; cx.beginPath(); cx.moveTo(b[0], b[1]); cx.lineTo(b[0] - ux * 11 - uy * 6, b[1] - uy * 11 + ux * 6); cx.lineTo(b[0] - ux * 11 + uy * 6, b[1] - uy * 11 - ux * 6); cx.closePath(); cx.fill(); };
const faceTick = (cx, ax, ay, face, col) => { const F = fvec(face); arrowTo(cx, [ax, ay], [ax + F[0] * R() * .9, ay + F[1] * R() * .9], col); };
const bigArrow = (cx, x, y, face) => { const F = fvec(face), L = R() * 1.7, P = [-F[1], F[0]], tip = [x + F[0] * L, y + F[1] * L];
  cx.save(); cx.lineCap = 'round'; for (const [c, w] of [['rgba(20,12,6,.85)', 9], ['#fffbe8', 4.5]]) { cx.strokeStyle = c; cx.fillStyle = c; cx.lineWidth = w; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(tip[0] - F[0] * 10, tip[1] - F[1] * 10); cx.stroke();
    const s = w === 9 ? 15 : 11; cx.beginPath(); cx.moveTo(tip[0] + F[0] * (w === 9 ? 3 : 0), tip[1] + F[1] * (w === 9 ? 3 : 0)); cx.lineTo(tip[0] - F[0] * s * 1.3 + P[0] * s, tip[1] - F[1] * s * 1.3 + P[1] * s); cx.lineTo(tip[0] - F[0] * s * 1.3 - P[0] * s, tip[1] - F[1] * s * 1.3 - P[1] * s); cx.closePath(); cx.fill(); }
  cx.restore(); };
O.draw = function (cx, drag) {
  const g = G(), Mp = M(); if (!g.started) return;
  // standing orders: faint ghosts of final slots + arrow from the brigade to its objective
  const show = g.tool.cmd ? g.units.filter(l => l.level === 'bde' && l.side === g.side && !l.gone) : g.sel && g.sel.side === g.side ? O.colonels(g.units, g.sel.level === 'div' ? g.sel : O.colonelOf(g.units, g.sel) || g.sel) : [];
  if (!drag && !g.contact) for (const L of show) { if (!L.order || L.order.done) continue; const ms = O.members(g.units, L), S = O.fixedSlots(Mp, g.units, L, L.order, ms), col = L.color || '#f3e3a0';
    for (const [, h] of S.slots) ghost(cx, h, col, false); arrowTo(cx, centroid(ms), [L.order.ax, L.order.ay], col + 'cc'); faceTick(cx, L.order.ax, L.order.ay, L.order.face, col);
    if (L.order.contact) { cx.fillStyle = '#ffdf8a'; cx.font = '700 11px system-ui'; cx.textAlign = 'center'; cx.fillText('HALTED — contact', L.order.ax, L.order.ay - R()); } }
  // tethers for detached / routed battalions
  if (g.sel && g.sel.side === g.side) { const L = O.colonelOf(g.units, g.sel); if (L) O.detachedOf(g.units, L).forEach(u => { const a = CW.center(L.c, L.r), b = CW.center(u.c, u.r); cx.strokeStyle = 'rgba(255,240,200,.75)'; cx.lineWidth = 1.5; cx.setLineDash([3, 5]); cx.beginPath(); cx.moveTo(...a); cx.lineTo(...b); cx.stroke(); cx.setLineDash([]); }); }
  // hover preview: where a plain click would send the brigade (final places only)
  if (!drag && g.hover && g.group && g.sel && g.sel.side === g.side && g.sel.level === 'div' && !CW.unitsAt(g.units, ...g.hover).some(u => CW.shown(u))) {
    cx.globalAlpha = .6; for (const [c, o] of O.fromGesture(g.sel, CW.center(...g.hover), null, false)) { const S = O.slots(Mp, g.units, c, o, O.members(g.units, c)); for (const [, h] of S.slots) ghost(cx, h, '#fff4d0', false); } cx.globalAlpha = 1; }
  // live preview while dragging: solid = end of this turn, dashed = final place
  if (drag && drag.pairs) { if (drag.b) { cx.strokeStyle = 'rgba(255,236,170,.95)'; cx.lineWidth = 3; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(...drag.a); cx.lineTo(...drag.b); cx.stroke(); }
    for (const p of drag.pairs) { const [c, o] = p, col = c.color || '#f3e3a0', P = O.plan(c, o, drag.trees, p.ms); for (const [u, l] of P.legs) { ghost(cx, l.slot, col, false); const st = l.path[l.stop]; if (st && (st[0] !== u.c || st[1] !== u.r)) ghost(cx, st, col, true); }
      bigArrow(cx, o.ax, o.ay, o.face); if (drag.pairs.length > 1) { cx.fillStyle = col; cx.font = '700 10px system-ui'; cx.textAlign = 'center'; cx.fillText(`${c.tag} ${o.role === 'support' ? 'support' : ''}`, o.ax, o.ay + R() * .95); } }
    const o0 = drag.pairs[0][1], turns = Math.max(...drag.pairs.map(p => O.plan(p[0], p[1], drag.trees, p.ms).est));
    cx.font = '700 12px system-ui'; cx.textAlign = 'center'; const lbl = drag.block ? (drag.full ? 'Brigade moves here' : 'Out of reach — solid = where it stops') : `${drag.pairs.length > 1 ? 'Division line' : `Line · ${o0.front} wide`} · ${turns <= 1 ? 'arrives this turn' : `≈${turns} turns — carries on by itself`}`;
    const [lx, ly] = drag.b || drag.a; cx.lineWidth = 4; cx.strokeStyle = 'rgba(20,12,6,.85)'; cx.strokeText(lbl, lx, ly - 14); cx.fillStyle = '#ffe9a8'; cx.fillText(lbl, lx, ly - 14); }
};

// preview helper used by game.js: builds (and caches) path trees once per gesture
// ---------- brigade = one piece (CWG2-style): click a hex, the block moves there THIS turn, no carry-over ----------
const majorityFace = ms => { const n = [0, 0, 0, 0, 0, 0]; ms.forEach(u => n[u.face]++); return n.indexOf(Math.max(...n)); };
// the block keeps its exact shape: every battalion's offset from the brigade's centre hex is slid (and, for a wheel, turned 60°)
const rot60 = (x, y, z, k) => { for (let i = 0; i < ((k % 6) + 6) % 6; i++) [x, y, z] = [-z, -x, -y]; return [x, y, z]; };
O.blockOrder = function (L, h, ms, face) {
  const g = G(), Mp = M(); ms = ms || O.members(g.units, L); const f0 = majorityFace(ms), f = face ?? f0, P = CW.center(...h);
  const C = centroid(ms), c0 = CW.pixelToHex(Mp, ...C) || [ms[0].c, ms[0].r], a = CW.toCube(...c0), t = CW.toCube(...h);
  // pick the cube rotation that turns facing f0 into facing f
  const o0 = CW.toCube(...CW.step(...c0, 0)), o1 = CW.toCube(...CW.step(...c0, 1)); let k = ((f - f0) % 6 + 6) % 6;
  const d0 = [o0[0] - a[0], o0[1] - a[1], o0[2] - a[2]], r1 = rot60(...d0, 1), cw = r1[0] === o1[0] - a[0] && r1[1] === o1[1] - a[1]; if (!cw) k = (6 - k) % 6;
  const used = new Set(); g.units.forEach(x => { if (!x.gone && x.type !== 'ldr' && !ms.some(m => m.id === x.id)) used.add(CW.key(x.c, x.r)); });
  const place = (u, pos) => { const d = CW.toCube(...pos), r = rot60(d[0] - a[0], d[1] - a[1], d[2] - a[2], k), hx = CW.fromCube(t[0] + r[0], t[1] + r[1]);
    if (Mp.in(...hx) && passable(Mp, hx, u) && !used.has(CW.key(...hx))) return hx; return snap(Mp, CW.center(...hx), used, u); };
  const fix = {}; [...ms].sort((p, q) => CW.dist([p.c, p.r], c0) - CW.dist([q.c, q.r], c0)).forEach(u => { const hx = place(u, [u.c, u.r]); if (hx) { fix[u.id] = hx; used.add(CW.key(...hx)); } });
  const col = place(L, [L.c, L.r]);
  return { ax: P[0], ay: P[1], face: f, tpl: 'line', front: ms.length, stance: 'halt', block: 1, fix, fixIds: ms.map(u => u.id).sort().join(','), fixCol: col };
};
// line or column per battalion: stay in line if the slot is reachable in line this turn, otherwise march in column
const lineOK = (tr, u, slot) => { const e = tr && tr.get(CW.key(...slot)); return !!e && e.cost <= u.mp + 1e-6; };
O.blockPlan = function (L, h, cache, face) {
  const g = G(); if (!cache.trees) O.preview(L, CW.center(...h), null, false, cache);
  O._rejoin = true; const orig = O.members(g.units, L); O._rejoin = false; const o = O.blockOrder(L, h, orig, face), S = O.fixedSlots(M(), g.units, L, o, orig);
  const ms = orig.map(u => { const s = S.slots.get(u), v = cache.v && cache.v.get(u); return !s || !v || v === u || lineOK(cache.trees.get(u), u, s) ? u : v; });
  const P = O.plan(L, o, cache.trees, ms, true); return { o, ms, P, full: [...P.legs.values()].every(l => l.stop === l.steps && (l.tgt[0] === l.slot[0] && l.tgt[1] === l.slot[1])) };
};
O.blockPreview = function (L, h, cache) {
  const key = CW.key(...h); if (cache.pv && cache.pvKey === key) return cache.pv;
  const bp = O.blockPlan(L, h, cache), pv = { a: CW.center(...h), b: null, trees: cache.trees, block: 1, full: bp.full, pairs: [[L, bp.o]] }; pv.pairs[0].ms = bp.ms;
  cache.pv = pv; cache.pvKey = key; return pv;
};
// exact reachable area: hexes where every battalion can reach its place this turn
O.blockRange = function (L, cache) {
  const g = G(); O._rejoin = true; const ms = O.members(g.units, L); O._rejoin = false; if (!ms.length) return null;
  const C = centroid(ms), c0 = CW.pixelToHex(M(), ...C) || [ms[0].c, ms[0].r], out = new Set(); if (!cache.trees) O.preview(L, C, null, false, cache);
  M().all.forEach(h => { if (CW.dist(h, c0) > 7 || M().ter(...h) === 'w') return; try { if (O.blockPlan(L, h, cache).full) out.add(CW.key(...h)); } catch (e) {} });
  return out;
};
O.blockMove = function (L, h, face) {
  const g = G(); O._rejoin = true; const ms = O.members(g.units, L); O._rejoin = false; if (!ms.length) return CW.toast('No battalion in this brigade can move');
  CW.snapshot([L, ...ms].concat(g.units.filter(d => d.level === 'div' && d.side === g.side)));
  const back = ms.filter(u => u.detached); back.forEach(u => { u.detached = 0; });
  // decide line/column per battalion before moving (same rule as the preview)
  const o = O.blockOrder(L, h, ms, face), S = O.fixedSlots(M(), g.units, L, o, ms), others = u => g.units.filter(x => x !== u && !ms.includes(x));
  ms.forEach(u => { const s = S.slots.get(u); if (!s || u.acted) return; const stay = lineOK(O.paths(M(), u, g.units.filter(x => !ms.includes(x)), g.weather, u.mp + 1e-6), u, s);
    u._keepForm = stay || CW.dist([u.c, u.r], s) === 0; });
  L.order = o;
  const r = O.execLeg(L), done = L.order.done; L.order = null; ms.forEach(u => delete u._keepForm); O.followGenerals(); if (r.halted) g.undo = [];
  CW.toast(`${r.halted ? 'Enemy spotted! ' : ''}${L.bdeName}: ${done ? 'in position' : 'moved as far as it could this turn'}${back.length ? ` · ${back.length} detached rejoin` : ''}`);
  CW.refreshVis(); CW.selectGroup(L);
};
O.blockWheel = function (L, dir) { const g = G(), ms = O.members(g.units, L).filter(u => !u.digging); if (!ms.length) return;
  CW.snapshot(ms); let n = 0; ms.forEach(u => { const cost = CW.isColumn(u) ? 0 : 1; if (u.mp < cost) return; u.face = (u.face + dir + 6) % 6; u.mp -= cost; u.dug = 0; u.acted = 1; n++; });
  CW.refreshVis(); CW.toast(n ? `${L.bdeName} turns ${dir > 0 ? 'right' : 'left'} (${n}/${ms.length} battalions)` : 'No movement left to turn'); CW.selectGroup(L); };
O.preview = function (Lsel, a, b, column, cache) {
  const g = G(); O._rejoin = true; const pairs = O.fromGesture(Lsel, a, b, false);
  if (!cache.trees) { const ms = O.colonels(g.units, Lsel).flatMap(c => O.members(g.units, c)), t = new Map(), others = g.units.filter(x => !ms.includes(x));
    ms.forEach(u => { const v = { ...u }; if (u.type === 'inf' && !u.acted && u.form !== 'march' && u.mp >= CW.formCost(u)) { v.mp = Math.floor((u.mp - CW.formCost(u)) / CW.maxMP(u) * CW.TYPES.inf.mp.march); v.form = 'march'; }
      const tr = O.paths(M(), v, others, g.weather, CW.maxMP(v) * 6 + 40); t.set(v, tr); t.set(u, v === u ? tr : O.paths(M(), u, others, g.weather, CW.maxMP(u) * 6 + 40)); cache.v = cache.v || new Map(); cache.v.set(u, v); }); cache.trees = t; }
  const clones = cache.v || new Map(); pairs.forEach(p => { p.ms = O.members(g.units, p[0]).map(u => clones.get(u) || u); }); O._rejoin = false;
  return { a, b, pairs, trees: cache.trees };
};
})();
