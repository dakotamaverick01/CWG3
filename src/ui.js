'use strict';
// Information panel: leader, unit, terrain (incl. hex-edge features and flank preview).
(function () {
const $ = id => document.getElementById(id), DIRN = ['E', 'SE', 'SW', 'W', 'NW', 'NE'];
const bar = (v, col) => `<div class="bar"><i style="width:${v}%;background:${col}"></i></div>`;
const colr = v => v > 75 ? '#4cae5c' : v > 55 ? '#d9a93a' : '#cf4a36';
function portrait(u) { const p = CW.SIDE[u.side]; return `<svg class="portrait" viewBox="0 0 74 84"><rect width="74" height="84" fill="#2a1d13"/><circle cx="37" cy="32" r="15" fill="#c9a582"/>
 <path d="M10 84 Q12 54 37 52 Q62 54 64 84Z" fill="${p.coat}"/><rect x="22" y="14" width="30" height="8" rx="2" fill="${p.cap}"/><path d="M30 42 Q37 50 44 42 Q41 47 37 47 Q33 47 30 42Z" fill="#6b5a45"/>${u.type === 'hq' ? '<circle cx="28" cy="64" r="2.5" fill="#f3e3a0"/><circle cx="46" cy="64" r="2.5" fill="#f3e3a0"/>' : ''}</svg>`; }
CW.panel = function (G, M) {
  const L = $('leader'), U = $('unit'), u = G.sel;
  if (!u) { L.innerHTML = '<div class="muted" style="padding-top:30px;text-align:center">No unit selected</div>';
    U.innerHTML = `<h3>Millbrook — map engine test</h3><div class="sub"><b>Command regiment by regiment, as in CWG2:</b> click one of your units (gold ring = can move, crimson = can fire), then click a highlighted hex to move or a red-ringed enemy to fire (Shift-click = assault). F changes formation, Q/W turn, Tab jumps to the next unit that can act. Keep regiments near their colonel (★) to stay in command. Hover to preview the route and its cost. Dashed red hexes are enemy zones of control — only in front of an enemy line, so you can slip around a flank. Try the LOS tool (L) from the valley toward the ridge to see dead ground. R rests a unit, D digs in, E ends the turn, M opens the menu.</div>`;
    CW.panelTerrain(G, M); return; }
  const bl = CW.leaderOf(G.units, u), lname = u.ldr || (bl && bl.ldr) || '—';
  const stars = Math.round(u.st / 2); L.innerHTML = portrait(u) + `<div class="lname">${u.type === 'ldr' || u.type === 'hq' || u.ldr ? '' : 'Brigade: '}${lname}</div>`;
  L.innerHTML += `<div class="swords">${'⚔'.repeat(stars)}<span style="opacity:.3">${'⚔'.repeat(5 - stars)}</span> ${u.st}/10</div>`;
  if (G.group) { const ms = G.group.filter(x => x.type !== 'ldr'), men = ms.reduce((t, x) => t + x.men[2], 0), avg = k => Math.round(ms.reduce((t, x) => t + x[k], 0) / ms.length), inC = ms.filter(x => CW.inCommand(G.units, x)).length, own = u.side === G.side;
    U.innerHTML = CW.chainHtml(G, u) + `<h3>${u.level === 'div' ? u.divName : u.bdeName || u.name}</h3><div class="sub">${ms.length} units · ${men.toLocaleString()} effective men · ${inC}/${ms.length} in command (radius ${CW.cmdRadius(u, G.units)} hexes)</div>
    <div class="stats"><div class="stat"><b>ORG</b>${bar(avg('org'), colr(avg('org')))}${avg('org')}</div><div class="stat"><b>HLTH</b>${bar(avg('hlth'), colr(avg('hlth')))}${avg('hlth')}</div><div class="stat"><b>MOR</b>${bar(avg('mor'), colr(avg('mor')))}${avg('mor')}</div></div>
    <div class="small" style="margin-top:6px">${own ? (() => { const cs = CW.ORD ? CW.ORD.colonels(G.units, u.level === 'div' ? u : CW.ORD.colonelOf(G.units, u) || u) : [], od = cs.find(c => c.order);
      if (u.level !== 'div' && own && CW.inContact()) { const hot = ms.filter(x => CW.actInfo().can.has(x.id)).length; return `<b style="color:#ff8a6a">In contact:</b> ${hot} battalion${hot === 1 ? '' : 's'} can fire. <b>Click a red-ringed enemy</b> — every battalion that can reach it fires (hover to see who). Shift+click = assault. <b>Tab</b> steps through the battalions that can still act · <b>K</b> done here.`; }
      if (u.level !== 'div') return `<b>Brigade:</b> click a hex — the whole brigade moves there this turn, keeping its shape (hover to preview; shaded = out of reach). <b>Q/W</b> turn in place. Then the next brigade waiting for orders (gold ring) comes up by itself. <b>K</b> hold here · <b>N</b> skip for now.${CW.corpsBonus ? '' : ''}`;
      return `<b>Division:</b> <b>drag</b> a line where the division should stand (arrow = facing) · <b>click</b> = go there · click the general again = stop. The order carries on by itself each turn until the brigades are in place.${CW.corpsBonus(G.units, u) ? ' <b>★ Corps HQ in range: +1 command radius, better rallies.</b>' : ''}<br>${od ? `Order: ${cs.filter(c => c.order && c.order.done).length}/${cs.filter(c => c.order).length} brigades in position${cs.some(c => c.order && c.order.contact) ? ' · <b style="color:#ffcf7a">halted — enemy in sight, drag a new line to press on</b>' : ''}` : 'No order — holding.'}`; })() : ''}</div><div class="bchips">${ms.map(x => { const fire = own && CW.actInfo().can.has(x.id), mv = own && CW.canActNow(x) && x.mp >= 1; return `<span class="bchip ${fire ? 'cf' : mv ? 'cm' : 'cd'}" data-uid="${x.id}" title="${x.name}">${x.detached ? '↗ ' : ''}${x.name.replace(/ \(([RL])\. wing\)/, ' $1')}${own ? ` <b>${Math.floor(x.mp)}</b>${fire ? ' ⌖' : ''}` : ''}</span>`; }).join('')}</div>
    ${own ? `<div class="btns">${u.level === 'bde' ? `<button data-act="Q"><u>Q</u> Turn ⟲</button><button data-act="W"><u>W</u> Turn ⟳</button><button data-act="K" title="No move this turn — mark this brigade done">Hold (<u>K</u>)</button><button data-act="N" title="Leave this brigade for now">Next brigade (<u>N</u>)</button>` : ''}<button data-act="R">All: <u>R</u>est</button><button data-act="D">All: <u>D</u>ig in</button><button data-act="U"><u>U</u>ndo</button><button data-act="E"><u>E</u>nd turn</button></div>` : ''}`;
    U.querySelectorAll('[data-act]').forEach(b => b.onclick = () => CW.act(b.dataset.act)); U.querySelectorAll('[data-uid]').forEach(b => b.onclick = () => CW.select(G.units.find(x => x.id === +b.dataset.uid))); CW.panelTerrain(G, M); return; }
  const [o, a, e] = u.men, own = u.side === G.side;
  const cmd = u.type === 'ldr' || u.type === 'hq' ? '' : CW.inCommand(G.units, u) ? ' · in command' : ' · <b style="color:#ff9a6a">OUT OF COMMAND (¾ movement)</b>';
  U.innerHTML = CW.chainHtml(G, u) + `<h3>${u.name}</h3><div class="sub">${cmd ? cmd.replace(/^ · /, '') + '<br>' : ''}${u.side === 'CS' ? 'Confederate' : 'Union'} ${CW.TYPES[u.type].n}${u.guns ? ` (${u.guns} guns)` : ''} · ${CW.FORMN[u.form]} · facing ${DIRN[u.face]}${u.digging ? ' · digging in' : u.dug ? ' · dug in' : ''}${u.rested ? ' · resting' : ''} · ${u.wpn}</div>
  <div class="tri"><i style="width:${(o - a) / o * 100}%;background:#3a2a22"></i><i style="width:${(a - e) / o * 100}%;background:#b89a5a"></i><i style="width:${e / o * 100}%;background:#6e8f4a"></i></div>
  <div class="small">Men ${o.toLocaleString()} → ${a.toLocaleString()} alive · <b>${e.toLocaleString()} effective</b> · sight ${CW.TYPES[u.type].sight} hexes</div>
  <div class="stats"><div class="stat"><b>ORG</b>${bar(u.org, colr(u.org))}${u.org}</div><div class="stat"><b>HLTH</b>${bar(u.hlth, colr(u.hlth))}${u.hlth}</div><div class="stat"><b>MOR</b>${bar(u.mor, colr(u.mor))}${u.mor}</div>
  <div class="stat"><b>MP</b>${own ? u.mp : '?'} / ${CW.maxMP(u)}</div><div class="stat"><b>SP</b>${u.sp} rounds</div><div class="stat"><b>ZOC</b>${CW.exertsZOC(u) ? (CW.TYPES[u.type].zocAll ? 'all round' : 'front arc') : 'none'}</div></div>
  ${own ? `<div class="btns"><button data-act="F"><u>F</u>ormation</button><button data-act="Q"><u>Q</u> ⟲</button><button data-act="W"><u>W</u> ⟳</button><button data-act="R"><u>R</u>est</button><button data-act="D"><u>D</u>ig in</button><button data-act="U"><u>U</u>ndo</button><button data-act="K">S<u>k</u>ip</button><button data-act="B"><u>B</u>rigade</button><button data-act="A"><u>A</u>ttack mode</button>${u.routed ? '<button data-act="Y">Rall<u>y</u> (3 morale)</button>' : ''}<button data-act="N"><u>N</u>ext</button><button data-act="E"><u>E</u>nd turn</button></div>` : ''}`;
  U.querySelectorAll('[data-act]').forEach(b => b.onclick = () => CW.act(b.dataset.act));
  CW.panelTerrain(G, M);
};
CW.panelTerrain = function (G, M) {
  const el = $('terrain'), h = G.hover || (G.sel ? [G.sel.c, G.sel.r] : null);
  if (!h) { el.innerHTML = '<div class="tname">Terrain</div><div class="tline muted">Hover over the map</div>'; return; }
  const T = CW.TERRAIN[M.ter(...h)], rd = M.roadAt.get(CW.key(...h)), sunk = M.sunkenSet.has(CW.key(...h));
  const edges = {}; for (let d = 0; d < 6; d++) { const e = M.edge(...h, d); if (e) e.forEach(t => (edges[t] = edges[t] || []).push(DIRN[d])); }
  const feats = [rd ? (sunk ? 'Sunken road' : rd.major ? 'Major road' : 'Minor road') : ''].filter(Boolean);
  let lines = `Height ${M.h(...h)} · Cover ${CW.coverAt(M, ...h) >= 0 ? '+' : ''}${CW.coverAt(M, ...h)}${T.obs ? (T.light ? ' · screens sight (2 hexes block)' : ` · blocks sight (+${T.obs})`) : ''}`;
  lines += `<br>Move ${T.col > 50 ? 'impassable (engineers only)' : `${T.col} MP column / ${T.line} MP line`}`;
  for (const t in edges) lines += `<br><b>${CW.EDGES[t].n}</b> on ${edges[t].join(', ')} side · +${CW.EDGES[t].cover} cover vs attacks across it`;
  if (T.woods) lines += '<br><i>Woods: guns can’t fire through; close-range fighting is bloody</i>';
  if (T.open) lines += '<br><i>Open ground: field of fire for defenders</i>';
  const u = G.sel;
  if (u && u.side === G.side && G.group) { const en = CW.bodiesAt(G.units, ...h).find(o => o.side !== u.side && o.type !== 'ldr' && (!G.opts.fog || G.vis.has(o.id))); if (en) lines = CW.groupPreviewHtml(G, M, en) + '<hr>' + lines; }
  if (u && u.side === G.side && G.reach) { const k = CW.key(...h); if (G.reach.has(k)) lines += `<br><b>Reachable</b> · ${Math.round(G.reach.get(k).cost * 10) / 10} of ${u.mp} MP`;
    const en = CW.bodiesAt(G.units, ...h).find(o => o.side !== u.side && (!G.opts.fog || G.vis.has(o.id)));
    if (en) lines = CW.previewHtml(G, M, u, en) + '<hr>' + lines; }
  el.innerHTML = `<div class="tname">${T.n}${feats.length ? ' · ' + feats.join(', ') : ''}</div><div class="tline">${lines}</div>`;
};
})();

// ---------- combat preview & report ----------
const pcache = {};
// brigade selected, hovering an enemy: who fires and the expected result of the whole volley
CW.groupPreviewHtml = function (G, M, en) {
  const ms = G.group.filter(x => x.type !== 'ldr' && !x.gone), mode = G.attackMode, shoot = ms.filter(x => mode === 'fire' ? !CW.canFire(G, M, x, en) : !CW.canAssault(G, M, x, en));
  const MN = { fire: 'Brigade volley', assault: 'Brigade assault', charge: 'Brigade charge' };
  if (!shoot.length) return `<b>${MN[mode]} on ${en.name}:</b> <span class="warn">no battalion can reach it</span>`;
  let dealt = 0, taken = 0, brk = 0; shoot.forEach(x => { const k = [x.id, en.id, mode, x.mp, x.c, x.r, en.c, en.r, en.men[2], x.men[2], G.turn].join('|'); const p = pcache[k] || (pcache[k] = CW.predict(G, M, x, en, mode)); dealt += p.dealt; taken += p.taken; brk = Math.max(brk, p.brk); });
  return `<b style="color:#ff9a7a">${MN[mode]} → ${en.name}</b><br>${shoot.length} of ${ms.length} battalions fire: ${shoot.map(x => x.name.replace(/ \(([RL])\. wing\)/, ' $1')).join(', ')}<br>Inflict ~<b>${dealt}</b> · take ~<b>${taken}</b>${brk ? ` · target gives way ${brk}%+` : ''}${mode === 'fire' ? ' · <span class="muted">Shift+click = assault</span>' : ''}`;
};
CW.previewHtml = function (G, M, u, en) {
  const mode = G.attackMode, why = mode === 'fire' ? CW.canFire(G, M, u, en) : CW.canAssault(G, M, u, en), MN = { fire: 'Volley', assault: 'Assault', charge: 'Charge' };
  const alt = mode === 'fire' && !CW.canAssault(G, M, u, en) ? ' · Shift+click to assault' : '';
  if (why) return `<b>${MN[mode]} on ${en.name}:</b> <span class="warn">${why}</span><br><span class="muted">A switches Volley / Assault / Charge${alt}</span>`;
  const k = [u.id, en.id, mode, u.mp, u.c, u.r, en.c, en.r, en.men[2], u.men[2], G.turn].join('|'); const p = pcache[k] || (pcache[k] = CW.predict(G, M, u, en, mode));
  const pct = m => m === 1 || m === 0 ? '' : ` ${m > 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%`;
  const mods = p.mods.map(([l, m]) => `${l}${pct(m)}`).concat(p.cover.mods.map(x => `Target: ${x[0]}`));
  const res = mode === 'fire' ? `Inflict ~<b>${p.dealt}</b> · take ~<b>${p.taken}</b> · target gives way ${p.brk}%` : `Inflict ~<b>${p.dealt}</b> · take ~<b>${p.taken}</b> · <b>carry the position ${p.carry}%</b>${p.refuse ? ` · refuse ${p.refuse}%` : ''}`;
  return `<b style="color:#9dffae">${MN[mode]} → ${en.name}</b> (${p.arc})${alt}<br>${res}<br><span class="small">${mods.join(' · ')}</span>`;
};
CW.report = function (G, res, a, t) {
  const el = document.getElementById('report'), nm = id => (G.units.find(x => x.id === id) || {}).name || '?', MN = { volley: 'Volley', assault: 'Assault', charge: 'Charge' };
  const lines = res.rep.filter(x => x.cas !== undefined || x.text).map(x => x.cas !== undefined ? `${nm(x.who)}: <b>${x.cas ? '−' + x.cas : 'no loss'}</b> <span class="muted">(${x.label})</span>` : x.ldr ? `<span class="warn">${x.text}</span>` : `${nm(x.who)} <b>${x.text}</b>`);
  const head = res.result ? { carried: 'Position carried!', repulsed: 'Repulsed', refused: 'Attack refused', broken: 'Attack broken', partial: 'Partial success' }[res.result] : '';
  el.innerHTML = `<div class="rt">${MN[res.kind]}: ${a.name} → ${t.name}${res.arc !== 'front' ? ` <span class="warn">(${res.arc})</span>` : ''}</div>${head ? `<div class="rr">${head}</div>` : ''}${lines.join('<br>')}`;
  el.classList.add('show'); clearTimeout(CW.report.h); CW.report.h = setTimeout(() => el.classList.remove('show'), 6500); el.onclick = () => el.classList.remove('show');
};

CW.chainHtml = function (G, u) {
  const lab = x => x.type === 'hq' ? x.name.replace(' HQ', '') : x.level === 'div' ? x.divName : x.level === 'bde' ? x.bdeName : x.name;
  return '<div class="chain">' + CW.chain(G.units, u).map(x => { const ok = CW.inCommand(G.units, x);
    return `<span class="lk" data-id="${x.id}" title="${x.ldr || x.name}${ok ? '' : ' — out of command'}"><i style="background:${ok ? '#5ccf6a' : '#e0553f'}"></i>${x.color && x.type !== 'hq' ? `<b style="color:${x.color}">■</b> ` : ''}${lab(x)}</span>`; }).join(' › ') + '</div>';
};
document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('.chain .lk'); if (!el) return; const x = CW.G.units.find(u => u.id === +el.dataset.id); if (!x) return;
  if (x.type === 'ldr') CW.selectGroup(x); else CW.select(x); CW.centerOn(x.c, x.r); });
