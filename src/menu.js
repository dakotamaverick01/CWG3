'use strict';
// Modals, title screen, options, save/load (browser slots + autosave + export/import files).
(function () {
const LS = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } } };
CW.LS = LS;
const ov = () => document.getElementById('overlay');
CW.closeModal = () => { ov().innerHTML = ''; ov().classList.remove('show'); };
// modal(html, [[label, value, primary?]]) → Promise(value)
CW.modal = (html, buttons = [['OK', true, 1]], wide) => new Promise(res => {
  const o = ov(); o.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}<div class="mbtns">${buttons.map((b, i) => `<button data-i="${i}" class="${b[2] ? 'primary' : ''}">${b[0]}</button>`).join('')}</div></div>`;
  o.classList.add('show'); o.querySelectorAll('.mbtns button').forEach(b => b.onclick = () => { const v = buttons[+b.dataset.i][1]; const form = o.querySelector('.modal'); CW.closeModal(); res(typeof v === 'function' ? v(form) : v); });
});
CW.isModal = () => ov().classList.contains('show');
// ---------- options ----------
CW.DEFAULT_OPTS = { coach: true, bdeMode: false, difficulty: 'intermediate', fog: true, autoNext: true, showRange: true, grid: false, counters: false, roster: true, minimap: true };
CW.loadOpts = () => ({ ...CW.DEFAULT_OPTS, ...(LS.get('cwg3.opts') || {}) });
CW.saveOpts = o => LS.set('cwg3.opts', o);
CW.optionsDialog = async function (G) {
  const o = G.opts, chk = (k, l) => `<label class="chk"><input type="checkbox" name="${k}" ${o[k] ? 'checked' : ''}> ${l}</label>`;
  const html = `<h2>Options</h2><label>Difficulty <select name="difficulty">${Object.entries(CW.DIFF).map(([k, v]) => `<option value="${k}" ${o.difficulty === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
   <div class="hint">Beginner: marching costs only movement points. Intermediate: marching wears down order and health. Advanced: good leaders and veteran units suffer less.</div>
   ${chk('fog', 'Fog of war (only see what your units can see)')}${chk('autoNext', 'Auto-select next unit when one runs out of movement')}${chk('showRange', 'Shade hexes out of reach')}${chk('grid', 'Hex grid')}${chk('counters', 'Counters instead of soldier figures')}${chk('roster', 'Unit roster')}${chk('flat', 'Flat map (classic top-down view instead of the 3D battlefield)')}${chk('minimap', 'Overview map')}`;
  const r = await CW.modal(html, [['Cancel', null], ['Save', f => f, 1]]); if (!r) return;
  o.difficulty = r.querySelector('[name=difficulty]').value; for (const k of ['fog', 'autoNext', 'showRange', 'grid', 'counters', 'roster', 'minimap', 'flat']) o[k] = r.querySelector(`[name=${k}]`).checked;
  CW.saveOpts(o); CW.refresh();
};
// ---------- saves ----------
CW.serialize = G => ({ v: 1, units: G.units, side: G.side, player: G.player, opp: G.opp, aiMem: G.aiMem, turn: G.turn, minutes: G.minutes, weather: G.weather, supply: G.supply, morale: G.morale, reinf: G.reinf, endAt: G.endAt, obj: G.obj, cas: G.cas, savedAt: new Date().toLocaleString() });
CW.autosave = G => LS.set('cwg3.auto', CW.serialize(G));
CW.saveDialog = async function (G) {
  const slots = LS.get('cwg3.slots') || {};
  const r = await CW.modal(`<h2>Save game</h2><label>Name <input name="n" value="${CW.fmtTime(G.minutes)}"></label><div class="hint">Saved in this browser. Use Export to keep a file in your CWG3 folder.</div>`, [['Cancel', null], ['Export file', 'x'], ['Save', f => f.querySelector('[name=n]').value || 'Save', 1]]);
  if (r === 'x') return CW.exportSave(G); if (!r) return;
  slots[r] = CW.serialize(G); if (LS.set('cwg3.slots', slots)) CW.toast(`Saved “${r}”`); else CW.toast('Browser storage unavailable — use Export file');
};
CW.exportSave = G => { const b = new Blob([JSON.stringify(CW.serialize(G))], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = `cwg3_save_${G.turn}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); CW.toast('Save file downloaded — move it into your CWG3/saves folder'); };
CW.loadDialog = async function () {
  const slots = LS.get('cwg3.slots') || {}, auto = LS.get('cwg3.auto'), names = Object.keys(slots);
  const list = (auto ? `<button class="slot" data-k="__auto">Autosave <small>${auto.savedAt}</small></button>` : '') + names.map(n => `<button class="slot" data-k="${n.replace(/"/g, '&quot;')}">${n} <small>${slots[n].savedAt}</small></button>`).join('');
  return new Promise(res => { CW.modal(`<h2>Load game</h2><div class="slots">${list || '<div class="hint">No saves in this browser yet.</div>'}</div><label class="chk">Or import a save file <input type="file" accept=".json" name="f"></label>`, [['Cancel', null]]).then(() => res(null));
    const o = ov(); o.querySelectorAll('.slot').forEach(b => b.onclick = () => { CW.closeModal(); res(b.dataset.k === '__auto' ? auto : slots[b.dataset.k]); });
    o.querySelector('[name=f]').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { CW.closeModal(); try { res(JSON.parse(t)); } catch (err) { CW.toast('That file is not a CWG3 save'); res(null); } }); }; });
};
// ---------- title ----------
CW.titleScreen = async function () {
  const auto = LS.get('cwg3.auto');
  const html = `<div class="title"><div class="tt">CWG3</div><div class="ts">A Civil War Generals remake · test build</div><div class="tb">
   ${auto ? `<button data-v="continue" class="primary">Continue <small>${auto.savedAt}</small></button>` : ''}<button data-v="new" class="${auto ? '' : 'primary'}">New battle — Millbrook</button><button data-v="load">Load game</button><button data-v="options">Options</button><button data-v="credits">Credits</button></div></div>`;
  const o = ov(); o.innerHTML = html; o.classList.add('show', 'full');
  return new Promise(res => o.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { o.classList.remove('full'); CW.closeModal(); res(b.dataset.v); }));
};
CW.newBattleDialog = async function (opts) {
  const html = `<h2>New battle — Millbrook</h2><div class="hint">Battalion scale (150-yard hexes, 20-minute turns). A creek valley, a walled ridge and a sunken lane. Battle ends at noon on Day 2.</div>
   <label>Command <select name="side"><option value="CS">Confederate (ridge, east)</option><option value="US">Union (valley, west)</option></select></label>
   <label>Opponent <select name="opp"><option value="ai" selected>Computer</option><option value="hotseat">Second player on this computer (hotseat)</option><option value="auto">Computer vs computer (watch)</option></select></label>
   <label>Difficulty <select name="difficulty">${Object.entries(CW.DIFF).map(([k, v]) => `<option value="${k}" ${opts.difficulty === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  return CW.modal(html, [['Back', null], ['Begin', f => ({ side: f.querySelector('[name=side]').value, difficulty: f.querySelector('[name=difficulty]').value, opp: f.querySelector('[name=opp]').value }), 1]]);
};
CW.credits = () => CW.modal(`<h2>Credits</h2><p>Design & build: John (director) with Claude.</p><p>Inspired by the mechanics of <i>Robert E. Lee: Civil War Generals 2</i> (Sierra, 1997). No original art, text, sound or code is used.</p><p>All map art, units and portraits are drawn in code. Font: Libre Baskerville (SIL Open Font License).</p><p>Officer names and the Millbrook battlefield are fictional.</p>`, [['Close', null, 1]]);
})();
