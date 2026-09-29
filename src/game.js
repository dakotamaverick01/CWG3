'use strict';
// Game controller: state, input, drawing, turn flow. Combat arrives in Phase 4 (hotseat until AI).
(function () {
const M = CW.loadMap(window.MAP_DEMO), R = CW.R, [MW, MH] = CW.mapSize(M);
const G = CW.G = { opts: CW.loadOpts(), units: [], reinf: [], side: 'CS', player: 'CS', turn: 1, minutes: 480, weather: 'clear', supply: { CS: 400, US: 600 }, morale: { CS: 50, US: 50 }, endAt: 2160,
  sel: null, reach: null, hover: null, tool: { los: false, heights: false, sight: false }, undo: [], vis: new Set(), cam: { x: 0, y: 0, z: 1 }, started: false };
CW.M = M;
const cv = document.getElementById('map'), sx = cv.getContext('2d'), mapCache = {}, glc = document.getElementById('gl');
let cx = sx;   // cx = where the current layer draws: the screen, or (3D battlefield) the markings decal laid over the hills
if (CW.R3 && glc) CW.R3.init(M, glc);
const is3D = CW.is3D = () => !!(CW.R3 && CW.R3.on(G.opts));
const $ = id => document.getElementById(id), byId = id => G.units.find(u => u.id === id), mine = () => G.units.filter(u => u.side === G.side && !u.gone);
const clamp = v => Math.max(0, Math.min(99, Math.round(v)));
const sideName = s => s === 'CS' ? 'Confederate' : 'Union';
function terrainImg() { M.weather = G.weather; const k = G.weather === 'mud' || G.weather === 'rain' ? 'wet' : 'dry';
  // if the browser threw the painted map away (low graphics memory), paint it again instead of drawing garbage
  const c = mapCache[k]; if (c && c.getContext && c.getContext('2d').isContextLost && c.getContext('2d').isContextLost()) { console.warn('map canvas lost, repainting'); delete mapCache[k]; }
  for (const o in mapCache) if (o !== k) delete mapCache[o];   // keep only the current weather's map in memory
  return mapCache[k] || (mapCache[k] = CW.renderMap(M, G.weather)); }
CW.terrainImg = terrainImg;
function refreshVis() { G.vis = CW.visibleEnemies(M, G.units, G.side, G.weather); G._visGen = (G._visGen || 0) + 1; clearAct(); updateObjectives(); }
// ---------- computer opponent (src/ai.js) ----------
// G.opp: 'ai' = computer plays the side you didn't pick · 'hotseat' = two players · 'auto' = computer plays both (testing)
const isAI = CW.isAI = side => G.opp === 'auto' || (G.opp === 'ai' && side !== G.player);
const viewSide = () => G.opp === 'hotseat' ? G.side : G.opp === 'auto' ? G.side : G.player;
// while the computer moves, draw from the player's side: their fog, their roster, no selection
function asViewer(fn) { const vs = viewSide(); if (G._view) return fn(); if (vs === G.side) { G._view = 2; try { return fn(); } finally { G._view = 0; } }
  const keep = { side: G.side, vis: G.vis, sel: G.sel, group: G.group, reach: G.reach };
  if (G._pvisGen !== G._visGen || !G._pvis) { G._pvis = CW.visibleEnemies(M, G.units, vs, G.weather); G._pvisGen = G._visGen; }
  G._view = 1; G._realSide = keep.side; Object.assign(G, { side: vs, vis: G._pvis, sel: null, group: null, reach: null }); clearAct();
  try { return fn(); } finally { Object.assign(G, keep); G._view = 0; G._realSide = null; clearAct(); } }
function updateObjectives() { (G.obj || []).forEach(o => { const b = CW.bodiesAt(G.units, o[0], o[1]); if (b.length && b.every(u => u.side === b[0].side)) o[4] = b[0].side; }); }
CW.vp = () => { const v = { CS: 0, US: 0 }; (G.obj || []).forEach(o => { if (o[4]) v[o[4]] += o[3]; }); const c = G.cas || { CS: 0, US: 0 };
  v.CS += Math.round(c.US / 40) + G.morale.CS - 50; v.US += Math.round(c.CS / 40) + G.morale.US - 50; return v; };
G.attackMode = 'fire'; const MODEN = { fire: 'Volley', assault: 'Assault', charge: 'Charge' };
function groupAttack(e, shift) { const mode = shift && G.attackMode === 'fire' ? 'assault' : G.attackMode, all = { kind: mode === 'fire' ? 'volley' : mode, arc: 'front', rep: [], result: '' }; let n = 0, why = '';
  const ms = G.group.filter(u => u.type !== 'ldr' && !u.gone && u.side === G.side).sort((p, q) => CW.dist([p.c, p.r], [e.c, e.r]) - CW.dist([q.c, q.r], [e.c, e.r]));
  const tgtHex = [e.c, e.r];
  for (const u of ms) { if (e.gone || e.c !== tgtHex[0] || e.r !== tgtHex[1]) break; const w = mode === 'fire' ? CW.canFire(G, M, u, e) : CW.canAssault(G, M, u, e); if (w) { why = why || `${u.name}: ${w}`; continue; }
    const from = [u.c, u.r], res = mode === 'fire' ? CW.resolveFire(G, M, u, e) : CW.resolveAssault(G, M, u, e, mode === 'charge'); G.units.forEach(x => delete x._left);
    setTimeout(() => CW.playCombat(G, u, e, res, from), n * 450); all.rep.push(...res.rep); if (res.arc !== 'front') all.arc = res.arc; if (res.result) all.result = res.result; n++; }
  if (!n) return toast(why || 'No battalion in this brigade can attack that target');
  G.undo = []; refreshVis(); CW.report(G, all, { name: `${G.sel.bdeName || G.sel.divName} (${n} unit${n > 1 ? 's' : ''})` }, e); selectGroup(G.sel); afterBrigade(G.sel, n * 450 + 1400); }
function tryAttack(e, shift) { const u = G.sel, mode = shift && G.attackMode === 'fire' ? 'assault' : G.attackMode;
  const why = mode === 'fire' ? CW.canFire(G, M, u, e) : CW.canAssault(G, M, u, e); if (why) { toast(why); return; }
  const from = [u.c, u.r], res = mode === 'fire' ? CW.resolveFire(G, M, u, e) : CW.resolveAssault(G, M, u, e, mode === 'charge');
  G.units.forEach(x => delete x._left); G.undo = []; refreshVis(); CW.playCombat(G, u, e, res, from); CW.report(G, res, u, e); select(u.gone ? null : u);
  if (G.opts.autoNext && (u.gone || !canActNow(u))) { const s0 = G.sel; setTimeout(() => { if (G.sel === s0 && !CW.isModal()) nextActor(1); }, 1300); } }
const shown = CW.shown = u => u.side === G.side || !G.opts.fog || G.vis.has(u.id);
function toast(t) { if (G.aiBusy && !G._aiSay) return; const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('show'), 2800); }
CW.toast = toast;

// ---------- who can still act (cached; cleared after every action) ----------
let actCache = null; const clearAct = CW.clearAct = () => { actCache = null; };
// can: own unit id → enemies it can fire at now · tg: enemy id → own units that can fire at it
function actInfo() { if (actCache) return actCache; const can = new Map(), tg = new Map();
  const foes = G.units.filter(e => e.side !== G.side && !e.gone && e.type !== 'ldr' && e.type !== 'hq' && shown(e));
  if (foes.length) mine().forEach(u => { if (['ldr', 'hq', 'scout', 'eng'].includes(u.type) || u.fired || u.routed || u.sp < 1 || u.digging) return;
    const list = foes.filter(e => CW.dist([u.c, u.r], [e.c, e.r]) <= 6 && !CW.canFire(G, M, u, e)); if (list.length) { can.set(u.id, list); list.forEach(e => tg.set(e.id, [...(tg.get(e.id) || []), u])); } });
  return (actCache = { can, tg, step: new Map() }); }
CW.actInfo = actInfo;
// "can move" means it can actually reach a hex: leftover points smaller than every step cost don't count (≈1 in 4 units had such 'ghost' points)
const canStep = u => { const a = actInfo(); if (!a.step.has(u.id)) { const r = CW.reach(M, u, G.units, G.weather); a.step.set(u.id, !!r && r.size > 0); } return a.step.get(u.id); };
const canMoveNow = CW.canMoveNow = u => !u.digging && !u.routed && ((u.mp >= 1 && CW.canMove(u) && canStep(u)) || (u.type === 'art' && !u.acted && u.mp >= CW.maxMP(u)));   // unlimbered guns can still limber up
const canActNow = CW.canActNow = u => u.type !== 'ldr' && u.type !== 'hq' && (canMoveNow(u) || actInfo().can.has(u.id));
// contact view: the selection can shoot at someone → show fighting information only
const selMembers = () => G.sel && G.sel.side === G.side ? (G.group || [G.sel]).filter(u => u.type !== 'ldr' && u.type !== 'hq' && !u.gone) : [];
const inContact = CW.inContact = () => selMembers().some(u => actInfo().can.has(u.id));
// small status chip under each of your units: movement left + crossed muskets if it can fire; finished units are dimmed
function drawChip(u) { const [hx, hy] = CW.center(u.c, u.r), mv = canMoveNow(u), fire = actInfo().can.has(u.id), x = hx - R * .78, y = hy + R * .38;
  cx.save(); cx.font = '700 10px system-ui'; cx.textAlign = 'center'; const t = mv || fire ? String(Math.floor(u.mp)) : '✓', w = Math.max(15, cx.measureText(t).width + 8);
  cx.fillStyle = mv ? '#f2cd62' : 'rgba(60,50,38,.85)'; cx.strokeStyle = 'rgba(20,12,6,.9)'; cx.lineWidth = 1.5; cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, 13, 6) : cx.rect(x, y, w, 13); cx.fill(); cx.stroke();
  cx.fillStyle = mv ? '#1a1208' : 'rgba(255,255,255,.55)'; cx.fillText(t, x + w / 2, y + 10);
  if (fire) { const fx = x + w + 8, fy = y + 6.5; cx.fillStyle = '#c8321e'; cx.beginPath(); cx.arc(fx, fy, 8, 0, 7); cx.fill(); cx.stroke(); muskets(fx, fy, 4); }
  cx.restore(); }
// ready halo on the hex under a unit: crimson = can fire now, gold = can still move, nothing = done (drawn greyed)
function readyHalo(u, fire, move, pulse = 1) { const [hx, hy] = CW.center(u.c, u.r); cx.save();
  CW.hexPath(cx, hx, hy, R - 2); cx.fillStyle = fire ? `rgba(210,40,25,${.2 + .12 * pulse})` : 'rgba(255,205,80,.16)'; cx.fill();
  cx.lineWidth = fire ? 4 : 3; cx.strokeStyle = fire ? '#ff4a2e' : '#ffd766'; cx.shadowColor = fire ? 'rgba(255,60,30,1)' : 'rgba(255,220,120,.9)'; cx.shadowBlur = fire ? 8 + 10 * pulse : 8;
  CW.hexPath(cx, hx, hy, R - 3); cx.stroke();
  if (fire && move) { cx.shadowBlur = 0; cx.lineWidth = 1.6; cx.strokeStyle = '#f2cd62'; CW.hexPath(cx, hx, hy, R - 7); cx.stroke(); }   // inner gold line: can also still move
  cx.restore(); }
// selected formation: one bright outline round all its hexes (outer edges only) + a light wash, so you always see what you're commanding
function footprint(ms, pulse) { if (!ms.length) return; const on = new Set(ms.map(u => CW.key(u.c, u.r))); cx.save();
  cx.fillStyle = 'rgba(255,255,255,.10)'; ms.forEach(u => { CW.hexPath(cx, ...CW.center(u.c, u.r), R); cx.fill(); });
  cx.lineCap = 'round'; for (const [w, col] of [[9, 'rgba(10,20,40,.55)'], [4, `rgba(235,245,255,${.8 + .2 * pulse})`]]) { cx.lineWidth = w; cx.strokeStyle = col; cx.beginPath();
    ms.forEach(u => { const [x, y] = CW.center(u.c, u.r); for (let d = 0; d < 6; d++) { const n = CW.step(u.c, u.r, d); if (on.has(CW.key(...n))) continue; const p = CW.corner(x, y, d), q = CW.corner(x, y, d + 1); cx.moveTo(...p); cx.lineTo(...q); } }); cx.stroke(); }
  cx.restore(); }
// brigade identity: a thin ring in the brigade's colour under the men (replaces the text tag on the map)
// the ground marking under a battalion shows its brigade colour AND its formation (drawn in the ground plane, turned to its facing):
//   battle line = a bar across the front · column (march / mounted / limbered) = a long bar pointing the way it moves, with an arrowhead · skirmishers = a dotted ring
const FORM_KIND = { combat: 'line', dism: 'line', unl: 'line', work: 'line', est: 'line', march: 'col', mounted: 'col', lim: 'col', one: 'skirm' };
function brigadeBase(u, x, y, dim) { if (u.type === 'hq') return; const kind = FORM_KIND[u.form] || 'line', col = u.side === G.side ? (u.color || CW.SIDE[u.side].block) : 'rgba(60,45,28,.95)';
  cx.save(); cx.globalAlpha = dim ? .35 : .95; cx.translate(x, y + R * .3); cx.scale(1, .6); cx.rotate(u.face * Math.PI / 3);
  cx.lineJoin = 'round'; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.fillStyle = col; cx.beginPath();
  if (kind === 'skirm') { cx.setLineDash([5, 6]); cx.lineWidth = 4.5; cx.arc(0, 0, R * .66, 0, 7); cx.stroke(); cx.strokeStyle = col; cx.lineWidth = 2.6; cx.stroke(); cx.restore(); return; }
  if (kind === 'line') { const w = R * .22, h = R * .78; cx.rect(R * .12 - w / 2, -h, w, h * 2); }
  else { const L = R * .62, w = R * .13; cx.moveTo(-L, -w); cx.lineTo(L * .7, -w); cx.lineTo(L * .7, -w * 2.2); cx.lineTo(L * 1.12, 0); cx.lineTo(L * .7, w * 2.2); cx.lineTo(L * .7, w); cx.lineTo(-L, w); cx.closePath(); }
  cx.lineWidth = 2.2; cx.stroke(); cx.fill(); cx.restore(); }
// one status badge (top-right of the hex), only when something needs attention: out of command > low ammo > entrenched
function statusBadge(u) { const [hx, hy] = CW.center(u.c, u.r), bx = hx + R * .52, by = hy - R * .52, own = u.side === G.side;
  const b = own && !CW.inCommand(G.units, u) && u.type !== 'hq' ? ['!', '#c0392b', '#fff'] : own && u.sp < 3 && u.type !== 'ldr' && u.type !== 'hq' ? ['A', '#e0a526', '#1a1208'] : (u.dug || u.digging) ? ['⛏', '#5b4a2e', '#f3e3c0'] : null;
  if (!b) return; cx.save(); if (u.digging) cx.globalAlpha = .6; cx.fillStyle = b[1]; cx.strokeStyle = 'rgba(0,0,0,.7)'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(bx, by, 7, 0, 7); cx.fill(); cx.stroke();
  cx.fillStyle = b[2]; cx.font = '700 9px system-ui'; cx.textAlign = 'center'; cx.fillText(b[0], bx, by + 3.2); cx.restore(); }
// on-screen coach: tells a first-time player what to do next, based on what's on screen (? toggles it)
function updateCoach(contact) { let el = $('coach'); if (!el) { el = document.createElement('div'); el.id = 'coach'; $('wrap').appendChild(el);
    el.addEventListener('click', ev => { if (ev.target.classList.contains('x')) { G.opts.coach = false; CW.saveOpts(G.opts); draw(); toast('Tips hidden — press ? (or the ? button) to bring them back'); } }); }
  const show = G.started && G.opts.coach && !G.aiBusy && !CW.isModal(); if (!show) { el.style.display = 'none'; return; }
  const s = G.sel && G.sel.side === G.side ? G.sel : null, rc = readyCounts(), bm = !CW.CLASSIC && G.opts.bdeMode, k = t => `<kbd>${t}</kbd>`;
  let t, h;
  if (s && G.group && contact) { t = `${s.bdeName || s.divName} is in contact`; h = `Click a <b>red-ringed enemy</b>: every battalion of the brigade that can reach it fires. ${k('Shift')}-click = assault. When done, click an empty hex to move on, or ${k('N')} for the next brigade.`; }
  else if (s && G.group && s.level === 'div') { t = `Commanding ${s.divName}`; h = `<b>Press and drag</b> a line on the map where the division should form up — its brigades line up along it, facing away from where they are now. A plain click marches it there. The order carries on by itself each turn.`; }
  else if (s && G.group) { t = `Commanding ${s.bdeName}`; h = `<b>Click a hex</b> — the whole brigade marches there, keeping its shape (hover first to preview; shaded = too far this turn). ${k('Q')}/${k('W')} turn it in place. ${k('Option')}-click one battalion to place it by hand. ${k('Esc')} to let go.`; }
  else if (s && s.type !== 'ldr' && s.type !== 'hq') { t = `Commanding ${s.name}`; h = `<b>Click a highlighted hex</b> to move it. Click a red-ringed enemy to fire (${k('Shift')}-click = assault). ${k('F')} changes formation (column moves fast, line fights). ${k('Esc')} to let go.`; }
  else if (s && s.type === 'ldr') { t = `${s.ldr || s.name}`; h = `A commander. Move him like any unit — regiments within <b>${CW.cmdRadius(s, G.units)} hexes</b> of him stay in command (out of command = ¾ movement, fight worse). ${k('C')} shows command lines.`; }
  else if (rc && !rc.fire.length && !rc.move.length) { t = 'Everything has moved'; h = `Press <b>End turn</b> (${k('E')}). The enemy moves next, then it's your turn again.`; }
  else { t = 'Your turn'; h = bm ? `<b>1.</b> Click one of your battalions with a <b>gold ring</b> — you take command of its whole brigade. <b>2.</b> Click where the brigade should go. <b>3.</b> Crimson ring = can fire: click it, then a red-ringed enemy. Generals (★★ on horseback) command whole divisions. When nothing glows, <b>End turn</b>.`
    : `<b>1.</b> Click a regiment with a <b>gold ring</b> — it can move. <b>2.</b> Click a highlighted hex to march there. <b>3.</b> A <b>crimson ring</b> means it can fire: select it, then click a red-ringed enemy. ${k('Tab')} jumps to the next unit that can act. When nothing glows, <b>End turn</b>. View: drag to pan, wheel to zoom, ${k('[')} ${k(']')} tilt.`; }
  const html = `<span class="x" title="Hide tips">✕</span><div class="ct">${t}</div>${h}`; if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; } el.style.display = 'block'; }
// top bar: how many battalions can still fire / move; each count jumps to the next such unit
function readyCounts() { if (!G.started || G.aiBusy || G._view === 1) return null; const own = mine().filter(u => u.type !== 'ldr' && u.type !== 'hq'), ai = actInfo();
  const fire = own.filter(u => ai.can.has(u.id)), move = own.filter(u => !ai.can.has(u.id) && canMoveNow(u));
  if (CW.CLASSIC || !G.opts.bdeMode || !CW.ORD) return { fire, move, unit: 'regiment' };
  // brigade command: one entry per brigade (its colonel); corps troops and detached battalions count on their own
  const rep = u => (u.bde && !u.detached && CW.ORD.colonelOf(G.units, u)) || u, uniq = a => [...new Set(a.map(rep))];
  const f = uniq(fire), m = uniq(move).filter(x => !f.includes(x)); return { fire: f, move: m, unit: 'brigade' }; }
function updateReady() { const el = $('ready'), eb = document.querySelector('#top .endb'); if (!el) return; const rc = readyCounts();
  const nm = n => rc.unit === 'brigade' ? ` brigade${n === 1 ? '' : 's'}` : '';
  const html = !rc ? '' : (rc.fire.length ? `<button class="rf" data-rk="fire" title="${rc.unit === 'brigade' ? 'Brigades' : 'Battalions'} that can fire now — click to jump to the next one">⌖ ${rc.fire.length}${nm(rc.fire.length)} can fire</button>` : '') +
    (rc.move.length ? `<button class="rm" data-rk="move" title="${rc.unit === 'brigade' ? 'Brigades' : 'Battalions'} with movement left — click to jump to the next one">▶ ${rc.move.length}${nm(rc.move.length)} can move</button>` : '') +
    (!rc.fire.length && !rc.move.length ? '<button class="rd" title="Every battalion has used its turn">✓ all done</button>' : '');
  if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; el.querySelectorAll('[data-rk]').forEach(b => b.onclick = () => nextReady(b.dataset.rk)); }
  if (eb) eb.classList.toggle('go', !!rc && !rc.fire.length && !rc.move.length); }
function nextReady(kind) { const rc = readyCounts(); if (!rc) return; const list = rc[kind].sort((a, b) => a.id - b.id); if (!list.length) return;
  const i = list.indexOf(G.sel), u = list[(i + 1) % list.length];
  if (u.level === 'bde') { selectGroup(u); CW.centerOn(u.c, u.r); } else CW.select(u);
  toast(`${u.level === 'bde' ? u.bdeName : u.name}: ${kind === 'fire' ? 'can fire — click a red-ringed enemy' : u.level === 'bde' ? 'can still move — click or drag where it should go' : `${Math.floor(u.mp)} movement left`} (${(i + 1) % list.length + 1}/${list.length})`); }
CW.nextReady = nextReady;
// "can fire" icon: a white gun-sight, centred on x,y
function muskets(x, y, k) { cx.save(); cx.strokeStyle = '#fff'; cx.lineWidth = 1.6; cx.lineCap = 'round'; cx.beginPath(); cx.arc(x, y, k * .8, 0, 7);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { cx.moveTo(x + dx * k * .35, y + dy * k * .35); cx.lineTo(x + dx * k * 1.25, y + dy * k * 1.25); } cx.stroke(); cx.restore(); }
// ---------- drawing ----------
function draw() { if (G.aiBusy && !G._view) return asViewer(draw);
  // start every frame from a clean slate, so one failed frame can never leave the canvas shifted or faded for the next
  cx = sx; const dpr = window.devicePixelRatio || 1; cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; if ('filter' in cx) cx.filter = 'none';
  const w = cv.clientWidth, h = cv.clientHeight, D3 = G.started && is3D(); if (glc) glc.style.display = D3 ? 'block' : 'none';
  if (D3) cx.clearRect(0, 0, w, h); else { cx.fillStyle = '#2b2418'; cx.fillRect(0, 0, w, h); } if (!G.started) return;
  const ph = CW.phase(G.minutes), contact = G.contact = inContact();
  // 3D: markings go onto the decal (map pixels, no camera); flat: everything goes on screen under the 2D camera
  if (D3) { cx = CW.R3.decal(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; if ('filter' in cx) cx.filter = 'none'; cx.clearRect(0, 0, MW, MH); cx.save(); }
  else { cx.save(); cx.translate(G.cam.x, G.cam.y); cx.scale(G.cam.z, G.cam.z); cx.drawImage(terrainImg(), 0, 0); }
  if (G.weather === 'fog') { cx.fillStyle = 'rgba(225,228,230,.35)'; cx.fillRect(0, 0, MW, MH); }
  if (CW.TINT[ph]) { cx.fillStyle = CW.TINT[ph]; cx.fillRect(0, 0, MW, MH); }
  if (G.opts.grid) { cx.strokeStyle = 'rgba(0,0,0,.18)'; cx.lineWidth = 1; M.all.forEach(p => { CW.hexPath(cx, ...CW.center(...p)); cx.stroke(); }); }
  if (G.tool.heights) { cx.font = '700 12px system-ui,sans-serif'; cx.textAlign = 'center';
    M.all.forEach(p => { const [x, y] = CW.center(...p), hv = M.h(...p); cx.fillStyle = `rgba(${hv > 2 ? '120,60,20' : '20,40,80'},${.08 + hv * .06})`; CW.hexPath(cx, x, y, R - 1); cx.fill(); cx.fillStyle = '#fff'; cx.strokeStyle = 'rgba(0,0,0,.7)'; cx.lineWidth = 3; cx.strokeText(hv, x, y - R * .55); cx.fillText(hv, x, y - R * .55); }); }
  let shed = null;
  if (G.tool.los && G.hover) shed = CW.viewshed(M, G.hover, 14, .3);
  else if (G.tool.sight && G.sel) shed = CW.viewshed(M, [G.sel.c, G.sel.r], CW.TYPES[G.sel.type].sight + 2, CW.EYE(G.sel));
  if (shed) { cx.fillStyle = 'rgba(15,15,30,.5)'; M.all.forEach(p => { if (!shed.has(CW.key(...p))) { CW.hexPath(cx, ...CW.center(...p), R + .5); cx.fill(); } }); }
  if (G.reach && !shed) {
    if (G.opts.showRange) { cx.fillStyle = 'rgba(10,12,16,.4)'; M.all.forEach(p => { if (!G.reach.has(CW.key(...p)) && !(p[0] === G.sel.c && p[1] === G.sel.r)) { CW.hexPath(cx, ...CW.center(...p), R + .5); cx.fill(); } }); }
    cx.strokeStyle = 'rgba(200,40,30,.55)'; cx.lineWidth = 2; cx.setLineDash([4, 4]);
    if (!contact) G.units.filter(e => e.side !== G.side && !e.gone && shown(e) && CW.exertsZOC(e)).forEach(e => CW.zocHexes(M, e).forEach(([c, r]) => { CW.hexPath(cx, ...CW.center(c, r), R - 5); cx.stroke(); }));
    cx.setLineDash([]);
    if (G.hover && G.reach.has(CW.key(...G.hover))) { cx.strokeStyle = 'rgba(255,236,170,.95)'; cx.lineWidth = 4; cx.lineCap = 'round'; CW.smoothPath(cx, G.reach.path(CW.key(...G.hover)).map(p => CW.center(...p))); cx.stroke(); } }
  const own = G.sel && G.sel.side === G.side, L = own ? (G.sel.type === 'ldr' ? G.sel : CW.leaderOf(G.units, G.sel)) : null;
  if (L && !shed && !contact) { const rad = CW.cmdRadius(L, G.units); cx.fillStyle = 'rgba(232,196,106,.10)'; cx.strokeStyle = 'rgba(232,196,106,.35)'; cx.lineWidth = 1;
    M.all.forEach(p => { if (CW.dist(p, [L.c, L.r]) <= rad) { CW.hexPath(cx, ...CW.center(...p), R - 1); cx.fill(); } }); }
  if (G.group) { cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.lineWidth = 2; G.group.forEach(u => { CW.hexPath(cx, ...CW.center(u.c, u.r), R - 4); cx.stroke(); });
 }
  const block = G.group && G.blockRange && G.sel && G.sel.level === 'bde' && G.sel.side === G.side;
  if (block && !shed && !contact && G.opts.showRange) { cx.fillStyle = 'rgba(10,12,16,.32)'; M.all.forEach(p => { if (!G.blockRange.has(CW.key(...p))) { CW.hexPath(cx, ...CW.center(...p), R + .5); cx.fill(); } }); }
  let bpv = null; if (block && G.hover && !CW.unitsAt(G.units, ...G.hover).some(u => shown(u) && u.side !== G.side)) { try { bpv = CW.ORD.blockPreview(G.sel, G.hover, G.blockCache); } catch (err) { bpv = null; } }
  if (CW.ORD) CW.ORD.draw(cx, (orderDrag && orderDrag.pv) || bpv);
  if (G.hover) { cx.strokeStyle = '#f6e6a8'; cx.lineWidth = 2; CW.hexPath(cx, ...CW.center(...G.hover), R - 2); cx.stroke(); }
  (G.obj || []).forEach(o => { const [x, y] = CW.center(o[0], o[1]); cx.save(); cx.translate(x - R * .6, y - R * .35); cx.strokeStyle = '#2b2116'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(0, 12); cx.lineTo(0, -12); cx.stroke();
    cx.fillStyle = o[4] ? CW.SIDE[o[4]].block : '#ddd'; cx.fillRect(0, -12, 13, 9); cx.fillStyle = '#fff'; cx.font = '700 7px system-ui'; cx.textAlign = 'center'; cx.fillText(o[3], 6.5, -5); cx.restore(); });
  const cmdLine = (A, B, ok, w) => { const [x1, y1] = CW.center(A.c, A.r), [x2, y2] = CW.center(B.c, B.r); cx.strokeStyle = ok ? (A.color || '#f3e3a0') : 'rgba(230,60,40,.95)'; cx.lineWidth = w; cx.setLineDash(ok ? [] : [6, 5]); cx.globalAlpha = .85; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); cx.setLineDash([]); cx.globalAlpha = 1; };
  const linkFor = L => { G.units.filter(x => !x.gone && x !== L && CW.leaderOf(G.units, x) === L && x.side === L.side).forEach(x => cmdLine(L, x, CW.inCommand(G.units, x), x.type === 'ldr' ? 3.5 : 2)); };
  if (G.tool.cmd) G.units.filter(l => (l.type === 'ldr' || l.type === 'hq') && l.side === G.side && !l.gone).forEach(linkFor);
  else if (G.sel && G.sel.side === G.side && !shed && !contact) { const ch = CW.chain(G.units, G.sel); ch.forEach(l => { if (l.type === 'ldr' || l.type === 'hq') { if (l === G.sel || l === ch[ch.length - 2]) linkFor(l); } });
    for (let i = 0; i < ch.length - 1; i++) cmdLine(ch[i], ch[i + 1], CW.inCommand(G.units, ch[i + 1]), 3.5); }
  const dark = ph === 'Night' || ph === 'Dusk', pulse = .5 + .5 * Math.sin(Date.now() / 320);
  // focus = what the player is looking at: the selection (and its brigade) plus whatever is under the cursor
  const focusSet = new Set(); if (G.sel && G._view !== 1) { (G.group || [G.sel]).forEach(x => focusSet.add(x)); if (G.sel.bde && G.sel.side === G.side) G.units.forEach(x => { if (x.bde === G.sel.bde && x.side === G.sel.side) focusSet.add(x); }); }
  const hoverSet = new Set(G.hover ? CW.bodiesAt(G.units, ...G.hover) : []); hoverSet.forEach(x => focusSet.add(x));
  const ownSel = !!(G.sel && G.sel.side === G.side && G._view !== 1 && G.group);
  if (ownSel) footprint(G.group.filter(x => !x.gone && x.type !== 'ldr' && x.type !== 'hq'), pulse);
  const unitList = G.units.filter(u => !u.gone && shown(u)).sort((a, b) => a.r - b.r);
  const posOf = u => { let [x, y] = CW.center(u.c, u.r); if (u.type === 'ldr') { x += R * .38; y -= R * .3; } else { const st = CW.bodiesAt(G.units, u.c, u.r); if (st.length > 1) { const i = st.indexOf(u); x += (i ? 1 : -1) * R * .22; y += (i ? 1 : -1) * R * .12; } } return [x, y]; };
  // ground marks under a unit: campfire glow, selected-hex outline, ready ring (these lie on the ground, so in 3D they go on the decal)
  const groundMarks = (u, x, y) => {
    if (u.rested && dark) { const g = cx.createRadialGradient(x + R * .4, y + R * .3, 1, x + R * .4, y + R * .3, R * .5); g.addColorStop(0, 'rgba(255,190,90,.9)'); g.addColorStop(1, 'rgba(255,120,30,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(x + R * .4, y + R * .3, R * .5, 0, 7); cx.fill(); }
    if (u === G.sel) { cx.save(); cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.shadowColor = '#ffe9a0'; cx.shadowBlur = 12; CW.hexPath(cx, ...CW.center(u.c, u.r), R - 3); cx.stroke(); cx.restore(); }
    if (u.type === 'ldr') return; const mineNow = u.side === G.side && G._view !== 1 && u.type !== 'hq', fireNow = mineNow && actInfo().can.has(u.id), moveNow = mineNow && canMoveNow(u);
    if ((fireNow || moveNow) && (!ownSel || focusSet.has(u))) readyHalo(u, fireNow, moveNow, pulse); };   // focus: while a formation is selected, only it keeps its rings
  // contact view (ground marks): every enemy the selection can hit gets a red ring + how many of your units can fire at it; hovering one draws the lines of fire
  const fightMarks = () => {
  if (contact) { const ms = selMembers(), { tg } = actInfo(), hov = G.hover && CW.bodiesAt(G.units, ...G.hover).find(o => o.side !== G.side && shown(o));
    for (const [eid, us] of tg) { const e = G.units.find(x => x.id === eid), mine2 = us.filter(u => ms.includes(u)); if (!e || !mine2.length) continue; const [x, y] = CW.center(e.c, e.r), on = hov === e;
      if (on) { cx.save(); cx.strokeStyle = 'rgba(255,90,60,.9)'; cx.lineWidth = 2.5; cx.setLineDash([6, 4]); mine2.forEach(u => { const a = CW.center(u.c, u.r); cx.beginPath(); cx.moveTo(...a); cx.lineTo(x, y); cx.stroke(); }); cx.restore(); }
      cx.save(); cx.lineWidth = on ? 4 : 3; cx.strokeStyle = 'rgba(20,12,6,.8)'; CW.hexPath(cx, x, y, R - 3); cx.stroke(); cx.strokeStyle = on ? '#ff6a4a' : 'rgba(230,70,45,.9)'; cx.lineWidth = on ? 3 : 2; CW.hexPath(cx, x, y, R - 3); cx.stroke();
      const t = String(mine2.length); cx.font = '700 11px system-ui'; cx.textAlign = 'left'; const bw = cx.measureText(t).width + 26, bx = x - bw / 2, by = y - R * .95; cx.fillStyle = '#c8321e'; cx.strokeStyle = 'rgba(20,12,6,.9)'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.roundRect ? cx.roundRect(bx, by, bw, 16, 8) : cx.rect(bx, by, bw, 16); cx.fill(); cx.stroke(); muskets(bx + 9, by + 8, 3.6); cx.fillStyle = '#fff'; cx.fillText(t, bx + 17, by + 12); cx.restore(); } }
  if (G.hover && G.sel && G.sel.side === G.side && !G.group) { const foe = CW.bodiesAt(G.units, ...G.hover).find(o => o.side !== G.side && shown(o));
    if (foe) { const why = G.attackMode === 'fire' ? CW.canFire(G, M, G.sel, foe) : CW.canAssault(G, M, G.sel, foe), [x, y] = CW.center(...G.hover);
      cx.strokeStyle = why ? 'rgba(220,60,40,.9)' : 'rgba(120,255,140,.95)'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(x, y, R * .55, 0, 7); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { cx.moveTo(x + dx * R * .35, y + dy * R * .35); cx.lineTo(x + dx * R * .75, y + dy * R * .75); } cx.stroke(); } }
  };
  if (D3) { unitList.forEach(u => groundMarks(u, ...posOf(u))); fightMarks(); CW.drawFx(cx); cx.restore(); cx = sx;
    if (!CW.R3.render(G.cam, w, h, dpr, terrainImg())) return draw(); }                  // WebGL failed → R3 switches itself off → redraw flat
  // units: in 3D each one is drawn in its own map coordinates, placed and scaled where its hex appears on the tilted ground
  for (const u of unitList) {
    const [x, y] = posOf(u);
    if (D3) { cx.save(); if (!CW.R3.local(cx, x, y, dpr)) { cx.restore(); continue; } } else groundMarks(u, x, y);
    if (u.type === 'ldr') { CW.drawLeader(cx, u, x, y, G.opts.counters); if (D3) cx.restore(); continue; }
    const mineNow = u.side === G.side && G._view !== 1 && u.type !== 'hq', fireNow = mineNow && actInfo().can.has(u.id), moveNow = mineNow && canMoveNow(u);
    const spent = mineNow && !u.routed && !fireNow && !moveNow, focus = focusSet.has(u), far = G.cam.z < .75;
    brigadeBase(u, x, y, spent);
    if (spent) { cx.globalAlpha = .38; if ('filter' in cx) cx.filter = 'grayscale(1) brightness(.8)'; }
    if (G.opts.counters) CW.drawCounter(cx, u, x, y); else { const k = CW.KITIMG ? 1 : 1.35, fy = y + R * .3; cx.save(); cx.translate(x, fy); cx.scale(k, k); cx.translate(-x, -fy); CW.drawFigures(cx, u, x, y); cx.restore(); }   // bigger, fewer figures fill the hex
    CW.drawFacing(cx, u, ...CW.center(u.c, u.r), u.side === 'CS' ? '#e8c46a' : '#9fc0ff'); cx.globalAlpha = 1; if ('filter' in cx) cx.filter = 'none';
    if (u.routed) { cx.fillStyle = 'rgba(160,20,20,.9)'; cx.fillRect(x - 16, y + R * .38, 32, 11); cx.fillStyle = '#fff'; cx.font = '700 8px system-ui'; cx.textAlign = 'center'; cx.fillText('ROUTED', x, y + R * .38 + 8.5); }
    else if (!far || focus) statusBadge(u);                                  // one badge, only when something needs attention
    if (hoverSet.has(u) && u.tag && u.type !== 'ldr') {   // brigade tag: hover only
      cx.font = '700 8px system-ui'; const tw = cx.measureText(u.tag).width + 6, [hx0, hy0] = CW.center(u.c, u.r); cx.fillStyle = u.color || '#bbb'; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 1;
      cx.beginPath(); cx.roundRect ? cx.roundRect(hx0 + R * .12, hy0 + R * .5, tw, 10, 3) : cx.rect(hx0 + R * .12, hy0 + R * .5, tw, 10); cx.fill(); cx.stroke(); cx.fillStyle = '#1a1208'; cx.textAlign = 'left'; cx.fillText(u.tag, hx0 + R * .12 + 3, hy0 + R * .5 + 8); }
    if (focus && mineNow && (fireNow || moveNow)) drawChip(u);                    // movement points + fire icon: selection / hover only
    if (D3) cx.restore();
  }
  // brigades still waiting for orders: a slow gold pulse round the colonel's flag
  { const pulse = .45 + .35 * Math.sin(Date.now() / 260);
    for (const L of CW.waitingBdes()) { if (!shown(L)) continue; const [x0, y0] = CW.center(L.c, L.r), x = x0 + R * .38, y = y0 - R * .3;
      const rr = R * (.46 + .06 * pulse); cx.save(); if (D3) CW.R3.local(cx, x, y, dpr); cx.lineWidth = 6; cx.strokeStyle = 'rgba(20,12,6,.55)'; cx.beginPath(); cx.arc(x, y, rr, 0, 7); cx.stroke();
      cx.strokeStyle = `rgba(255,214,110,${pulse + .15})`; cx.lineWidth = 3; cx.shadowColor = '#ffd66e'; cx.shadowBlur = 12; cx.stroke(); cx.restore(); } }
  if (!D3) { fightMarks(); CW.drawFx(cx); }
  cx.restore();
  $('clock').textContent = `${CW.fmtTime(G.minutes)} (${ph}) · ${sideName(G._realSide || G.side)}${G.aiBusy ? ' (computer) moving' : ' move'} · ${CW.WEATHER[G.weather].n}`;
  const vp = CW.vp(); $('res').textContent = `Supply ${G.supply[G.side]} · Army morale ${G.morale[G.side]} · VP ${vp.CS}–${vp.US} · ${MODEN[G.attackMode]} mode (A)`;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', !!G.tool[b.dataset.tool]));
  document.querySelectorAll('[data-optb]').forEach(b => b.classList.toggle('on', !!G.opts[b.dataset.optb]));
  CW.hud(G, M, MW, MH); updateReady(); updateCoach(contact);
}
CW.draw = draw;
// keep the waiting-brigade pulse moving (cheap: only while brigades are waiting and nothing is being dragged)
setInterval(() => { if (G.started && !drag && !orderDrag && !document.hidden && !CW.isModal() && ((CW.waitingBdes && CW.waitingBdes().length) || (() => { const rc = readyCounts(); return rc && rc.fire.length; })())) draw(); }, 120);
CW.refresh = () => { refreshVis(); if (G.sel) select(G.sel); else { CW.panel(G, M); draw(); } };
// keep the board on screen (a little slack at the edges, none of the black void)
function clampCam() { const w = cv.clientWidth, h = cv.clientHeight, left = G.opts.roster ? 246 : 0, z = G.cam.z, bw = MW * z, bh = MH * z, pad = 40;
  G.cam.x = bw < w - left ? left + (w - left - bw) / 2 : Math.min(left + pad, Math.max(w - bw - pad, G.cam.x));
  G.cam.y = bh < h ? (h - bh) / 2 : Math.min(pad, Math.max(h - bh - pad, G.cam.y)); }
CW.centerOn = (c, r) => { const [x, y] = CW.center(c, r), left = G.opts.roster ? 246 : 0; G.cam.x = left + (cv.clientWidth - left) / 2 - x * G.cam.z; G.cam.y = cv.clientHeight / 2 - y * G.cam.z; clampCam(); draw(); };

// ---------- actions ----------
function select(u) { clearAct(); G.group = null; G.blockRange = null; G.sel = u; G.reach = u && u.side === G.side && !u.digging ? CW.reach(M, u, G.units, G.weather) : null; CW.panel(G, M); draw(); }
CW.newGame = newGame; CW.loadState = loadState;
CW.select = u => { select(u); if (u) CW.centerOn(u.c, u.r); };
CW.refreshVis = () => refreshVis();
const snapshot = CW.snapshot = us => G.undo.push([].concat(us).map(u => JSON.parse(JSON.stringify(u))));
// walk a unit along a path; returns true if an enemy was revealed (halt)
function walk(u, path) { const before = new Set(G.vis); let spent = 0, halted = false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], d = CW.dirTo(a, b), sc = CW.rotDist(u.face, d) * (CW.isColumn(u) ? 0 : 1) + CW.stepCost(M, u, a, b, d, G.weather);
    spent += sc; if (u.type !== 'ldr') CW.attrition(G, M, u, sc, b); u.c = b[0]; u.r = b[1]; u.face = d; u.dug = 0; refreshVis();
    const spotted = [...G.vis].filter(id => !before.has(id));
    if (spotted.length) { halted = true; toast(`Enemy spotted: ${byId(spotted[0]).name}!${i < path.length - 1 ? ' Halting.' : ''}`); break; } }
  u.mp = Math.max(0, Math.round((u.mp - spent) * 10) / 10); u.acted = 1; return halted; }
CW.walk = walk;
function moveTo(h) {
  const u = G.sel, k = CW.key(...h); if (!G.reach || !G.reach.has(k)) return;
  snapshot(u); const halted = walk(u, G.reach.path(k)); if (halted) G.undo = [];
  if (u.bde && u.type !== 'ldr' && !u.detached && CW.ORD) { u.detached = 1; setTimeout(() => toast(`${u.name} detached from its brigade — the next brigade order brings it back`), halted ? 2900 : 0); }
  const canHit = G.units.some(e => e.side !== u.side && !e.gone && e.type !== 'ldr' && G.vis.has(e.id) && (!CW.canFire(G, M, u, e) || !CW.canAssault(G, M, u, e)));
  if (canHit) toast(`${u.name} can still engage — click an enemy`);
  if (u.mp < 1 && G.opts.autoNext && !halted && !canHit) return nextUnit(true);
  select(u);
}
// ---------- brigade orders ----------
function selectGroup(u) { if (CW.CLASSIC) return select(u); clearAct(); const g = CW.brigadeOf(G.units, u); if (g.length < 2) { G.group = null; return select(u); }
  G.group = g; G.sel = g.find(x => x.type === 'ldr') || u; G.reach = null; G.blockCache = {}; G.blockRange = G.sel.level === 'bde' && G.sel.side === G.side && CW.ORD ? CW.ORD.blockRange(G.sel, G.blockCache) : null; CW.panel(G, M); draw(); }
CW.selectGroup = selectGroup;
// ---------- brigade-by-brigade turn flow (COMMAND_ORDERS.md v2.1) ----------
// A brigade has its orders for this turn once: every battalion has acted (moved, turned, fired, rested, dug in),
// it is carrying out a division order, or you told it to hold (K). Nothing else to track, so save/undo just work.
const bdeDone = CW.bdeDone = L => { if (L.ordered) return true; if (L.order && !L.order.done && !L.order.contact) return true;
  const ms = CW.ORD ? CW.ORD.members(G.units, L) : []; if (ms.some(u => actInfo().can.has(u.id))) return false; return ms.every(u => u.acted || u.mp < 1 || u.digging); };
// brigades in roster order: division by division, then independent brigades
const bdeOrder = () => { const us = G.units.filter(u => u.side === G.side && !u.gone), cols = us.filter(l => l.level === 'bde'), divs = us.filter(u => u.level === 'div').map(d => d.div);
  const firstIdx = new Map(); us.forEach((u, i) => { if (u.bde && !firstIdx.has(u.bde)) firstIdx.set(u.bde, i); });
  const dk = c => { const i = divs.indexOf(c.div); return i < 0 ? 999 : i; };
  return cols.sort((a, b) => dk(a) - dk(b) || firstIdx.get(a.bde) - firstIdx.get(b.bde)); };
CW.waitingBdes = () => CW.CLASSIC ? [] : bdeOrder().filter(c => !bdeDone(c));
// pan only when the hex is near the edge of the view (so the camera doesn't jump for every brigade)
function ensureVisible(c, r) { const [x, y] = CW.center(c, r), sx = x * G.cam.z + G.cam.x, sy = y * G.cam.z + G.cam.y, w = cv.clientWidth, h = cv.clientHeight, left = G.opts.roster ? 260 : 0;
  if (sx < left + w * .12 || sx > w * .82 || sy < h * .15 || sy > h * .8) CW.centerOn(c, r); }
function nextBrigade(from) { if (CW.CLASSIC) return classicNext(1);
  const all = bdeOrder(), wait = all.filter(c => !bdeDone(c));
  if (!wait.length) { const loose = mine().filter(u => !u.bde && u.type !== 'ldr' && u.type !== 'hq' && canActNow(u) && !u.skip && (!u.acted || actInfo().can.has(u.id)));
    if (loose.length) { toast('Every brigade has orders — now the unattached units'); return CW.select(loose[0]); }
    select(null); return toast('Every brigade has its orders — press E to end the turn'); }
  const i = from ? all.indexOf(from) : -1, next = [...all.slice(i + 1), ...all.slice(0, i + 1)].find(c => !bdeDone(c));
  selectGroup(next); ensureVisible(next.c, next.r);
  const D = next.div && G.units.find(d => d.level === 'div' && d.div === next.div && d.side === G.side);
  const hot = CW.ORD.members(G.units, next).filter(u => actInfo().can.has(u.id)).length;
  toast(`${next.bdeName}${D ? ` · ${D.divName}` : ''} — ${hot ? `in contact: ${hot} battalion${hot > 1 ? 's' : ''} can fire — click a red-ringed enemy` : 'awaiting orders'} (${wait.length} brigade${wait.length > 1 ? 's' : ''} left)`); }
CW.nextBrigade = nextBrigade;
// after a brigade acts: move on to the next one, unless it can still fire at someone
let advT = null;
function afterBrigade(L, delay = 900) { clearTimeout(advT); if (!G.opts.autoNext || !L || L.side !== G.side) return;
  const cols = L.level === 'div' ? bdeOrder().filter(c => c.div === L.div) : [L]; if (!cols.length || !cols.every(bdeDone)) return;
  const ms = cols.flatMap(c => CW.ORD.members(G.units, c)), canHit = ms.some(u => G.units.some(e => e.side !== u.side && !e.gone && e.type !== 'ldr' && G.vis.has(e.id) && !CW.canFire(G, M, u, e)));
  if (canHit) return setTimeout(() => toast(`${L.level === 'div' ? L.divName : L.bdeName} can still fire — click an enemy, or N for the next brigade`), 2900);
  const sel = G.sel; advT = setTimeout(() => { if (G.sel === sel && !CW.isModal()) nextBrigade(cols[cols.length - 1]); }, delay); }
CW.afterBrigade = afterBrigade;
function holdBrigade() { if (!G.group || !G.sel || G.sel.level !== 'bde' || G.sel.side !== G.side) return false;
  const L = G.sel; L.ordered = 1; toast(`${L.bdeName} holds this turn`); nextBrigade(L); return true; }
function groupTargets(h) { const a = CW.toCube(G.sel.c, G.sel.r), t = CW.toCube(...h), d = [t[0] - a[0], t[1] - a[1]];
  return G.group.map(u => { const c = CW.toCube(u.c, u.r); return [u, CW.fromCube(c[0] + d[0], c[1] + d[1])]; }); }
function groupMove(h) {
  const dir = CW.dirToward([G.sel.c, G.sel.r], h), movers = groupTargets(h).filter(([u]) => u.mp > 0 && CW.canMove(u) && !u.digging && u.side === G.side);
  if (!movers.length) return toast('No one in this brigade can move');
  const ctr = CW.center(...h); movers.sort((x, y) => { const p = CW.center(...x[1]), q = CW.center(...y[1]); return Math.hypot(p[0] - ctr[0], p[1] - ctr[1]) - Math.hypot(q[0] - ctr[0], q[1] - ctr[1]); });
  movers.sort((x, y) => (x[0].type === 'ldr') - (y[0].type === 'ldr'));
  snapshot(movers.map(m => m[0])); let halted = false, moved = 0;
  for (const [u, tgt] of movers) {
    const rc = CW.reach(M, u, G.units, G.weather); let best = null, bd = CW.dist([u.c, u.r], tgt);
    rc.forEach((v, k) => { const hx = CW.unkey(k), d = CW.dist(hx, tgt); if (d < bd || (d === bd && best && v.cost < rc.get(CW.key(...best)).cost)) { bd = d; best = hx; } });
    if (best) { moved++; if (walk(u, rc.path(CW.key(...best)))) { halted = true; break; } }
    const turn = CW.rotDist(u.face, dir) * (CW.isColumn(u) ? 0 : 1); if (u.mp >= turn) { u.mp -= turn; u.face = dir; }
  }
  if (halted) { G.undo = []; toast('Enemy spotted — brigade halts'); } else toast(`${G.sel.bdeName || 'Brigade'}: ${moved} units moved`);
  refreshVis(); selectGroup(G.sel);
}
function members() { return (G.group || [G.sel]).filter(u => u && u.side === G.side && !u.gone && u.type !== 'ldr' && !u.digging); }
function needOwn() { const u = G.sel; if (!u || u.side !== G.side || u.gone) { toast('Select one of your units first'); return null; } if (u.digging) { toast('This unit is digging in for the rest of the turn'); return null; } return u; }
function rotate(dir) { const u = needOwn(); if (!u) return; const cost = CW.isColumn(u) ? 0 : 1;
  if (u.mp < cost) return toast('Not enough movement points to turn'); snapshot(u); u.face = (u.face + dir + 6) % 6; u.mp -= cost; u.dug = 0; u.acted = 1; refreshVis(); select(u); }
function formation() { if (G.group) { const ms = members().filter(u => CW.TYPES[u.type].forms.length > 1 && u.mp >= CW.formCost(u) && !CW.TERRAIN[M.ter(u.c, u.r)].noForm); if (!ms.length) return toast('No battalion can change formation now'); snapshot(ms);
    ms.forEach(u => { const f = CW.TYPES[u.type].forms, old = CW.maxMP(u); u.form = f[(f.indexOf(u.form) + 1) % 2]; u.mp = Math.floor((u.mp - CW.formCost(u)) / old * CW.maxMP(u)); u.dug = 0; u.acted = 1; }); toast(`${ms.length} units changed formation`); return selectGroup(G.sel); }
  const u = needOwn(); if (!u) return; const f = CW.TYPES[u.type].forms; if (f.length < 2) return toast('This unit has a single formation');
  const t = CW.TERRAIN[M.ter(u.c, u.r)]; if (t.noForm) return toast(`Cannot change formation on a ${t.n.toLowerCase()}`);
  const cost = CW.formCost(u); if (u.mp < cost) return toast(`Needs ${cost} MP to change formation`);
  snapshot(u); const old = CW.maxMP(u); u.form = f[(f.indexOf(u.form) + 1) % 2]; u.mp = Math.floor((u.mp - cost) / old * CW.maxMP(u)); u.dug = 0; u.acted = 1;
  if (G.opts.difficulty !== 'beginner') u.org = clamp(u.org - 2); toast(`${u.name}: ${CW.FORMN[u.form]}`); select(u); }
async function rest() { if (G.group) { const ms = members().filter(u => !u.acted); if (!ms.length) return toast('Every battalion has already acted');
    const lvl = await CW.modal(`<h2>Rest brigade (${ms.length} units)</h2><label>Resupply <select name="l">${CW.SUPPLY_LEVELS.map(l => `<option value="${l[0]}" ${l[0] === 'full' ? 'selected' : ''}>${l[1]} — about ${ms.reduce((t, u) => t + CW.supplyCost(u, l[0]).cost, 0)} supply</option>`).join('')}</select></label>`, [['Cancel', null], ['Rest', f => f.querySelector('[name=l]').value, 1]]);
    if (!lvl) return; ms.forEach(u => { CW.restUnit(G, M, u); CW.resupply(G, M, u, lvl); u.mp = 0; u.acted = 1; }); G.undo = []; toast('Brigade rests'); return selectGroup(G.sel); }
  const u = needOwn(); if (!u) return; if (u.acted) return toast('Only units that have not acted this turn can rest');
  const cap = CW.maxLevel(G, M, u), order = CW.SUPPLY_LEVELS.map(l => l[0]);
  const opts = CW.SUPPLY_LEVELS.filter(l => order.indexOf(l[0]) >= order.indexOf(cap)).map(l => { const c = CW.supplyCost(u, l[0]); return `<option value="${l[0]}">${l[1]} (+${c.need} rounds, ${c.cost} supply)</option>`; }).join('');
  const lvl = await CW.modal(`<h2>Rest & Resupply — ${u.name}</h2><div class="hint">The unit rests for the rest of the turn, gathering stragglers (order, health, effective men). ${CW.nearHQ(G, u) ? 'Near its Corps HQ: better rest. ' : ''}${cap !== 'over' ? `<b>${CW.adjEnemies(G, M, u)} enemy units adjacent limits resupply.</b>` : ''}</div>
    <label>Ammunition (${u.sp}/${CW.spMax(u)} rounds · Army Supply ${G.supply[G.side]}) <select name="l">${opts}</select></label>`, [['Cancel', null], ['Rest', f => f.querySelector('[name=l]').value, 1]]);
  if (!lvl) return; snapshot(u); CW.restUnit(G, M, u); const cost = CW.resupply(G, M, u, lvl); u.mp = 0; u.acted = 1; G.undo = []; toast(`${u.name} rests${cost ? ` · ${cost} supply spent` : ''}`); if (G.opts.autoNext) nextUnit(true); else select(u); }
function dig() { if (G.group) { const ms = members().filter(u => !CW.canDig(M, u)); ms.forEach(u => { u.digging = 1; u.mp = 0; u.acted = 1; }); G.undo = []; toast(ms.length ? `${ms.length} units digging in` : 'No battalion can dig in here now'); return selectGroup(G.sel); }
  const u = needOwn(); if (!u) return; const why = CW.canDig(M, u); if (why) return toast(why);
  u.digging = 1; u.mp = 0; u.acted = 1; G.undo = []; toast(`${u.name} is digging in — entrenched at end of turn`); if (G.opts.autoNext) nextUnit(true); else select(u); }
function undo() { const s = G.undo.pop(); if (!s) return toast('Nothing to undo'); s.forEach(o => { const u = byId(o.id); Object.keys(u).forEach(k => delete u[k]); Object.assign(u, o); }); refreshVis(); if (G.group) selectGroup(byId(s[0].id)); else select(byId(s[0].id)); toast('Undone'); }
// Tab / Shift+Tab: step through the battalions of this brigade that can still move or fire, then on to the next brigade
// classic (CWG2) cycling: step through every regiment/battery that can still move or fire
function classicNext(dir = 1) { const act = mine().filter(x => x.type !== 'ldr' && x.type !== 'hq' && canActNow(x) && !x.skip), n = act.length;
  if (!n) { select(null); return toast('Every unit has moved — press E to end the turn'); }
  const i = act.indexOf(G.sel), nx = i < 0 ? act[dir > 0 ? 0 : n - 1] : act[(i + dir + n) % n]; select(nx); ensureVisible(nx.c, nx.r);
  toast(`${nx.name} · ${Math.floor(nx.mp)} MP${actInfo().can.has(nx.id) ? ' · can fire' : ''} (${n} can still act · Tab = next)`); }
function nextActor(dir = 1) { if (CW.CLASSIC) return classicNext(dir); const cur = G.sel, L = cur && cur.side === G.side && CW.ORD ? (cur.level === 'bde' ? cur : CW.ORD.colonelOf(G.units, cur)) : null;
  if (L) { const act = G.units.filter(x => x.bde === L.bde && x.side === G.side && !x.gone && x.type !== 'ldr' && canActNow(x)), n = act.length, i = act.indexOf(cur);
    if (n && !(n === 1 && act[0] === cur)) { const nx = i < 0 ? act[dir > 0 ? 0 : n - 1] : act[(i + dir + n) % n]; select(nx); ensureVisible(nx.c, nx.r);
      return toast(`${nx.name} · ${Math.floor(nx.mp)} MP${actInfo().can.has(nx.id) ? ' · can fire' : ''} (${n} in ${L.bdeName} can still act · Tab next)`); } }
  if (L && !L.ordered && !bdeDone(L)) L.ordered = 1;   // tabbed past the last one: this brigade is finished
  nextBrigade(L); }
CW.nextActor = nextActor;
function nextUnit(quiet) { if (CW.CLASSIC) return classicNext(1); if (G.sel && G.sel.side === G.side && G.sel.bde) return nextActor(1); const list = mine().filter(u => u.mp > 0 && CW.canMove(u) && !u.digging && !u.skip); if (!list.length) { select(null); return toast('All units have orders — press E to end the turn'); }
  const i = list.indexOf(G.sel), u = list[(i + 1) % list.length]; CW.select(u); }
function skip() { const u = needOwn(); if (!u) return; u.skip = 1; toast(`${u.name} skipped`); nextUnit(); }
async function endTurn() {
  if (CW.isModal() || !G.started) return; const my = mine();
  const wait = CW.waitingBdes(), idle = my.filter(u => !u.acted), partial = my.filter(u => u.type !== 'ldr' && u.type !== 'hq' && u.acted && u.mp >= 1 && CW.canMove(u) && !u.digging && !u.rested), low = my.filter(u => u.type !== 'ldr' && u.type !== 'hq' && u.sp < 3), digs = my.filter(u => u.digging);
  const est = l => idle.reduce((s, u) => s + CW.supplyCost(u, l).cost, 0);
  const lvl = await CW.modal(`<h2>End ${sideName(G.side)} turn?</h2><ul class="sum">
    <li><b>${idle.length}</b> unit${idle.length === 1 ? '' : 's'} with no orders will rest and resupply</li>
    ${partial.length ? `<li><b>${partial.length}</b> still have movement left: ${partial.slice(0, 4).map(u => u.name).join(', ')}${partial.length > 4 ? '…' : ''}</li>` : ''}
    ${low.length ? `<li class="warn"><b>${low.length}</b> low on ammunition: ${low.slice(0, 4).map(u => u.name).join(', ')}</li>` : ''}
    ${digs.length ? `<li><b>${digs.length}</b> will finish digging in</li>` : ''}
    ${wait.length ? `<li class="warn"><b>${wait.length}</b> brigade${wait.length === 1 ? ' has' : 's have'} no orders yet: ${wait.slice(0, 4).map(c => c.bdeName).join(', ')}${wait.length > 4 ? '…' : ''}</li>` : ''}</ul>
    <label>Resupply for resting units (Army Supply ${G.supply[G.side]}) <select name="l">${CW.SUPPLY_LEVELS.map(l => `<option value="${l[0]}" ${l[0] === 'full' ? 'selected' : ''}>${l[1]} — about ${est(l[0])} supply</option>`).join('')}</select></label>`,
    [['Keep playing', null], ...(wait.length ? [['Go to next brigade', 'next']] : []), ['End turn', f => f.querySelector('[name=l]').value, 1]]);
  if (lvl === 'next') return nextBrigade(null);
  if (!lvl) return;
  finishTurn(lvl);
}
// end the side's turn: idle units rest & resupply, digging finishes, the other side moves; also checks for the end of the battle
function finishTurn(lvl) { const my = mine(), idle = my.filter(u => !u.acted), digs = my.filter(u => u.digging);
  idle.forEach(u => { CW.restUnit(G, M, u); CW.resupply(G, M, u, lvl); });
  digs.forEach(u => { u.digging = 0; u.dug = 1; u.org = clamp(u.org + 3); u.hlth = clamp(u.hlth + 2); });
  const first = 'CS'; G.side = G.side === 'CS' ? 'US' : 'CS';
  if (G.side === first) { G.turn++; G.minutes = CW.nextTime(G.minutes); if (G.weather === 'rain') G.weather = 'mud'; else if (G.weather === 'mud' && Math.random() < .25) G.weather = 'clear'; else if (G.weather === 'fog' && CW.phase(G.minutes) === 'Day') G.weather = 'clear'; }
  startSideTurn();
  const alive = s => G.units.some(u => u.side === s && !u.gone && !['ldr', 'hq'].includes(u.type) && !u.routed);
  if (G.minutes >= G.endAt || !alive('CS') || !alive('US')) { G.over = 1; const v = CW.vp(), d = v.CS - v.US, lvl = Math.abs(d) >= 30 ? 'Major' : Math.abs(d) >= 10 ? 'Minor' : '';
    const c = G.cas || { CS: 0, US: 0 }; CW.modal(`<h2>${lvl ? `${lvl} ${d > 0 ? 'Confederate' : 'Union'} Victory` : 'Draw'}</h2><p>${CW.fmtTime(G.minutes)}.</p>
    <ul class="sum"><li>Victory points — Confederate <b>${v.CS}</b> · Union <b>${v.US}</b></li><li>Casualties — Confederate ${c.CS.toLocaleString()} · Union ${c.US.toLocaleString()}</li>
    <li>Objectives: ${G.obj.map(o => `${o[2]} (${o[4] ? (o[4] === 'CS' ? 'Confederate' : 'Union') : 'nobody'})`).join(', ')}</li></ul>`, [['Keep looking', null], ['Title screen', 't', 1]]).then(v2 => { if (v2 === 't') boot(); }); }
}
CW.finishTurn = finishTurn;
// the computer's turn: lock input, let src/ai.js play, then end the turn exactly as a player would
async function runAI() { if (!G.started || G.over || G.aiBusy || !isAI(G.side) || !CW.AI) return; const side = G.side, turn = G.turn;
  G.aiBusy = 1; select(null); aiBanner(`${sideName(side)} is moving…`);
  try { await CW.AI.takeTurn(G, M); } catch (e) { console.error('AI error', e); }
  G.aiBusy = 0; aiBanner(null); if (!G.started || G.side !== side || G.turn !== turn) return; finishTurn('full'); }
CW.runAI = runAI;
function aiBanner(t) { let b = $('aibanner'); if (!b) { b = document.createElement('div'); b.id = 'aibanner'; b.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);padding:6px 16px;border-radius:6px;background:rgba(20,12,6,.9);border:2px solid #9c7a33;color:#f3dc9a;font-size:14px;font-weight:700;pointer-events:none;z-index:5;display:none'; $('wrap').appendChild(b); }
  b.textContent = t || ''; b.style.display = t ? 'block' : 'none'; draw(); }
CW.aiSay = t => { G._aiSay = 1; toast(t); G._aiSay = 0; };
function startSideTurn() {
  G.units.forEach(u => { if (u.side === G.side) { u.mp = CW.inCommand(G.units, u) ? CW.maxMP(u) : Math.floor(CW.maxMP(u) * .75); u.acted = 0; u.skip = 0; u.rested = 0; u.fired = 0; u.assaulted = 0; u.ordered = 0; } });
  const fled = []; G.units.filter(u => u.side === G.side && u.routed && !u.gone).forEach(u => { const r = CW.routedMove(G, M, u); if (r && r !== 'flees') fled.push(`${u.name} ${r}`); });
  if (fled.length) setTimeout(() => toast(fled.join(' · ')), 2900);
  const arr = CW.arrivals(G, M); G.undo = []; refreshVis(); select(null); CW.autosave(G);
  const ph = CW.phase(G.minutes);
  toast(`${sideName(G.side)} turn · ${CW.fmtTime(G.minutes)}${ph !== 'Day' ? ' · ' + ph : ''}${arr.length ? ` · Reinforcements: ${arr.map(u => u.name).join(', ')}` : ''}`);
  if (arr.length) CW.centerOn(arr[0].c, arr[0].r);
  if (isAI(G.side)) { setTimeout(runAI, arr.length ? 2400 : 700); return; }
  const pend = CW.ORD ? CW.ORD.pending() : 0;
  // standing division orders move first, then the turn walks you through the brigades still waiting for orders
  setTimeout(() => { if (!G.started || CW.isModal()) return; if (pend) CW.ORD.advanceAll(); if (G.opts.autoNext && !G.sel) setTimeout(() => nextBrigade(null), pend ? 1600 : 0); }, arr.length ? 3000 : 900);
}
function cycleWeather() { const w = Object.keys(CW.WEATHER); G.weather = w[(w.indexOf(G.weather) + 1) % w.length]; toast(`Weather: ${CW.WEATHER[G.weather].n}`); CW.refresh(); }
async function menu() { if (CW.isModal()) return; const v = await CW.modal('<h2>Menu</h2>', [['Resume', null, 1], ['Save', 's'], ['Load', 'l'], ['Options', 'o'], ['Title screen', 't']]);
  if (v === 's') CW.saveDialog(G); if (v === 'l') { const s = await CW.loadDialog(); if (s) loadState(s); } if (v === 'o') CW.optionsDialog(G); if (v === 't') boot(); }
const tog = k => () => { G.tool[k] = !G.tool[k]; draw(); }, togo = k => () => { G.opts[k] = !G.opts[k]; CW.saveOpts(G.opts); CW.refresh(); };
function tiltBy(dv) { if (!is3D()) return toast('Tilt works on the 3D battlefield (press 3)'); const t = CW.R3.tilt(dv); draw(); toast(`View angle ${Math.round(t)}°${t <= 40 ? ' (lowest)' : t >= 80 ? ' (almost straight down)' : ''}`); }
const ACT = { C: () => { G.tool.cmd = !G.tool.cmd; draw(); toast(G.tool.cmd ? 'Command lines: whole army (solid = in command, red dashed = out of command)' : 'Command lines: selected unit only'); }, A: () => { const m = ['fire', 'assault', 'charge']; G.attackMode = m[(m.indexOf(G.attackMode) + 1) % 3]; toast(`Attack mode: ${MODEN[G.attackMode]}${G.attackMode === 'fire' ? ' (Shift+click an adjacent enemy to assault)' : ''}`); draw(); CW.panelTerrain(G, M); },
  Y: () => { const u = G.sel; if (!u || u.side !== G.side) return; const r = CW.rally(G, M, u); toast(r === 'rallied' ? `${u.name} rallies!` : r === 'failed' ? `${u.name} would not rally (3 army morale spent)` : r); select(u); }, B: () => { if (!G.sel) return toast('Select a battalion first'); G.group ? select(G.sel.type === 'ldr' ? G.group.find(u => u.type !== 'ldr') : G.sel) : selectGroup(G.sel); }, F: formation, U: undo, N: () => (!G.sel || (G.group && G.sel.level === 'bde')) ? nextBrigade(G.sel) : nextUnit(), E: endTurn, Q: () => G.group && G.sel && G.sel.level === 'bde' ? CW.ORD.blockWheel(G.sel, -1) : rotate(-1), W: () => G.group && G.sel && G.sel.level === 'bde' ? CW.ORD.blockWheel(G.sel, 1) : rotate(1), X: cycleWeather, R: rest, D: dig, K: () => holdBrigade() || skip(), M: menu,
  '?': () => { G.opts.coach = !G.opts.coach; CW.saveOpts(G.opts); draw(); },
  J: () => { if (CW.CLASSIC) return; G.opts.bdeMode = !G.opts.bdeMode; CW.saveOpts(G.opts); CW.refresh(); toast(G.opts.bdeMode ? 'Brigade command: click a battalion to command its whole brigade (Option-click = one battalion)' : 'Battalion command: click a battalion to command it alone'); },
  ' ': () => G.sel && CW.centerOn(G.sel.c, G.sel.r), G: togo('grid'), T: togo('counters'), V: togo('fog'), O: togo('roster'), H: tog('heights'), S: tog('sight'),
  Z: toggleOverview, '=': () => zoomBy(1.25), '+': () => zoomBy(1.25), '-': () => zoomBy(.8), '_': () => zoomBy(.8),
  '[': () => tiltBy(-6), ']': () => tiltBy(6),
  '3': () => { G.opts.flat = !G.opts.flat; CW.saveOpts(G.opts); draw(); toast(G.opts.flat ? 'Flat map (classic top-down). Press 3 for the 3D battlefield' : CW.R3 && CW.R3.failed ? '3D battlefield is unavailable on this computer' : '3D battlefield. [ and ] tilt the view'); },
  L: () => { G.tool.los = !G.tool.los; draw(); toast(G.tool.los ? 'Line-of-sight tool: hover any hex to see what can be seen from it' : 'LOS tool off'); } };
CW.act = k => { if (G.started && ACT[k] && (!G.aiBusy || 'Z+-=[]3'.includes(k))) ACT[k](); };

// ---------- input ----------
const toWorld = e => { const r = cv.getBoundingClientRect(); if (is3D()) return CW.R3.pick(e.clientX - r.left, e.clientY - r.top) || [-1e5, -1e5];   // 3D: follow the mouse ray down onto the hills
  return [(e.clientX - r.left - G.cam.x) / G.cam.z, (e.clientY - r.top - G.cam.y) / G.cam.z]; };
let drag = null, orderDrag = null;
const commanding = () => G.started && G.group && G.sel && G.sel.side === G.side && G.sel.level === 'div';
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: G.cam.x, cy: G.cam.y, moved: false, btn: e.button };
  if (e.button === 0 && commanding() && !G.aiBusy) { const h = CW.pixelToHex(M, ...toWorld(e)), here = h ? CW.unitsAt(G.units, ...h).filter(shown) : [];
    if (h && !here.some(o => o.side !== G.side)) orderDrag = { a: toWorld(e), cache: {} }; } });
window.addEventListener('pointerup', e => { const od = orderDrag; orderDrag = null;
  if (od && od.dragging) { drag = null; const L = G.sel; CW.ORD.issue(L, od.a, toWorld(e)); afterBrigade(L); return; }
  if (drag && !drag.moved && e.target === cv) click(e, drag.btn); drag = null; draw(); });
cv.addEventListener('pointermove', e => {
  if (orderDrag && drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 8) { orderDrag.dragging = drag.moved = true; }
    if (orderDrag.dragging) { orderDrag.pv = CW.ORD.preview(G.sel, orderDrag.a, toWorld(e), false, orderDrag.cache); draw(); return; } }
  if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 5) drag.moved = true; if (drag.moved) { G.cam.x = drag.cx + dx; G.cam.y = drag.cy + dy / (is3D() ? Math.sin(CW.R3.tiltDeg * Math.PI / 180) : 1); clampCam(); draw(); return; } }
  const h = CW.pixelToHex(M, ...toWorld(e)); if (String(h) !== String(G.hover)) { G.hover = h; draw(); CW.panelTerrain(G, M); } });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && orderDrag) { orderDrag = null; drag = null; draw(); } });
cv.addEventListener('pointerleave', () => { G.hover = null; draw(); });
cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, nz = Math.min(3, Math.max(.35, G.cam.z * Math.exp(-e.deltaY * .0015)));
  G.cam.x = mx - (mx - G.cam.x) * nz / G.cam.z; G.cam.y = my - (my - G.cam.y) * nz / G.cam.z; G.cam.z = nz; clampCam(); draw(); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
function click(e, btn) {
  if (!G.started || G.aiBusy) return; const h = CW.pixelToHex(M, ...toWorld(e)); if (!h) return; const here = CW.unitsAt(G.units, ...h).filter(shown);
  const foe = here.find(o => o.side !== G.side && o.type !== 'ldr');
  if (btn === 0 && foe && G.sel && G.group && G.sel.side === G.side) return groupAttack(foe, e.shiftKey);
  if (btn === 0 && foe && G.sel && !G.group && G.sel.side === G.side && !G.sel.gone && G.sel.type !== 'ldr' && G.sel.type !== 'hq') return tryAttack(foe, e.shiftKey);
  if (btn === 0 && G.group && G.sel.side === G.side && G.sel.level === 'div' && here.includes(G.sel)) return CW.ORD.hold();
  if (btn === 0 && G.group && G.sel.side === G.side && G.sel.level === 'bde' && !here.some(o => o.side !== G.side) && !here.includes(G.sel) && !here.some(o => G.group.includes(o) && o.type !== 'ldr')) { const L = G.sel; CW.ORD.blockMove(L, h); return afterBrigade(L); }
  if (btn === 0 && G.group && G.sel.side === G.side && !here.some(o => o.side !== G.side)) { if (!here.length || !here.some(o => o.side === G.side)) { const L = G.sel; CW.ORD.issue(L, CW.center(...h), null); return afterBrigade(L); } }
  if (btn === 0 && G.sel && G.reach && G.reach.has(CW.key(...h)) && !here.some(o => o.side !== G.sel.side)) return moveTo(h);
  if (here.length) { const i = here.indexOf(G.sel), u = here[(i + 1) % here.length];
    if (u.type === 'ldr' && u.side === G.side) return selectGroup(u);
    if (!CW.CLASSIC && G.opts.bdeMode && u.side === G.side && u.bde && !u.detached && !e.altKey && CW.ORD) { const L = CW.ORD.colonelOf(G.units, u); if (L) { selectGroup(L); toast(`${u.bdeName} — Option-click to handle ${u.name} on its own`); return; } }
    select(u); if (u.side !== G.side) toast('Enemy unit'); } else select(null);
}
window.addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || e.altKey) return; if (CW.isModal()) { if (e.key === 'Escape' && G.started) CW.closeModal(); return; }
  if (e.key === 'Escape') return select(null); if (e.key === 'Tab') { e.preventDefault(); if (G.started && !G.aiBusy) nextActor(e.shiftKey ? -1 : 1); return; } const k = e.key === ' ' ? ' ' : e.key.toUpperCase(); if (k.length === 1) { if (k === ' ') e.preventDefault(); CW.act(k); } });
function fit() { const w = cv.clientWidth, h = cv.clientHeight, dpr = window.devicePixelRatio || 1; cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!G.cam.init && w) { const L = G.opts.roster ? 246 : 0; G.cam.z = Math.min((w - L) / MW, h / MH); G.cam.x = L + (w - L - MW * G.cam.z) / 2; G.cam.y = (h - MH * G.cam.z) / 2; G.cam.init = 1; } draw(); }
window.addEventListener('resize', fit);
cv.addEventListener('contextrestored', () => { for (const k in mapCache) delete mapCache[k]; draw(); });   // GPU reset: repaint everything
document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => CW.act(b.dataset.act));

// ---------- game lifecycle ----------
// camera: start close (1:1, the scale the board is painted at) on the side to move; Z = whole-map overview and back
const fitZoom = () => { const w = cv.clientWidth, h = cv.clientHeight, L = G.opts.roster ? 246 : 0; return Math.min((w - L) / MW, h / MH); };
function armyView() { const us = mine().filter(u => u.type !== 'hq'); if (!us.length) return; G.cam.z = Math.max(fitZoom(), CW.CAM_Z);
  const pts = us.map(u => CW.center(u.c, u.r)), x = pts.reduce((t, p) => t + p[0], 0) / pts.length, y = pts.reduce((t, p) => t + p[1], 0) / pts.length, left = G.opts.roster ? 246 : 0;
  G.cam.x = left + (cv.clientWidth - left) / 2 - x * G.cam.z; G.cam.y = cv.clientHeight / 2 - y * G.cam.z; clampCam(); draw(); }
CW.CAM_Z = 1;
function zoomBy(f) { const w = cv.clientWidth, h = cv.clientHeight, nz = Math.min(3, Math.max(.35, G.cam.z * f)); G.cam.x = w / 2 - (w / 2 - G.cam.x) * nz / G.cam.z; G.cam.y = h / 2 - (h / 2 - G.cam.y) * nz / G.cam.z; G.cam.z = nz; clampCam(); draw(); }
function toggleOverview() { const fz = fitZoom(); if (G.cam.z > fz * 1.15) { G.cam.prev = { ...G.cam }; delete G.cam.prev.prev; const L = G.opts.roster ? 246 : 0; G.cam.z = fz; G.cam.x = L + (cv.clientWidth - L - MW * fz) / 2; G.cam.y = (cv.clientHeight - MH * fz) / 2; draw(); }
  else if (G.cam.prev) { Object.assign(G.cam, G.cam.prev); delete G.cam.prev; draw(); } else if (G.sel) { G.cam.z = CW.CAM_Z; CW.centerOn(G.sel.c, G.sel.r); } else armyView(); }
function newGame(side, difficulty, opp = 'ai') {
  Object.assign(G, { opp, over: 0, aiBusy: 0, aiMem: null, units: CW.buildArmy(M, window.OOB_DEMO), reinf: structuredClone(window.REINF_DEMO), obj: structuredClone(M.objectives || []), cas: { CS: 0, US: 0 }, side: 'CS', player: side, turn: 1, minutes: 480, weather: 'clear', supply: { CS: 400, US: 600 }, morale: { CS: 50, US: 50 }, endAt: 2160 });
  G.opts.difficulty = difficulty; CW.saveOpts(G.opts); G.started = true; armyView(); if (is3D()) CW.R3.sweep(G.cam, fitZoom(), draw); startSideTurn();
}
function loadState(s) { Object.assign(G, { opp: s.opp || 'hotseat', over: 0, aiBusy: 0, aiMem: s.aiMem || null, obj: s.obj || structuredClone(M.objectives || []), cas: s.cas || { CS: 0, US: 0 }, units: s.units, reinf: s.reinf || [], side: s.side, player: s.player || s.side, turn: s.turn, minutes: s.minutes, weather: s.weather, supply: s.supply, morale: s.morale, endAt: s.endAt || 2160 });
  G.started = true; G.undo = []; refreshVis(); select(null); armyView(); if (is3D()) CW.R3.sweep(G.cam, fitZoom(), draw); toast(`Loaded · ${CW.fmtTime(G.minutes)}`); if (isAI(G.side)) { setTimeout(runAI, 900); return; } if (G.opts.autoNext) setTimeout(() => { if (!G.sel && !CW.isModal()) nextBrigade(null); }, 900); }
async function boot() {
  G.started = false; draw();
  for (;;) { const v = await CW.titleScreen();
    if (v === 'continue') { loadState(CW.LS.get('cwg3.auto')); break; }
    if (v === 'new') { const r = await CW.newBattleDialog(G.opts); if (r) { newGame(r.side, r.difficulty, r.opp); break; } }
    if (v === 'load') { const s = await CW.loadDialog(); if (s) { loadState(s); break; } }
    if (v === 'options') await CW.optionsDialog(G);
    if (v === 'credits') await CW.credits(); }
  fit();
}
fit(); CW.panel(G, M); boot();
CW.resetMap = () => { for (const k in mapCache) delete mapCache[k]; draw(); };
if (document.fonts) document.fonts.ready.then(() => { for (const k in mapCache) delete mapCache[k]; draw(); });
})();
