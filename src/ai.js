'use strict';
// Computer opponent, AI v1 (docs/AI_DESIGN.md). Plays by the player's rules and sees only what its troops see.
// It commands like a player: standing orders for brigades (CW.ORD), then volleys and assaults battalion by battalion.
// Every choice is "score the options, take the best"; the weights are in AI.W and the difficulty table in AI.SKILL.
(function () {
const AI = CW.AI = {};
AI.fast = false;                       // tests: no pauses
AI.log = [];                           // last turn's decisions (for debugging / tuning)
const sleep = ms => new Promise(r => setTimeout(r, AI.fast ? 0 : ms));
const DEG = Math.PI / 180, fvec = f => [Math.cos(f * 60 * DEG), Math.sin(f * 60 * DEG)];
const toFace = v => ((Math.round(Math.atan2(v[1], v[0]) / DEG / 60) % 6) + 6) % 6;
const hx = u => [u.c, u.r], foeOf = s => s === 'CS' ? 'US' : 'CS';
const COMBAT = u => !['ldr', 'hq', 'scout', 'eng'].includes(u.type);
const say = t => { AI.log.push(t); if (AI.debug) console.log('[AI] ' + t); };
const T0 = () => performance.now(); let tm = 0; const lap = n => { if (AI.debug) console.log(`[AI] ${n} ${Math.round(performance.now() - tm)}ms`); tm = performance.now(); };

// ---------- tuning ----------
AI.W = {
  holdBase: 1.0, attackBase: 1.0, threat: 1.6,       // task value: objective VP × (base + threat)
  dist: 1.1,                                          // per hex of travel for a brigade to reach its task
  stick: 6,                                           // keep last turn's task unless something is clearly better
  sameDiv: 3,                                         // brigades of one division like to work together
  cavHold: -6,                                        // cavalry makes a poor garrison
  wornAttack: -25, wornRest: 14,                      // brigades under half strength or badly disordered
  dealt: 1, taken: 1, brk: 60, focus: 25, flank: 20,  // target choice
  artH: 7, artTargets: 5, artNearObj: 6, artDanger: 30, artFriends: 3,
};
AI.SKILL = {
  beginner:     { samples: false, focus: false, wait: 0, carry: 60, loss: 1.0, counter: false, dig: false, artBest: false },
  intermediate: { samples: true,  focus: true,  wait: 1, carry: 50, loss: 1.3, counter: true,  dig: true,  artBest: true },
  advanced:     { samples: true,  focus: true,  wait: 2, carry: 40, loss: 1.6, counter: true,  dig: true,  artBest: true },
};

// ---------- helpers ----------
const centroid = us => { const pts = us.map(u => CW.center(u.c, u.r)); return pts.length ? [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length] : [0, 0]; };
const pxDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) / CW.HW;   // in hexes, roughly
const strength = u => u.gone || u.routed ? 0 : u.type === 'art' ? CW.guns(u) * 70 : COMBAT(u) ? u.men[2] * CW.condition(u) : 0;
function setForm(M, u, want) { const f = CW.TYPES[u.type].forms; if (!f.includes(want) || u.form === want || CW.TERRAIN[M.ter(u.c, u.r)].noForm) return false;
  const cost = CW.formCost(u); if (u.mp < cost) return false; const old = CW.maxMP(u); u.form = want; u.mp = Math.floor((u.mp - cost) / old * CW.maxMP(u)); u.dug = 0; return true; }

// ---------- 1. assess ----------
function assess(G, M, side) {
  const foe = foeOf(side), own = G.units.filter(u => u.side === side && !u.gone);
  G.aiMem = G.aiMem || {}; const mem = G.aiMem[side] = G.aiMem[side] || {};
  for (const e of G.units) if (e.side === foe && !e.gone && G.vis.has(e.id)) mem[e.id] = { c: e.c, r: e.r, t: G.turn, str: strength(e), type: e.type, routed: !!e.routed };
  for (const id of Object.keys(mem)) { const e = G.units.find(u => u.id === +id); if (!e || e.gone || G.turn - mem[id].t > 3) delete mem[id]; }
  const known = Object.entries(mem).map(([id, m]) => ({ id: +id, ...m, seen: m.t === G.turn, u: G.units.find(u => u.id === +id) }));
  // strategic picture (the scenario briefing tells both generals roughly what the other has)
  const myStr = own.reduce((t, u) => t + strength(u), 0), foeStr = G.units.filter(u => u.side === foe && !u.gone).reduce((t, u) => t + strength(u), 0);
  const vp = CW.vp(), gap = vp[side] - vp[foe], left = (G.endAt - G.minutes) / 20;   // turns left
  const ratio = myStr / Math.max(1, foeStr);
  // where the enemy comes from: known enemies, else his supply sources
  const src = known.length ? known.map(k => CW.center(k.c, k.r)) : (M.supply || []).filter(s => s[2] === foe).map(s => CW.center(s[0], s[1]));
  const foeC = src.length ? [src.reduce((t, p) => t + p[0], 0) / src.length, src.reduce((t, p) => t + p[1], 0) / src.length] : [0, 0];
  const homeS = (M.supply || []).filter(s => s[2] === side).map(s => CW.center(s[0], s[1]));
  const home = homeS.length ? [homeS.reduce((t, p) => t + p[0], 0) / homeS.length, homeS.reduce((t, p) => t + p[1], 0) / homeS.length] : centroid(own);
  // attack when behind and still strong enough, or clearly stronger; a beaten army holds what it has (unless time is running out)
  const posture = (gap < -5 && ratio >= .6) || ratio >= 1.25 || (gap <= 0 && left < 10 && ratio >= .45) ? 'attack' : 'defend';
  const night = CW.phase(G.minutes) === 'Night';
  return { side, foe, own, known, myStr, foeStr, ratio, gap, left, posture, foeC, home, night };
}

// threat near a hex: known enemy strength within 6 hexes, nearer counts more
const nearFoe = (A, u) => A.known.reduce((m, k) => Math.min(m, CW.dist([u.c, u.r], [k.c, k.r])), 99);
const threatAt = (A, h) => A.known.reduce((t, k) => { const d = CW.dist(h, [k.c, k.r]); return d <= 6 ? t + k.str / 800 * (1 - d / 7) : t; }, 0);

// ---------- 2. tasks → brigades ----------
function brigades(G, side) { return G.units.filter(l => l.level === 'bde' && l.side === side && !l.gone).map(L => { const ms = CW.ORD.members(G.units, L), all = G.units.filter(x => x.bde === L.bde && x.side === side && x.type !== 'ldr');
    const now = all.reduce((t, u) => t + (u.gone ? 0 : u.men[2]), 0), was = all.reduce((t, u) => t + u.men[0], 0), org = ms.length ? ms.reduce((t, u) => t + u.org, 0) / ms.length : 0;
    return { L, ms, worn: now / Math.max(1, was) < .5 || org < 35 }; }).filter(b => b.ms.length); }
function makeTasks(G, M, A) {
  const out = [];
  for (const o of G.obj || []) { const [c, r, name, v, owner] = o, h = [c, r], th = threatAt(A, h);
    if (owner === A.side) out.push({ kind: 'hold', o, h, name, w: v * (AI.W.holdBase + AI.W.threat * th) * (A.posture === 'defend' ? 1.3 : .7), cap: th > 1.5 ? 3 : th > .4 ? 2 : 1 });
    else out.push({ kind: 'attack', o, h, name, w: v * AI.W.attackBase * (A.posture === 'attack' ? 1.4 : .25) * (owner ? 1 : 1.2), cap: Math.max(1, Math.ceil(v / 7)) }); }
  // a reserve behind the most threatened place we hold
  const held = out.filter(t => t.kind === 'hold').sort((a, b) => threatAt(A, b.h) - threatAt(A, a.h))[0];
  if (held) out.push({ kind: 'reserve', h: held.h, name: `reserve behind ${held.name}`, w: 4, cap: 3, of: held });
  return out;
}
function assign(G, M, A, bdes, tasks) {
  G.aiTask = G.aiTask || {}; const count = new Map(), res = new Map(), divOn = new Map();
  const score = (b, t) => { const cc = centroid(b.ms), d = pxDist(cc, CW.center(...t.h)), n = count.get(t) || 0; if (n >= t.cap) return -1e9;
    let s = t.w * Math.pow(.6, n) - d * AI.W.dist;
    if (G.aiTask[b.L.id] === t.kind + ':' + (t.name || '')) s += AI.W.stick;
    if (b.L.div && divOn.get(t) && divOn.get(t).has(b.L.div)) s += AI.W.sameDiv;
    if (b.ms.every(u => u.type === 'cav') && t.kind === 'hold') s += AI.W.cavHold;
    if (b.worn) s += t.kind === 'attack' ? AI.W.wornAttack : t.kind === 'reserve' ? AI.W.wornRest : 0;   // fought-out brigades go back to rest
    return s; };
  const left = [...bdes];
  while (left.length) { let best = null; for (const b of left) for (const t of tasks) { const s = score(b, t); if (!best || s > best.s) best = { b, t, s }; }
    if (!best || best.s < -1e8) break; res.set(best.b, best.t); count.set(best.t, (count.get(best.t) || 0) + 1);
    if (best.b.L.div) { if (!divOn.has(best.t)) divOn.set(best.t, new Set()); divOn.get(best.t).add(best.b.L.div); }
    left.splice(left.indexOf(best.b), 1); }
  left.forEach(b => res.set(b, tasks.find(t => t.kind === 'reserve') || tasks[0]));
  res.forEach((t, b) => { G.aiTask[b.L.id] = t.kind + ':' + (t.name || ''); });
  return res;
}

// ---------- 3. where a brigade should stand ----------
// defensive value of a hex for a line facing `face`: cover, walls/fences on the front edges, height, the objective itself
function defVal(M, h, face, obj) { if (!M.in(...h) || M.ter(...h) === 'w') return -5; let v = CW.coverAt(M, ...h) + M.h(...h) * .6;
  for (const d of [face, (face + 1) % 6, (face + 5) % 6]) { const E = M.edge(h[0], h[1], d); if (E) for (const t of E) v += CW.EDGES[t].cover * (d === face ? 1 : .6); }
  if (obj && h[0] === obj[0] && h[1] === obj[1]) v += 4; return v; }
function lineScore(G, M, L, order, ms, obj) { const S = CW.ORD.slots(M, G.units, L, order, ms); let v = 0, n = 0;
  S.slots.forEach(h => { v += defVal(M, h, order.face, obj); n++; }); return n ? v / n + (n < ms.length ? -3 : 0) : -99; }
function holdOrder(G, M, A, b, t, k) {
  const oc = CW.center(...t.h), face = toFace([A.foeC[0] - oc[0], A.foeC[1] - oc[1]]), F = fvec(face), Lv = [-F[1], F[0]];
  const front = Math.max(1, b.ms.filter(u => u.type !== 'art').length);
  let best = null;
  for (const df of [0, 1, -1]) { const f = (face + df + 6) % 6, Fv = fvec(f), Lf = [-Fv[1], Fv[0]];
    for (const lat of [0, -1, 1, -2, 2]) for (const back of [0, 1]) {
      const side = k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * front * 1.5 : 0;   // second/third brigade extends the line
      const ax = oc[0] + Lf[0] * CW.HW * (lat * .75 + side) - Fv[0] * CW.HW * back, ay = oc[1] + Lf[1] * CW.HW * (lat * .75 + side) - Fv[1] * CW.HW * back;
      const o = { ax, ay, face: f, tpl: 'line', front, stance: 'halt', block: true }, s = lineScore(G, M, b.L, o, b.ms, t.h) - Math.abs(df) * 1.5 - Math.abs(lat) * .3;
      if (!best || s > best.s) best = { o, s }; } }
  return best.o;
}
function attackOrder(G, M, A, b, t, wave) {
  const cc = centroid(b.ms), oc = CW.center(...t.h), face = toFace([oc[0] - cc[0], oc[1] - cc[1]]), F = fvec(face), front = Math.max(1, b.ms.filter(u => u.type !== 'art').length);
  const back = wave ? 0 : 3;
  return { ax: oc[0] - F[0] * CW.HW * back, ay: oc[1] - F[1] * CW.HW * back, face, tpl: 'line', front, stance: 'halt', wave: !!wave, block: true };   // block: the brigade finishes its move together
}
function reserveOrder(G, M, A, b, t) { const oc = CW.center(...t.h), face = toFace([A.foeC[0] - oc[0], A.foeC[1] - oc[1]]), F = fvec(face);
  return { ax: oc[0] - F[0] * CW.HW * 3, ay: oc[1] - F[1] * CW.HW * 3, face, tpl: 'line', front: Math.max(1, Math.ceil(b.ms.length / 2)), stance: 'halt', block: true }; }
const sameOrder = (a, b) => a && b && Math.abs(a.ax - b.ax) < CW.HW * .6 && Math.abs(a.ay - b.ay) < CW.HW * .6 && a.face === b.face && a.front === b.front;

// ---------- 4. artillery: find a height with a field of fire ----------
function artPlace(G, M, A, u, sk, focusHexes) {
  const tr = CW.ORD.paths(M, u, G.units.filter(x => x !== u), G.weather, CW.maxMP(u) * 2), cand = [];
  tr.forEach((v, k) => { const h = CW.unkey(k); if (CW.TERRAIN[M.ter(...h)].noArt || M.ter(...h) === 'w') return;
    if (CW.bodiesAt(G.units, ...h).some(o => o !== u && o.type !== 'ldr')) return;
    const nearFoe = A.known.reduce((m, e) => Math.min(m, CW.dist(h, [e.c, e.r])), 99); if (nearFoe <= 1) return;
    let s = M.h(...h) * AI.W.artH - v.cost * .15;
    if (sk.artBest) { const tg = A.known.filter(e => { const d = CW.dist(h, [e.c, e.r]); return d >= 2 && d <= 6 && CW.los(M, h, [e.c, e.r], 1.2, .3); }).length; s += Math.min(3, tg) * AI.W.artTargets;
      if (nearFoe <= 3 && !A.known.every(e => e.type === 'art')) s -= AI.W.artDanger / nearFoe; }
    const fd = focusHexes.reduce((m, f) => Math.min(m, CW.dist(h, f)), 99); s += fd <= 4 ? AI.W.artNearObj : -fd;
    const friends = G.units.filter(x => x.side === u.side && !x.gone && x.type === 'inf' && CW.dist(h, [x.c, x.r]) <= 2).length; s += Math.min(3, friends) * AI.W.artFriends;
    cand.push({ h, s, cost: v.cost }); });
  cand.sort((a, b) => b.s - a.s); return cand[0] ? { ...cand[0], tr } : null;
}
async function handleArtillery(G, M, A, sk, focusHexes) {
  const guns = A.own.filter(u => u.type === 'art' && !u.gone && !u.routed);
  for (const u of guns) {
    if (u.fired || u.digging) continue;
    const foesIn = G.units.filter(e => e.side === A.foe && !e.gone && G.vis.has(e.id) && e.type !== 'ldr' && CW.dist(hx(u), hx(e)) <= CW.fireRange(M, u, hx(e)));
    const adj = G.units.some(e => e.side === A.foe && !e.gone && e.type !== 'ldr' && CW.dist(hx(u), hx(e)) === 1);
    if (u.form === 'unl') { if (foesIn.length || u._idle === undefined) { u._idle = foesIn.length ? 0 : (u._idle || 0); continue; }
      u._idle = (u._idle || 0) + 1; if (u._idle < 2 || adj) continue;         // nothing to shoot for two turns: limber up and move
      if (setForm(M, u, 'lim')) say(`${u.name} limbers up`); continue; }
    // limbered: go to the best height, unlimber if there's time
    const P = artPlace(G, M, A, u, sk, focusHexes); if (!P) continue;
    const path = P.tr.path(CW.key(...P.h)); if (path.length > 1) { const cs = CW.ORD.pathCosts(M, u, path, G.weather); let i = 0; while (i + 1 < path.length && cs[i + 1] <= u.mp) i++; if (i) CW.walk(u, path.slice(0, i + 1)); }
    if (u.c === P.h[0] && u.r === P.h[1] || foesIn.length) { if (setForm(M, u, 'unl')) { u.acted = 1; u._idle = 0; say(`${u.name} unlimbers on ${M.h(u.c, u.r) > 1 ? 'high ground' : 'position'}`); } }
    CW.draw(); await sleep(180);
  }
}

// ---------- 5. fire & assault ----------
const tally = (res, u, as) => { const S = AI.stats; if (as) S.assaults++; else { S.shots++; if (u.type === 'art') S.art++; } (res.rep || []).forEach(x => { if (x.cas) { if (x.who === u.id) S.taken += x.cas; else S.dealt += x.cas; } }); };
function targetValue(G, e, objHexes) { let v = e.type === 'art' ? 1.5 : e.type === 'cav' ? 1.1 : 1; if (e.routed) v *= .25; if (objHexes.some(h => h[0] === e.c && h[1] === e.r)) v *= 1.4; return v; }
async function firePhase(G, M, A, sk, filter) {
  const objHexes = (G.obj || []).map(o => [o[0], o[1]]); let shots = 0;
  const cache = new Map(), pred = (u, e) => { const k = u.id + ':' + e.id; if (!cache.has(k)) cache.set(k, sk.samples ? CW.predict(G, M, u, e, 'fire') : { dealt: 1 / (1 + CW.dist(hx(u), hx(e))), taken: 0, brk: 0, arc: 'front' }); return cache.get(k); };
  for (let guard = 0; guard < 80; guard++) {
    const shooters = A.own.filter(u => !u.gone && !u.fired && COMBAT(u) && (!filter || filter(u)));
    const foes = G.units.filter(e => e.side === A.foe && !e.gone && e.type !== 'ldr' && e.type !== 'hq' && G.vis.has(e.id));
    let best = null;
    for (const u of shooters) for (const e of foes) { if (CW.canFire(G, M, u, e)) continue; const p = pred(u, e);
      let s = p.dealt * AI.W.dealt - p.taken * AI.W.taken + p.brk / 100 * AI.W.brk;
      s *= targetValue(G, e, objHexes); if (sk.focus && e._hit) s += AI.W.focus; if (sk.focus && p.arc !== 'front') s += AI.W.flank;
      if (!best || s > best.s) best = { u, e, s }; }
    if (!best || best.s <= 0) break;
    const { u, e } = best, from = hx(u), res = CW.resolveFire(G, M, u, e); G.units.forEach(x => delete x._left); e._hit = 1; shots++; tally(res, u);
    [...cache.keys()].forEach(k => { if (k.endsWith(':' + e.id) || k.startsWith(u.id + ':')) cache.delete(k); });
    CW.refreshVis(); CW.playCombat(G, u, e, res, from); if (!AI.fast) CW.report(G, res, u, e); CW.draw(); await sleep(320);
  }
  return shots;
}
async function assaultPhase(G, M, A, sk, tasks) {
  let n = 0;
  for (let guard = 0; guard < 40; guard++) {
    const foes = G.units.filter(e => e.side === A.foe && !e.gone && e.type !== 'ldr' && e.type !== 'hq' && G.vis.has(e.id));
    let best = null;
    for (const u of A.own) { if (u.gone || u.assaulted || !['inf', 'cav'].includes(u.type)) continue;
      const attacking = A.posture === 'attack' || (u._task && u._task.kind === 'attack');
      for (const e of foes) { if (CW.canAssault(G, M, u, e)) continue;
        const weak = e.routed || e.type === 'art' && e.form === 'lim' || e.org < 35;
        if (!attacking && !(sk.counter && weak)) continue;
        const mode = u.type === 'cav' && u.form === 'mounted' ? 'charge' : 'assault'; if (mode === 'charge' && !weak && e.type !== 'art') continue;
        const p = CW.predict(G, M, u, e, mode), ok = p.carry >= sk.carry && p.taken <= Math.max(20, p.dealt * sk.loss);
        if (!ok && !(weak && p.carry >= 25)) continue;
        const s = p.carry + p.brk * .5 + (weak ? 25 : 0) - p.taken / 10; if (!best || s > best.s) best = { u, e, mode, s }; } }
    if (!best) break;
    const { u, e, mode } = best, from = hx(u), res = CW.resolveAssault(G, M, u, e, mode === 'charge'); G.units.forEach(x => delete x._left); n++; tally(res, u, 1);
    say(`${u.name} ${mode === 'charge' ? 'charges' : 'assaults'} ${e.name}: ${res.result}`);
    CW.refreshVis(); CW.playCombat(G, u, e, res, from); if (!AI.fast) CW.report(G, res, u, e); CW.draw(); await sleep(520);
  }
  return n;
}

// ---------- 6. housekeeping ----------
function housekeeping(G, M, A, sk) {
  // rally: at most two routed battalions a turn, keeping some army morale in hand
  A.own.filter(u => u.routed && !u.gone).slice(0, 2).forEach(u => { if (G.morale[A.side] >= 12 && CW.rally(G, M, u) === 'rallied') say(`${u.name} rallied`); });
  // defenders in position and out of rifle range dig in
  if (sk.dig && !A.night) A.own.forEach(u => { if (u.gone || u.acted || u.digging || u.dug || !u._task || u._task.kind !== 'hold') return;
    if (CW.canDig(M, u)) return; if (G.units.some(e => e.side === A.foe && !e.gone && CW.dist(hx(u), hx(e)) <= 2)) return;
    u.digging = 1; u.mp = 0; u.acted = 1; });
  // the corps HQ keeps within reach of its generals, well back from the enemy
  A.own.filter(h => h.type === 'hq' && CW.canMove(h) && h.mp > 0).forEach(H => { const ds = A.own.filter(d => d.level === 'div'); if (!ds.length) return;
    const far = ds.filter(d => CW.dist(hx(d), hx(H)) > CW.reachOf(H)); if (!far.length) return;
    const c = centroid(ds), F = [A.home[0] - c[0], A.home[1] - c[1]], L = Math.hypot(...F) || 1, tgt = CW.pixelToHex(M, c[0] + F[0] / L * CW.HW * 2, c[1] + F[1] / L * CW.HW * 2); if (!tgt) return;
    const tr = CW.ORD.paths(M, H, G.units, G.weather, H.mp), p = tr.path(CW.key(...tgt)); if (p.length > 1) CW.walk(H, p); });
}

// ---------- the turn ----------
AI.takeTurn = async function (G, M) {
  AI.log = []; AI.stats = { shots: 0, art: 0, assaults: 0, dealt: 0, taken: 0 }; const side = G.side, sk = AI.SKILL[G.opts.difficulty] || AI.SKILL.intermediate;
  CW.refreshVis(); G.units.forEach(u => { delete u._hit; if (u.side === side && u.type === 'art') u.detached = 1; });   // batteries are sited by the AI itself
  tm = T0(); const A = assess(G, M, side); lap('assess');
  say(`${side} ${A.posture} · strength ${Math.round(A.myStr)} vs ${Math.round(A.foeStr)} · VP gap ${A.gap} · ${A.known.length} enemies known`);
  const bdes = brigades(G, side), tasks = makeTasks(G, M, A), plan = assign(G, M, A, bdes, tasks);
  plan.forEach((t, b) => b.ms.concat([b.L]).forEach(u => { u._task = t; })); lap('tasks');
  const focusHexes = [...new Set([...plan.values()].map(t => CW.key(...t.h)))].map(CW.unkey);

  // a. guns that are set up fire first (they need their whole turn), then battalions already in contact
  if (!A.night) { await firePhase(G, M, A, sk, u => u.type === 'art'); await firePhase(G, M, A, sk, u => u.type !== 'art' && u._task && u._task.kind !== 'attack'); }

  lap('fire1');
  // b. brigade orders (attack waves wait until every brigade on that objective has gathered)
  const byTask = new Map(); plan.forEach((t, b) => { if (!byTask.has(t)) byTask.set(t, []); byTask.get(t).push(b); });
  G.aiWait = G.aiWait || {};
  const kOf = new Map(); let moved = 0;
  const order = [...plan.entries()].sort((x, y) => (x[1].kind === 'attack' ? 0 : 1) - (y[1].kind === 'attack' ? 0 : 1));
  for (const [b, t] of order) {
    const L = b.L; let o;
    if (t.kind === 'hold') { const k = kOf.get(t) || 0; kOf.set(t, k + 1); o = holdOrder(G, M, A, b, t, k); }
    else if (t.kind === 'reserve') o = reserveOrder(G, M, A, b, t);
    else { // attack: stage 3 hexes short, then go in together
      const mates = byTask.get(t) || [b], key = t.name, staged = mates.every(m => pxDist(centroid(m.ms), CW.center(...t.h)) <= 4.2);
      const waited = G.aiWait[key] || 0, wave = !A.night && (staged || waited >= sk.wait || (L.order && L.order.wave));
      if (!wave && mates.every(m => pxDist(centroid(m.ms), CW.center(...t.h)) <= 5)) G.aiWait[key] = waited + 1;
      o = attackOrder(G, M, A, b, t, wave); }
    if (A.night && t.kind === 'attack' && L.order && !L.order.wave) o = L.order;   // no night assaults: hold the staging line
    const keep = sameOrder(L.order, o) && !L.order.contact;
    if (!keep) { L.order = o; b.ms.forEach(u => { u.detached = 0; }); }
    else L.order.contact = false;
    if (L.order.done && keep) continue;                // in position: stay put (they rest, or dig in)
    // near the enemy, battalions deploy into battle line and keep it while they advance (columns can't fire and suffer under it)
    b.ms.forEach(u => { if (u.type === 'inf' && nearFoe(A, u) <= 4) { u._keepForm = 1; if (u.form === 'march') setForm(M, u, 'combat'); } });
    lap('order ' + L.bdeName); const r = CW.ORD.execLeg(L); moved += r.moved || 0; lap('leg');
    b.ms.forEach(u => { delete u._keepForm; if (u.type === 'inf' && u.form === 'march' && nearFoe(A, u) <= 3) setForm(M, u, 'combat'); });
    if (r.moved) say(`${L.bdeName}: ${t.kind} ${t.name || ''}${o.wave ? ' (assault wave)' : ''} · ${r.arrived}/${r.total} in place${r.halted ? ' · enemy spotted' : ''}`);
    CW.refreshVis(); CW.draw(); await sleep(r.moved ? 320 : 0);
  }
  CW.ORD.followGenerals();

  // c. guns reposition, then everyone who can still shoot does, then assaults
  lap('generals'); await handleArtillery(G, M, A, sk, focusHexes); lap('artillery');
  if (!A.night) { await firePhase(G, M, A, sk); await assaultPhase(G, M, A, sk, tasks); await firePhase(G, M, A, sk); }
  lap('combat'); housekeeping(G, M, A, sk); lap('housekeeping');
  CW.refreshVis(); CW.draw();
  AI.last = { side, stats: AI.stats, posture: A.posture, tasks: [...plan].map(([b, t]) => [b.L.bdeName, t.kind, t.name]), log: AI.log.slice() };
  await sleep(500);
};
})();
