'use strict';
// Overview minimap + unit roster.
(function () {
const mini = document.getElementById('mini'), mc = mini.getContext('2d'), roster = document.getElementById('roster');
const ICON = { ldr: '★', inf: '⚑', cav: '♞', art: '◉', hq: '★', eng: '⚒', spec: '⌖', scout: '👁' };
CW.hud = function (G, M, MW, MH) {
  mini.style.display = G.opts.minimap && G.started ? 'block' : 'none'; roster.style.display = G.opts.roster && G.started ? 'block' : 'none';
  if (!G.started) return;
  if (G.opts.minimap) {
    const W = 200, H = Math.round(W * MH / MW); if (mini.width !== W * 2) { mini.width = W * 2; mini.height = H * 2; mini.style.width = W + 'px'; mini.style.height = H + 'px'; }
    const s = mini.width / MW; mc.setTransform(1, 0, 0, 1, 0, 0); mc.drawImage(CW.terrainImg(), 0, 0, mini.width, mini.height);
    const t = CW.TINT[CW.phase(G.minutes)]; if (t) { mc.fillStyle = t; mc.fillRect(0, 0, mini.width, mini.height); }
    G.units.filter(u => !u.gone && CW.shown(u)).forEach(u => { const [x, y] = CW.center(u.c, u.r); mc.fillStyle = CW.SIDE[u.side].block; mc.strokeStyle = '#fff'; mc.lineWidth = u === G.sel ? 3 : 1.2;
      mc.beginPath(); mc.arc(x * s, y * s, u === G.sel ? 8 : 6, 0, 7); mc.fill(); mc.stroke(); });
    const cv = document.getElementById('map'); mc.strokeStyle = '#fff'; mc.lineWidth = 2;
    mc.strokeRect(-G.cam.x / G.cam.z * s, -G.cam.y / G.cam.z * s, cv.clientWidth / G.cam.z * s, cv.clientHeight / G.cam.z * s);
    mini.onpointerdown = e => { const r = mini.getBoundingClientRect(), wx = (e.clientX - r.left) / r.width * MW, wy = (e.clientY - r.top) / r.height * MH;
      G.cam.x = cv.clientWidth / 2 - wx * G.cam.z; G.cam.y = cv.clientHeight / 2 - wy * G.cam.z; CW.draw(); };
  }
  if (G.opts.roster) {
    const list = G.units.filter(u => u.side === G.side && !u.gone);
    const status = u => [u.digging ? '⛏…' : u.dug ? '⛏' : '', u.rested ? '⛺' : '', u.sp < 3 ? '<span class="warn">ammo</span>' : '', u.org < 40 ? '<span class="warn">disorder</span>' : ''].filter(Boolean).join(' ');
    const row = u => { const done = CW.canActNow ? !CW.canActNow(u) : !(u.mp > 0 && CW.canMove(u) && !u.digging), oc = !CW.inCommand(G.units, u) ? '<span class="warn">out of cmd</span>' : '';
      return `<div class="ru ${u === G.sel || (G.group && G.group.includes(u)) ? 'sel' : ''} ${done ? 'done' : ''}" data-id="${u.id}"><span class="ri">${ICON[u.type] || '•'}</span><span class="rn">${u.name}</span><span class="rm">${CW.actInfo && CW.actInfo().can.has(u.id) ? '<span class="rfire" title="Can fire">⌖</span> ' : ''}${u.mp == null ? '–' : Math.floor(u.mp)}</span><div class="rs">${CW.FORMN[u.form]} ${status(u)} ${oc}</div></div>`; };
    G.fold = G.fold || new Set(); const isF = k => G.fold.has(k), fb = k => `<span class="fold" data-f="${k}">${isF(k) ? '▸' : '▾'}</span>`;
    const bdeBlock = bid => { const us = list.filter(u => u.bde === bid), L = us.find(u => u.level === 'bde'); const any = L || us[0];
      const done = !L || CW.bdeDone(L), ck = L ? (done ? ' <span class="ok">✓</span>' : ' <span class="await">● orders</span>') : '';
      return `<div class="rb ${done ? 'bdone' : 'bwait'}" ${L ? `data-id="${L.id}"` : ''}>${fb(bid)}<b style="color:${any.color}">■</b> ${any.tag ? `<small>${any.tag}</small> ` : ''}${any.bdeName}${ck}${L ? ` <small>${L.ldr}${CW.inCommand(G.units, L) ? '' : ' · <span class="warn">cut off</span>'}</small>` : ''}</div>` + (isF(bid) ? '' : us.filter(u => u.type !== 'ldr').map(row).join('')); };
    const divs = list.filter(u => u.level === 'div'), inDiv = new Set(divs.map(d => d.div));
    let html = `<div class="rh">${G.side === 'CS' ? 'Confederate' : 'Union'} army · ${list.filter(u => u.type !== 'ldr').length} units · <span class="fold" data-f="__all">fold all</span></div>`;
    const corps = list.filter(u => !u.bde && !u.div && u.type !== 'ldr');
    if (corps.length) html += `<div class="rd">${fb('__corps')}Corps troops</div>` + (isF('__corps') ? '' : corps.map(row).join(''));
    divs.forEach(D => { const bdes = [...new Set(list.filter(u => u.div === D.div && u.bde).map(u => u.bde))], ordCount = bdes.filter(bid => { const L = list.find(u => u.level === 'bde' && u.bde === bid); return !L || CW.bdeDone(L); }).length;
      const prog = !bdes.length ? '' : ordCount === bdes.length ? ' · <span class="ok">✓ all orders given</span>' : ` · <span class="await">${ordCount}/${bdes.length} brigades ordered</span>`;
      html += `<div class="rd" data-id="${D.id}">${fb(D.div)}${D.divName} <small>${D.ldr}${CW.corpsBonus(G.units, D) ? ' · ★ corps' : ''}${(() => { const cs = CW.ORD ? CW.ORD.colonels(G.units, D).filter(c => c.order) : []; return !cs.length ? '' : cs.some(c => c.order.contact) ? ' · <span class="warn">halted</span>' : cs.every(c => c.order.done) ? ' · in position' : ' · <span style="color:#ffcf7a">▶ on the march</span>'; })()}${prog}</small></div>`;
      if (!isF(D.div)) [...new Set(list.filter(u => u.div === D.div && u.bde).map(u => u.bde))].forEach(b => html += `<div class="ind">${bdeBlock(b)}</div>`); });
    [...new Set(list.filter(u => u.bde && !inDiv.has(u.div)).map(u => u.bde))].forEach(b => html += bdeBlock(b));
    if (roster.dataset.h !== html) { roster.innerHTML = html; roster.dataset.h = html; roster.querySelectorAll('.ru').forEach(el => el.onclick = () => CW.select(G.units.find(u => u.id === +el.dataset.id)));
      roster.querySelectorAll('.rb[data-id],.rd[data-id]').forEach(el => el.onclick = ev => { if (ev.target.classList.contains('fold')) return; const L = G.units.find(u => u.id === +el.dataset.id); CW.selectGroup(L); CW.centerOn(L.c, L.r); });
      roster.querySelectorAll('.fold').forEach(el => el.onclick = ev => { ev.stopPropagation(); const k = el.dataset.f; if (k === '__all') { const keys = [...new Set(list.map(u => u.div || u.bde).filter(Boolean))]; const allF = keys.every(x => G.fold.has(x)); keys.forEach(x => allF ? G.fold.delete(x) : G.fold.add(x)); } else G.fold.has(k) ? G.fold.delete(k) : G.fold.add(k); CW.draw(); }); }
  }
};
})();
