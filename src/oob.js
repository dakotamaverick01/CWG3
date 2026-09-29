'use strict';
// Order of battle: Corps HQ → Division (general on map) → Brigade (colonel on map) → Regiment → Battalion.
// V1 (CWG2 scale): each regiment is one unit; brigades auto-deploy in line around an anchor hex.
CW.bnSize = men => men < 250 ? 1 : men < 450 ? 2 : 3;
CW.bnNames = (reg, n, cav) => n === 1 ? [reg] : n === 2 ? [`${reg} (R. wing)`, `${reg} (L. wing)`] : [...Array(n).keys()].map(i => `${reg}, ${['1st', '2nd', '3rd', '4th'][i]} ${cav ? 'Sqn' : 'Bn'}`);
CW.BDE_COLORS = { CS: ['#e8b94a', '#6fb7e0', '#e0776a', '#8fd06a', '#c99ae6', '#f0f0f0', '#e89a3c'], US: ['#f2d36b', '#7fd6c8', '#ff8f7a', '#a6e27a', '#d6a6ff', '#ffffff', '#ffb35c'] };
let NEXT_ID = 1;
CW.resetIds = n => { NEXT_ID = n || 1; };
CW.deployHexes = function (M, units, anchor, face, n) {
  const a = CW.center(...anchor), ang = face * Math.PI / 3, f = [Math.cos(ang), Math.sin(ang)], p = [-f[1], f[0]];
  return M.all.filter(h => CW.dist(h, anchor) <= 4 && M.ter(...h) !== 'w' && !CW.unitsAt(units, ...h).some(u => u.type !== 'ldr'))
    .map(h => { const c = CW.center(...h), dx = c[0] - a[0], dy = c[1] - a[1]; return [h, Math.abs(dx * f[0] + dy * f[1]) * 3 + Math.abs(dx * p[0] + dy * p[1])]; })
    .sort((x, y) => x[1] - y[1]).slice(0, n).map(x => x[0]);
};
// brigade identity: color + tag "brigade/division" (e.g. 2/1 = 2nd Brigade, 1st Division); independent brigades tagged "C"
CW.brigadeMeta = function (units, side, b) {
  const known = [...new Set(units.filter(u => u.side === side && u.bde).map(u => u.bde))], idx = known.includes(b.id) ? known.indexOf(b.id) : known.length;
  const color = CW.BDE_COLORS[side][idx % CW.BDE_COLORS[side].length];
  const D = b.div && units.find(u => u.level === 'div' && u.div === b.div && u.side === side);
  const bdeNo = b.div ? [...new Set(units.filter(u => u.div === b.div && u.bde && u.side === side).map(u => u.bde))].filter(x => x !== b.id).length + 1 : 0;
  return { bde: b.id, bdeName: b.name, div: b.div || null, divName: D ? D.divName : null, color, tag: b.div ? `${bdeNo}/${D ? D.divNo : '?'}` : 'C' };
};
CW.buildBrigade = function (M, units, side, b) {
  const out = [], face = b.face ?? (side === 'CS' ? 3 : 0), meta = CW.brigadeMeta(units, side, b);
  const bns = []; (b.regs || []).forEach(rg => { const n = 1 /* V1: one regiment = one unit */, names = CW.bnNames(rg.name, n, rg.type === 'cav');
    names.forEach(nm => bns.push({ type: rg.type || 'inf', name: nm, reg: rg.name, men0: Math.round(rg.men / n), wpn: rg.wpn || (side === 'CS' ? 'Enfield RF' : 'Springfield RF'), q: rg.q || 60 })); });
  const spots = CW.deployHexes(M, units.concat(out), [b.c, b.r], face, bns.length);
  bns.forEach((bn, i) => { const h = spots[i] || [b.c, b.r], men = bn.men0, eff = Math.round(men * .92);
    const u = { id: NEXT_ID++, side, type: bn.type, ...meta, reg: bn.reg, name: bn.name, form: b.form || (bn.type === 'cav' ? 'mounted' : 'combat'), face, c: h[0], r: h[1],
      men: [men, men, eff], org: 85 + (i * 7) % 10, hlth: 88 + (i * 5) % 9, mor: 76 + (i * 11) % 14, sp: 10, wpn: bn.wpn, st: b.st || 5, size: CW.bnSize(men), q: bn.q };
    if (bn.type === 'cav' && u.form === 'combat') u.form = 'mounted'; out.push(u); units.push(u); });
  if (b.ldr) { const back = CW.step(b.c, b.r, (face + 3) % 6), h = M.in(...back) && M.ter(...back) !== 'w' ? back : [b.c, b.r];
    const L = { id: NEXT_ID++, side, type: 'ldr', level: 'bde', ...meta, name: b.ldr, ldr: b.ldr, form: 'mounted', face, c: h[0], r: h[1], men: [12, 12, 12], org: 99, hlth: 95, mor: 90, sp: 0, wpn: 'Pistol & sabre', st: b.st || 5, size: 1 };
    out.push(L); units.push(L); }
  return out;
};
CW.buildDivision = function (units, side, d, no) {
  const L = { id: NEXT_ID++, side, type: 'ldr', level: 'div', div: d.id, divName: d.name, divNo: no, name: d.ldr, ldr: d.ldr, form: 'mounted', face: side === 'CS' ? 3 : 0, c: d.c, r: d.r,
    men: [15, 15, 15], org: 99, hlth: 95, mor: 90, sp: 0, wpn: 'Pistol & sabre', st: d.st || 6, size: 1, color: '#f3e3a0', tag: `${no} Div` };
  units.push(L); return L; };
CW.buildSingle = function (units, side, s) { const men = s.men, u = { id: NEXT_ID++, side, type: s.type, bde: s.bde || null, bdeName: s.bdeName || null, div: s.div || null, color: s.color || '#bbbbbb', tag: s.tag || 'C', name: s.name, reg: s.name, ldr: s.ldr, form: s.form, face: s.face ?? (side === 'CS' ? 3 : 0), c: s.c, r: s.r,
  men: [men, men, Math.round(men * .95)], org: 90, hlth: 92, mor: 82, sp: s.type === 'art' ? 14 : 10, wpn: s.wpn, st: s.st || 6, size: s.guns ? (s.guns >= 6 ? 3 : 2) : CW.bnSize(men), guns: s.guns }; units.push(u); return u; };
CW.buildArmy = function (M, oob) {
  CW.resetIds(1); const units = [];
  for (const side of ['CS', 'US']) { const A = oob[side];
    (A.singles || []).forEach(s => CW.buildSingle(units, side, s));
    (A.divisions || []).forEach((d, i) => CW.buildDivision(units, side, d, i + 1));
    (A.brigades || []).forEach(b => { const made = CW.buildBrigade(M, units, side, b), m = made[0];
      (b.attached || []).forEach(s => CW.buildSingle(units, side, { ...s, bde: b.id, bdeName: b.name, div: m.div, color: m.color, tag: m.tag })); }); }
  return units;
};
// ---------- command chain ----------
CW.divOf = (units, x) => x.div ? units.find(l => l.level === 'div' && l.div === x.div && l.side === x.side && !l.gone) : null;
CW.hqOf = (units, x) => units.find(h => h.type === 'hq' && h.side === x.side && !h.gone);
CW.leaderOf = (units, u) => { if (u.type === 'hq') return null; if (u.level === 'div') return CW.hqOf(units, u); if (u.level === 'bde') return CW.divOf(units, u) || CW.hqOf(units, u);
  return (u.bde && units.find(l => l.level === 'bde' && l.bde === u.bde && !l.gone)) || CW.divOf(units, u) || CW.hqOf(units, u); };
CW.reachOf = L => L.type === 'hq' ? 8 : L.level === 'div' ? 6 + (L.st >= 7 ? 1 : 0) : 3 + (L.st >= 7 ? 1 : 0);
// a brigadier cut off from his division general commands a smaller radius
// corps bonus: a division general within the Corps HQ's radius commands +1 hex (no penalty outside it)
CW.corpsBonus = (units, D) => { if (!units || D.level !== 'div') return false; const H = CW.hqOf(units, D); return !!H && CW.dist([H.c, H.r], [D.c, D.r]) <= CW.reachOf(H); };
CW.cmdRadius = (L, units) => { if (L.level === 'div') return CW.reachOf(L) + (CW.corpsBonus(units, L) ? 1 : 0); if (L.type === 'hq' || !units) return CW.reachOf(L); return CW.leaderInCommand(units, L) ? CW.reachOf(L) : 2; };
CW.leaderInCommand = (units, L) => { if (L.level === 'div') return true; const up = CW.leaderOf(units, L); return !up || CW.dist([up.c, up.r], [L.c, L.r]) <= CW.reachOf(up); };
CW.inCommand = (units, u) => { if (u.type === 'hq') return true; if (u.type === 'ldr') return CW.leaderInCommand(units, u); const L = CW.leaderOf(units, u); if (!L) return false;
  return CW.dist([L.c, L.r], [u.c, u.r]) <= CW.cmdRadius(L, units); };
// group for orders: a brigade (via its colonel or any battalion) or a whole division (via its general)
CW.brigadeOf = (units, u) => u.level === 'div' ? units.filter(x => x.div === u.div && x.side === u.side && !x.gone) : u.bde ? units.filter(x => x.bde === u.bde && x.side === u.side && !x.gone) : [u];
CW.chain = (units, u) => { const out = [u]; let x = u; for (let i = 0; i < 4; i++) { x = CW.leaderOf(units, x); if (!x) break; out.unshift(x); } return out; };
