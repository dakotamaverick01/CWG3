'use strict';
// Combat: volleys (ranged), assaults & charges (into adjacent hex), artillery, morale, retreat/rout/surrender, rally.
// Every modifier is recorded as [label, multiplier] so the hover preview can show the breakdown. Numbers are tunable.
CW.WEAPONS = {
  'Springfield RF': { cls: 'Rifle', wp: 50, hh: 45, rng: 2 }, 'Enfield RF': { cls: 'Rifle', wp: 50, hh: 45, rng: 2 }, 'Lorenz RF': { cls: 'Rifle', wp: 44, hh: 45, rng: 2 },
  'Richmond RF': { cls: 'Rifle', wp: 46, hh: 45, rng: 2 }, 'Smoothbore musket': { cls: 'Smoothbore', wp: 34, hh: 55, rng: 1 },
  'Sharps Carbine': { cls: 'Carbine', wp: 55, hh: 25, rng: 2 }, 'Burnside Carbine': { cls: 'Carbine', wp: 52, hh: 25, rng: 2 }, 'Spencer Carbine': { cls: 'Repeater', wp: 78, hh: 60, rng: 2 },
  'Whitworth Target RF': { cls: 'Target rifle', wp: 90, hh: 15, rng: 3 }, 'Pistols & sabres': { cls: 'Sidearms', wp: 8, hh: 30, rng: 0 }, 'Pistol & sabre': { cls: 'Sidearms', wp: 8, hh: 30, rng: 0 },
  '12-pdr Napoleon SB': { cls: 'Cannon', art: 1, rng: 10, pw: [14, 12, 8, 8, 7, 7, 5, 5, 4, 4] },
  '10-pdr Parrott RF': { cls: 'Cannon', art: 1, rng: 16, pw: [7, 7, 7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3] },
  '3-in Ordnance RF': { cls: 'Cannon', art: 1, rng: 16, pw: [7, 7, 7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3] },
};
CW.weapon = u => CW.WEAPONS[u.wpn] || (u.type === 'art' ? CW.WEAPONS['12-pdr Napoleon SB'] : CW.WEAPONS['Springfield RF']);
CW.FIRE_MP = 4; CW.ASSAULT_MP = 4;
const cl = v => Math.max(0, Math.min(99, Math.round(v)));
const hx = u => [u.c, u.r];
CW.guns = u => u.guns || Math.max(1, Math.round(u.men[2] / 22));
CW.fireRange = (M, u, tgt) => { const w = CW.weapon(u); let r = w.rng; if (u.type === 'cav' && u.form === 'mounted' && !w.art) r = Math.min(r, 1);
  if (w.art) r += Math.max(0, Math.min(2, M.h(u.c, u.r) - M.h(...tgt))); return r; };
CW.bodies = (G, c, r) => CW.bodiesAt(G.units, c, r);
// ---------- eligibility ----------
CW.canFire = function (G, M, u, e) {
  if (u.routed) return 'Routed units cannot fight'; if (CW.phase(G.minutes) === 'Night') return 'No fighting at night';
  if (['hq', 'ldr', 'scout', 'eng'].includes(u.type)) return 'This unit does not fight offensively';
  if (u.digging) return 'Digging in'; if (u.fired) return 'Already fired this turn'; if (u.sp < 1) return 'Out of ammunition';
  const w = CW.weapon(u), d = CW.dist(hx(u), hx(e));
  if (u.type === 'art') { if (u.form !== 'unl') return 'Artillery must unlimber to fire'; if (u.mp < CW.maxMP(u)) return 'Artillery needs its full turn to fire'; }
  if (d > CW.fireRange(M, u, hx(e))) return `Out of range (${CW.fireRange(M, u, hx(e))} hex${CW.fireRange(M, u, hx(e)) === 1 ? '' : 'es'})`;
  if (d > 1 && !CW.los(M, hx(u), hx(e), CW.EYE(u), .3)) return u.type === 'art' ? 'No line of fire' : 'No line of sight';
  if (u.type === 'art' && d > 1 && CW.line(hx(u), hx(e)).slice(1, -1).some(h => CW.bodies(G, ...h).some(o => o.side === u.side) && M.h(...h) >= M.h(u.c, u.r))) return 'Friendly troops in the line of fire';
  if (!w.art && CW.isColumn(u) && u.type === 'inf') return 'Deploy into combat formation to fire (F)';
  return '';
};
CW.canAssault = function (G, M, u, e) {
  if (u.routed) return 'Routed units cannot fight'; if (CW.phase(G.minutes) === 'Night') return 'No fighting at night';
  if (!['inf', 'cav'].includes(u.type)) return 'Only infantry and cavalry can assault'; if (u.digging) return 'Digging in';
  if (CW.dist(hx(u), hx(e)) !== 1) return 'Must be adjacent to assault'; if (u.sp < 1) return 'Out of ammunition';
  const need = 2 + (u.type === 'inf' && u.form === 'march' ? CW.formCost(u) : 0); if (u.mp < need) return `Needs ${need} movement points left to close in and assault`;
  if (u.assaulted) return 'Already assaulted this turn';
  const d = CW.dirTo(hx(u), hx(e)), E = M.edge(u.c, u.r, d); if (E && E.has('wall') && u.type === 'cav' && u.form === 'mounted') return 'Mounted cavalry cannot assault over a wall';
  if (M.ter(e.c, e.r) === 'w') return 'Cannot assault into a river';
  return '';
};
// ---------- modifiers ----------
CW.coverVs = function (M, def, fromHex) { // cover of defender against fire from fromHex
  const mods = []; let cov = CW.coverAt(M, def.c, def.r); if (cov) mods.push([`${CW.TERRAIN[M.ter(def.c, def.r)].n}${M.sunkenSet.has(CW.key(def.c, def.r)) ? ' (sunken road)' : ''} cover ${cov > 0 ? '+' : ''}${cov}`, 0]);
  const d = CW.dirToward(hx(def), fromHex), E = M.edge(def.c, def.r, d);
  if (E) for (const t of E) { cov += CW.EDGES[t].cover; mods.push([`${CW.EDGES[t].n} +${CW.EDGES[t].cover}`, 0]); }
  if (def.dug) { cov += 2; mods.push(['Entrenched +2', 0]); }
  return { cov, mods, mult: Math.max(.45, Math.min(1.35, 1 - .075 * cov)) };
};
CW.condition = u => .35 + .65 * (u.org + u.hlth + u.mor) / 297;
// firepower of `a` shooting at `t` (range d); kind: 'volley' | 'defend' | 'assault' | 'charge' | 'return'
CW.firepower = function (G, M, a, t, kind) {
  const w = CW.weapon(a), d = CW.dist(hx(a), hx(t)), mods = []; let fp;
  if (w.art) { const p = w.pw[Math.min(w.pw.length - 1, Math.max(0, d - 1))] || 0; fp = CW.guns(a) * p / 8; mods.push([`${CW.guns(a)} guns at ${d} hex${d > 1 ? 'es' : ''}`, 1]); }
  else { fp = a.men[2] / 100 * w.wp / 50; if (d >= 2) { fp *= .55; mods.push(['Long range', .55]); } }
  if (kind === 'volley' && !w.art) { const fr = Math.max(0, Math.min(1, a.mp / Math.max(1, CW.maxMP(a)))); if (fr < 1) { const f = .6 + .4 * fr; fp *= f; mods.push(['Fired after marching', +f.toFixed(2)]); } }
  const cond = CW.condition(a); fp *= cond; if (cond < .8) mods.push(['Worn out (order/health/morale)', +cond.toFixed(2)]);
  if (!CW.inCommand(G.units, a)) { fp *= .8; mods.push(['Out of command', .8]); } else if (a.st !== 5) { const f = 1 + (a.st - 5) * .04; fp *= f; mods.push([`Leadership ${a.st}/10`, +f.toFixed(2)]); }
  if (CW.isColumn(a) && !w.art && a.type !== 'scout') { const f = a.type === 'cav' ? .6 : .4; fp *= f; mods.push([a.type === 'cav' ? 'Firing mounted' : 'Caught in column', f]); }
  if (a.type === 'art' && a.form === 'lim') { fp *= .1; mods.push(['Limbered guns', .1]); }
  const dh = M.h(a.c, a.r) - M.h(t.c, t.r); if (dh) { const f = dh >= 2 ? 1.4 : dh === 1 ? 1.1 : dh === -1 ? .9 : .6; fp *= f; mods.push([dh > 0 ? `Firing downhill (${dh})` : `Firing uphill (${-dh})`, f]); }
  if (CW.TERRAIN[M.ter(a.c, a.r)].woods && a.type === 'art') { fp *= .5; mods.push(['Guns in woods', .5]); }
  if (CW.TERRAIN[M.ter(a.c, a.r)].woods && CW.isMounted(a)) { fp *= .5; mods.push(['Mounted in woods', .5]); }
  if (a.sp > CW.spMax(a)) { fp *= 1.05; mods.push(['Oversupplied', 1.05]); }
  // fields of fire: defender shooting at attackers standing in the open
  if ((kind === 'defend' || kind === 'return') && CW.TERRAIN[M.ter(t.c, t.r)].open && !M.sunkenSet.has(CW.key(t.c, t.r))) { const f = w.art && d <= 2 ? 1.3 : 1.15; fp *= f; mods.push([w.art && d <= 2 ? 'Canister across open ground' : 'Field of fire (open ground)', f]); }
  if (w.art && t.type !== 'art' && CW.bodies(G, t.c, t.r).length > 1) { fp *= 1.3; mods.push(['Crowded hex', 1.3]); }
  return { fp: Math.max(0, fp), mods };
};
CW.arcMult = (def, from) => { const arc = CW.arcOf(def, from); return arc === 'front' ? [1, 1, arc] : arc === 'flank' ? [1.4, .5, arc] : [1.6, .3, arc]; };
// ---------- damage ----------
function hit(G, M, a, t, fp, rand, rep, apply, extraMult = 1, label = '') {
  const cv = CW.coverVs(M, t, hx(a)), woods = (CW.TERRAIN[M.ter(t.c, t.r)].woods || CW.TERRAIN[M.ter(a.c, a.r)].woods) && CW.dist(hx(a), hx(t)) <= 1 ? 1.5 : 1;
  const ph = CW.phase(G.minutes), dusk = ph === 'Dawn' || ph === 'Dusk' ? .85 : 1;
  const cas = Math.round(fp * 6 * cv.mult * woods * extraMult * dusk * (0.8 + 0.4 * rand()));
  const eff = Math.max(1, t.men[2]), lost = Math.min(cas, t.men[1] - 5), pct = lost / eff * 100;
  rep.push({ who: t.id, cas: lost, label });
  if (!apply) { t._cas = (t._cas || 0) + lost; t.mor = cl(t.mor - pct * 1.3); t.org = cl(t.org - pct); t.men[2] = Math.max(0, t.men[2] - lost); return lost; }
  t.men[1] -= lost; t.men[2] = Math.max(0, t.men[2] - Math.round(lost * 1.3)); t.mor = cl(t.mor - pct * 1.3); t.org = cl(t.org - pct * (woods > 1 ? 1.4 : 1)); t.hlth = cl(t.hlth - pct * .4);
  G.cas = G.cas || { CS: 0, US: 0 }; G.cas[t.side] += lost;
  // leader hit (brigade commander standing with the unit, or unit's own leadership)
  const L = G.units.find(l => l.type === 'ldr' && !l.gone && l.c === t.c && l.r === t.r && l.side === t.side);
  if (L && rand() < (a.type === 'spec' ? .15 : .05)) { const killed = rand() < .35; rep.push({ ldr: L.id, text: `${L.ldr} ${killed ? 'killed' : 'wounded'}!` });
    L.ldr = `Lt. Col. (acting)`; L.name = L.ldr; L.st = Math.max(2, L.st - 2); G.units.filter(u => u.bde === L.bde && u.side === L.side).forEach(u => { u.mor = cl(u.mor - (killed ? 12 : 6)); if (u.type !== 'ldr') u.st = L.st; }); }
  return lost;
}
CW.useAmmo = (u, n = 1) => { u.sp = Math.max(0, u.sp - n); };
// retreat one hex away from `from`; returns hex or null
CW.retreatHex = (G, M, u, from) => { const opts = M.nbrs(u.c, u.r).map(n => [n[0], n[1]]).filter(h => M.ter(...h) !== 'w' && !CW.bodies(G, ...h).length && CW.dist(h, from) > CW.dist(hx(u), from));
  opts.sort((p, q) => CW.dist(q, from) - CW.dist(p, from) || M.h(...q) - M.h(...p)); return opts[0] || null; };
function breakCheck(G, M, u, from, rand, rep, apply, threshold) {
  if (u.type === 'art' && u.form === 'unl') threshold -= 10; // gunners stand by their guns
  if (u.mor >= threshold) return 'holds';
  return giveWay(G, M, u, from, rand, rep, apply, u.mor < threshold - 22 || rand() < .15 * (threshold - u.mor) / 22);
}
function giveWay(G, M, u, from, rand, rep, apply, rout) {
  if (!apply) u._left = 1;
  const dest = CW.retreatHex(G, M, u, from);
  if (!dest) { rep.push({ who: u.id, text: 'surrenders' }); if (apply) surrender(G, u, rep); return 'surrenders'; }
  if (apply) { u.c = dest[0]; u.r = dest[1]; u.dug = 0; u.face = CW.dirToward(dest, from); u.sp = Math.max(0, u.sp - 2); u.mp = 0; if (rout) { u.routed = 1; u.form = CW.TYPES[u.type].forms[0]; } }
  rep.push({ who: u.id, text: rout ? 'routs!' : 'falls back' }); return rout ? 'routs' : 'retreats';
}
function surrender(G, u, rep) { u.gone = 1; u.surrendered = 1; G.cas = G.cas || { CS: 0, US: 0 }; G.cas[u.side] += u.men[1]; }
function moraleSwing(G, win, lose, n) { G.morale[win] = Math.min(99, G.morale[win] + n); G.morale[lose] = Math.max(0, G.morale[lose] - n); }
// ---------- volleys ----------
CW.resolveFire = function (G, M, a, t, rand = Math.random, apply = true) {
  const rep = [], defs = CW.bodies(G, t.c, t.r).filter(x => x.side !== a.side), [am, rm, arc] = CW.arcMult(t, hx(a));
  const F = CW.firepower(G, M, a, t, 'volley'); let fp = F.fp * am;
  const share = defs.length > 1 ? .5 : 1; defs.forEach(d => hit(G, M, a, d, fp * share, rand, rep, apply, 1, 'volley'));
  CW.useAmmo(a);
  // return fire: not against sharpshooters, not by units out of range / artillery shelled from beyond infantry range
  if (a.type !== 'spec') for (const d of defs) { if (d.gone || d.routed || d.sp < 1) continue; const rng = CW.fireRange(M, d, hx(a));
    if (CW.dist(hx(a), hx(d)) > rng || ['hq', 'ldr', 'scout', 'eng'].includes(d.type)) continue; if (d.type === 'art' && d.form !== 'unl') continue;
    const R = CW.firepower(G, M, d, a, 'return'); hit(G, M, d, a, R.fp * rm * .8, rand, rep, apply, 1, 'return fire'); CW.useAmmo(d); }
  for (const d of defs) if (!d.gone) { const th = 30 + (arc === 'rear' ? 15 : arc === 'flank' ? 8 : 0); const r = breakCheck(G, M, d, hx(a), rand, rep, apply, th - d.st); if (apply && r !== 'holds') moraleSwing(G, a.side, d.side, r === 'surrenders' ? 5 : r === 'routs' ? 3 : 1); }
  if (apply) { a.fired = 1; a.acted = 1; a.mp = a.type === 'art' ? 0 : Math.max(0, a.mp - CW.FIRE_MP); }
  return { kind: 'volley', arc, rep, mods: F.mods.concat(arc !== 'front' ? [[`Hitting its ${arc}`, am]] : []) };
};
// ---------- assaults ----------
CW.resolveAssault = function (G, M, a, t, charge, rand = Math.random, apply = true) {
  const rep = [], from = hx(a), defs = CW.bodies(G, t.c, t.r).filter(x => x.side !== a.side).sort((x, y) => (x.type === 'art') - (y.type === 'art')), [am, rm, arc] = CW.arcMult(t, from), d = CW.dirTo(from, hx(t));
  let out = { kind: charge ? 'charge' : 'assault', arc, rep, mods: [], result: 'repulsed' };
  if (apply) { if (a.type === 'inf' && a.form === 'march') a.form = 'combat'; a.mp = 0; a.assaulted = 1; a.acted = 1; a.face = d; }
  // will they go in?
  const nerve = a.mor + a.st * 2 + (M.h(a.c, a.r) > M.h(t.c, t.r) ? 5 : 0) - (M.h(t.c, t.r) - M.h(a.c, a.r)) * 6;
  if (nerve < (charge ? 70 : 50)) { rep.push({ who: a.id, text: charge ? 'refuses to charge' : 'refuses to advance' }); out.result = 'refused'; if (apply) a.org = cl(a.org - 3); return out; }
  if (!CW.retreatHex(G, M, a, hx(t))) out.mods.push(['No line of retreat — failure means rout', 1]);
  const crossing = M.edge(a.c, a.r, d); let atkMult = am; if (crossing) { atkMult *= .9; out.mods.push([`Crossing ${[...crossing].map(x => CW.EDGES[x].n.toLowerCase()).join(' & ')}`, .9]); if (apply) a.org = cl(a.org - 5); }
  const dh = M.h(t.c, t.r) - M.h(a.c, a.r); if (dh > 0) out.mods.push([`Assaulting uphill (${dh})`, 1]); if (dh < 0 && charge) { atkMult *= 1.15; out.mods.push(['Charging downhill', 1.15]); }
  const surprise = defs.some(x => CW.isColumn(x) && ['inf', 'art'].includes(x.type)) || arc !== 'front';
  const volley = (shooter, target, kind, mult, label) => { const F = CW.firepower(G, M, shooter, target, kind); if (shooter === a) out.mods.push(...F.mods); hit(G, M, shooter, target, F.fp * mult, rand, rep, apply, 1, label); CW.useAmmo(shooter, charge ? 2 : 1); };
  const defFire = () => defs.forEach(x => { if (!x.gone && x.sp > 0 && !['hq', 'ldr', 'scout'].includes(x.type)) volley(x, a, 'defend', (surprise ? rm : 1) * (dh > 0 ? 1 + .1 * dh : 1), 'defensive fire'); });
  if (surprise) { out.mods.push([arc !== 'front' ? `Hitting its ${arc}: you fire first` : 'Enemy caught in column: you fire first', atkMult]); volley(a, defs[0], charge ? 'charge' : 'assault', atkMult, charge ? 'charge volley' : 'volley'); defFire(); }
  else { defFire(); if (a.mor < 30) { rep.push({ who: a.id, text: 'breaks under fire' }); const r = breakCheck(G, M, a, hx(t), rand, rep, apply, 45); out.result = r === 'holds' ? 'repulsed' : 'broken'; return out; }
    volley(a, defs[0], charge ? 'charge' : 'assault', atkMult, charge ? 'charge volley' : 'volley'); }
  if (charge) { // hand to hand
    const aw = CW.weapon(a), dw = CW.weapon(defs[0]), shock = a.mor > 70 ? 1.3 : 1; out.mods.push(['Bayonets / sabres (hand-to-hand)', shock]);
    const mountedCharge = a.type === 'cav' && a.form === 'mounted';
    hit(G, M, a, defs[0], a.men[2] / 100 * (aw.hh || 40) / 50 * shock * (mountedCharge ? 1.4 : 1), rand, rep, apply, 1, 'hand-to-hand');
    hit(G, M, defs[0], a, defs[0].men[2] / 100 * (dw.hh || 30) / 50 * (mountedCharge && !surprise ? 1.3 : 1), rand, rep, apply, 1, 'hand-to-hand');
  }
  // defender decides: hold or give way
  let broke = false;
  for (const x of defs) { if (x.gone) continue;
    const ratio = Math.max(.25, Math.min(4, a.men[2] / Math.max(1, x.men[2])));
    const pressure = (charge ? 56 : 52) + (arc === 'rear' ? 25 : arc === 'flank' ? 15 : 0) + 12 * Math.log2(ratio) - CW.coverVs(M, x, from).cov * 4 - (x.st - 5) * 2 - (x.type === 'art' && x.form === 'unl' ? 8 : 0);
    const pBreak = 1 / (1 + Math.exp((x.mor - pressure) / 7));
    const r = rand() < pBreak ? giveWay(G, M, x, from, rand, rep, apply, rand() < .25 + Math.max(0, pressure - x.mor) / 60) : 'holds';
    if (r !== 'holds') broke = true; if (apply && r !== 'holds') moraleSwing(G, a.side, x.side, r === 'surrenders' ? 6 : r === 'routs' ? 4 : 2); }
  if (broke && defs.every(x => x.gone || x._left || x.c !== t.c || x.r !== t.r)) { out.result = 'carried'; rep.push({ who: a.id, text: 'carries the position' });
    if (apply) { a.c = t.c; a.r = t.r; a.dug = 0; G.supply[a.side] += 2; } }
  else { out.result = broke ? 'partial' : 'repulsed'; if (!broke) { rep.push({ who: a.id, text: 'is repulsed' }); const r = breakCheck(G, M, a, hx(t), rand, rep, apply, 38 - a.st); if (apply) { a.org = cl(a.org - 6); moraleSwing(G, t.side, a.side, 1); } } }
  return out;
};
// ---------- prediction for the hover preview (Monte Carlo on copies) ----------
CW.predict = function (G, M, a, t, mode) {
  const N = 60, ids = new Set([a.id, ...CW.bodies(G, t.c, t.r).map(x => x.id)]); let sum = { dealt: 0, taken: 0, carried: 0, broke: 0, refused: 0 }, mods = [], arc = 'front';
  let seed = 12345; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < N; i++) {
    const units = G.units.map(u => ids.has(u.id) ? JSON.parse(JSON.stringify(u)) : u), S = { ...G, units, morale: { ...G.morale }, supply: { ...G.supply } };
    const A = units.find(u => u.id === a.id), T = units.find(u => u.id === t.id);
    const r = mode === 'fire' ? CW.resolveFire(S, M, A, T, rnd, false) : CW.resolveAssault(S, M, A, T, mode === 'charge', rnd, false);
    mods = r.mods; arc = r.arc; r.rep.forEach(x => { if (x.cas) { if (x.who === a.id) sum.taken += x.cas; else sum.dealt += x.cas; } if (x.text && x.who !== a.id && /falls back|routs|surrenders/.test(x.text)) sum.broke++; });
    if (r.result === 'carried') sum.carried++; if (r.result === 'refused') sum.refused++;
  }
  return { dealt: Math.round(sum.dealt / N), taken: Math.round(sum.taken / N), carry: Math.round(sum.carried / N * 100), brk: Math.round(sum.broke / N * 100), refuse: Math.round(sum.refused / N * 100), mods, arc,
    cover: CW.coverVs(M, t, hx(a)) };
};
// ---------- routed units & rally ----------
CW.rally = function (G, M, u) { if (!u.routed) return 'Not routed'; if (G.morale[u.side] < 3) return 'Not enough army morale (needs 3)';
  G.morale[u.side] -= 3; const L = CW.leaderOf(G.units, u), near = L && CW.dist(hx(L), hx(u)) <= 2; const D = CW.divOf(G.units, u), p = .3 + u.st * .04 + (near ? .2 : 0) + (D && CW.corpsBonus(G.units, D) ? .1 : 0);
  if (Math.random() < p) { u.routed = 0; u.mor = Math.max(u.mor, 35); u.org = Math.max(u.org, 25); return 'rallied'; } return 'failed'; };
CW.routedMove = function (G, M, u) { // flee toward the nearest own supply source; leave the field when there
  const srcs = M.supply.filter(s => s[2] === u.side).map(s => [s[0], s[1]]); if (!srcs.length) return;
  const goal = srcs.sort((p, q) => CW.dist(hx(u), p) - CW.dist(hx(u), q))[0];
  if (CW.dist(hx(u), goal) === 0) { u.gone = 1; u.fled = 1; return 'left the field'; }
  const L = CW.leaderOf(G.units, u); if (L && CW.dist(hx(L), hx(u)) <= 2 && Math.random() < .2 + u.st * .03) { u.routed = 0; u.mor = Math.max(u.mor, 30); return 'rallied on its own'; }
  u.mp = CW.maxMP(u); const rc = CW.reach(M, u, G.units, G.weather); let best = null, bd = CW.dist(hx(u), goal);
  rc.forEach((v, k) => { const h = CW.unkey(k), d = CW.dist(h, goal); if (d < bd) { bd = d; best = h; } });
  if (best) { u.c = best[0]; u.r = best[1]; } u.mp = 0; u.org = cl(u.org - 3); return 'flees';
};
