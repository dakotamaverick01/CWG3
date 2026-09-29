'use strict';
// Unit drawing: soldier figures (default) or tactical counters (T toggles). Facing shown by a chevron on the faced hexside.
CW.SIDE = { US: { coat: '#2d4f8f', pant: '#7a93b8', cap: '#253f73', flag: '#2e57a6', block: '#3a62b8' }, CS: { coat: '#8b8c86', pant: '#9a8660', cap: '#6e6f6a', flag: '#a8322a', block: '#b9463a' } };
const U_ = {};
U_.soldier = (ctx, x, y, s, sd, pose, mir) => { const p = CW.SIDE[sd]; ctx.save(); ctx.translate(x, y); ctx.scale(s * mir, s); ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 9, 4, 1.4, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = p.pant; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-1, 3); ctx.lineTo(-1.6, 9); ctx.moveTo(1, 3); ctx.lineTo(1.8, 9); ctx.stroke();
  ctx.fillStyle = p.coat; ctx.fillRect(-2.4, -4, 4.8, 7.5); ctx.fillStyle = '#e0b894'; ctx.beginPath(); ctx.arc(0, -6.2, 2.1, 0, 7); ctx.fill(); ctx.fillStyle = p.cap; ctx.fillRect(-2.3, -9, 4.4, 2.4);
  ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1; ctx.beginPath(); if (pose === 'aim') { ctx.moveTo(-1, -3); ctx.lineTo(8, -5); } else { ctx.moveTo(2.5, 4); ctx.lineTo(4, -10); } ctx.stroke(); ctx.restore(); };
U_.horse = (ctx, x, y, s, sd, mir, rider = true) => { ctx.save(); ctx.translate(x, y); ctx.scale(s * mir, s); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 9, 9, 2, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 1.6; ctx.beginPath(); for (const lx of [-5, -3, 4, 6]) { ctx.moveTo(lx, 2); ctx.lineTo(lx + (lx > 0 ? 1 : -1), 9); } ctx.stroke();
  ctx.fillStyle = '#6b4a30'; ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 3.6, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(5, -1); ctx.lineTo(9, -7); ctx.lineTo(11, -6); ctx.lineTo(8, 1); ctx.fill();
  if (rider) { const p = CW.SIDE[sd]; ctx.fillStyle = p.coat; ctx.fillRect(-2, -9, 4, 7); ctx.fillStyle = '#e0b894'; ctx.beginPath(); ctx.arc(0, -10.5, 1.9, 0, 7); ctx.fill(); ctx.fillStyle = p.cap; ctx.fillRect(-2.1, -13.2, 4.2, 2.2); } ctx.restore(); };
U_.cannon = (ctx, x, y, s, lim, mir) => { ctx.save(); ctx.translate(x, y); ctx.scale(s * mir, s); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 6, 10, 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2b2b2b'; ctx.save(); ctx.rotate(lim ? 0 : -.12); ctx.fillRect(-2, -3, 14, 4); ctx.restore(); ctx.strokeStyle = '#5a3c22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-11, 4); ctx.stroke();
  ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 1, 4.8, 0, 7); ctx.stroke(); ctx.restore(); };
U_.flag = (ctx, x, y, s, sd, star) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -14); ctx.stroke();
  ctx.fillStyle = CW.SIDE[sd].flag; ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(5, -16, 10, -13); ctx.lineTo(10, -7); ctx.quadraticCurveTo(5, -9, 0, -7); ctx.fill();
  if (star) { ctx.fillStyle = '#f3e3a0'; ctx.beginPath(); ctx.arc(5, -10.5, 1.6, 0, 7); ctx.fill(); } ctx.restore(); };
CW.drawFacing = (ctx, u, x, y, col) => { const R = CW.R, a = u.face * Math.PI / 3, ex = x + Math.cos(a) * R * .78, ey = y + Math.sin(a) * R * .78;
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-3, -6); ctx.lineTo(-1, 0); ctx.lineTo(-3, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); };
CW.drawFigures = function (ctx, u, x, y) {
  if (CW.drawKit && CW.drawKit(ctx, u, x, y)) return;
  if (CW.drawSprites && CW.drawSprites(ctx, u, x, y)) return;
  const R = CW.R, sd = u.side, a = u.face * Math.PI / 3, fx = Math.cos(a), fy = Math.sin(a), px = -fy, py = fx, mir = fx < -.1 ? -1 : 1;
  const n = u.size === 1 ? 3 : u.size === 2 ? 5 : 7, line = !CW.isColumn(u);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y + R * .3, R * .6, R * .17, 0, 0, 7); ctx.fill();
  const place = (i, m, sp) => line ? [x + px * (i - (m - 1) / 2) * sp, y + py * (i - (m - 1) / 2) * sp * .8] : [x + fx * ((m - 1) / 2 - i) * sp * .8 + px * ((i % 2) - .5) * 8, y + fy * ((m - 1) / 2 - i) * sp * .6 + py * ((i % 2) - .5) * 6];
  if (u.type === 'inf' || u.type === 'eng' || u.type === 'spec') { const m = u.type === 'inf' ? n : 3; const pts = [...Array(m).keys()].map(i => place(i, m, R * .26)).sort((p, q) => p[1] - q[1]);
    pts.forEach(p => U_.soldier(ctx, p[0], p[1], 1.35, sd, line || u.type === 'spec' ? 'aim' : 'shoulder', mir)); if (u.type !== 'spec') U_.flag(ctx, x - fx * 6, y - R * .22, 1.25, sd); }
  else if (u.type === 'cav' || u.type === 'scout') { const m = u.type === 'scout' ? 1 : u.size + 1;
    if (u.form === 'dism') [...Array(m + 1).keys()].map(i => place(i, m + 1, R * .28)).forEach(p => U_.soldier(ctx, p[0], p[1], 1.35, sd, 'aim', mir));
    else [...Array(m).keys()].map(i => place(i, m, R * .42)).sort((p, q) => p[1] - q[1]).forEach(p => U_.horse(ctx, p[0], p[1], 1.4, sd, mir));
    if (u.type === 'cav') U_.flag(ctx, x, y - R * .32, 1.2, sd); }
  else if (u.type === 'art') { if (u.form === 'lim') { U_.horse(ctx, x + fx * R * .3, y + fy * R * .15, 1.3, sd, mir, false); U_.cannon(ctx, x - fx * R * .25, y - fy * R * .1, 1.4, true, mir); }
    else { U_.cannon(ctx, x, y, 1.6, false, mir); U_.soldier(ctx, x - px * R * .4, y - py * R * .3, 1.3, sd, 'shoulder', mir); U_.soldier(ctx, x + px * R * .4, y + py * R * .3, 1.3, sd, 'shoulder', mir); } }
  else if (u.type === 'hq') { if (u.form === 'est') { ctx.fillStyle = '#e9e1c8'; ctx.strokeStyle = '#3a2a18'; ctx.beginPath(); ctx.moveTo(x - R * .45, y + R * .2); ctx.lineTo(x - R * .15, y - R * .35); ctx.lineTo(x + R * .15, y + R * .2); ctx.closePath(); ctx.fill(); ctx.stroke(); U_.soldier(ctx, x + R * .3, y - R * .05, 1.3, sd, 'shoulder', mir); }
    else U_.horse(ctx, x, y, 1.5, sd, mir); U_.flag(ctx, x + R * .3, y - R * .25, 1.35, sd, true); }
};
CW.drawCounter = function (ctx, u, x, y) {
  const s = CW.R * .6; ctx.save(); ctx.translate(x, y); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.fillStyle = CW.SIDE[u.side].block; const rr = (X, Y, w, h, r) => { ctx.beginPath(); ctx.moveTo(X + r, Y); ctx.arcTo(X + w, Y, X + w, Y + h, r); ctx.arcTo(X + w, Y + h, X, Y + h, r); ctx.arcTo(X, Y + h, X, Y, r); ctx.arcTo(X, Y, X + w, Y, r); ctx.closePath(); };
  rr(-s, -s * .78, s * 2, s * 1.56, 6); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6; const bw = s * 1.1, bh = s * .66, by = -s * .38; ctx.strokeRect(-bw / 2, by - bh / 2, bw, bh); ctx.beginPath();
  if (u.type === 'inf' || u.type === 'eng') { ctx.moveTo(-bw / 2, by - bh / 2); ctx.lineTo(bw / 2, by + bh / 2); ctx.moveTo(bw / 2, by - bh / 2); ctx.lineTo(-bw / 2, by + bh / 2); }
  if (u.type === 'cav' || u.type === 'scout') { ctx.moveTo(-bw / 2, by + bh / 2); ctx.lineTo(bw / 2, by - bh / 2); } ctx.stroke();
  ctx.fillStyle = '#fff'; if (u.type === 'art' || u.type === 'spec') { ctx.beginPath(); ctx.arc(0, by, 4, 0, 7); ctx.fill(); }
  if (u.type === 'hq') { ctx.beginPath(); ctx.moveTo(-bw / 2, by - bh / 2); ctx.lineTo(-bw / 2, by + bh * 1.1); ctx.stroke(); }
  ctx.font = '700 8px Inter,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(u.type === 'hq' ? 'XXX' : u.size >= 2 ? 'X' : 'III', 0, by - bh / 2 - 2.5);
  ctx.font = '600 9px Inter,system-ui,sans-serif'; ctx.fillText((u.men[2] / 1000).toFixed(1) + 'k', -s * .45, s * .55); ctx.fillText(u.mp + '', s * .62, s * .55);
  const mc = u.mor > 75 ? '#46c46a' : u.mor > 55 ? '#e6c43c' : '#e2553f'; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-s * .15, s * .47, s * .5, 4); ctx.fillStyle = mc; ctx.fillRect(-s * .15, s * .47, s * .5 * u.mor / 99, 4); ctx.restore();
};
CW.drawLeader = function (ctx, u, x, y, counter) {
  if (counter) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = CW.SIDE[u.side].block; ctx.strokeStyle = u.color || '#f3e3a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f3e3a0'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('★', 0, 3.5); ctx.restore(); return; }
  const mir = Math.cos(u.face * Math.PI / 3) < -.1 ? -1 : 1; const kitL = !!CW.KITIMG; if (kitL) { ctx.save(); kfig(ctx, u.side, 'rider', x, y + CW.R * .28, CW.R * (u.level === 'div' ? 1.1 : 1.0), mir < 0); ctx.restore(); ctx.save(); ctx.translate(0, -CW.R * .55); } else U_.horse(ctx, x, y, 1.25, u.side, mir);
  ctx.save(); ctx.translate(x - 4 * mir, y - 16); ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -8); ctx.stroke();
  ctx.fillStyle = u.color || CW.SIDE[u.side].flag; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(10 * mir, -5); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  if (kitL) ctx.restore();
  ctx.font = '700 8px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = u.level === 'div' ? '#f3e3a0' : (u.color || '#fff'); const lab = u.level === 'div' ? '★★ ' + (u.tag || '') : '★ ' + (u.tag || ''); ctx.strokeText(lab, x, y + 17); ctx.fillText(lab, x, y + 17);
};
// ---------- pre-rendered 3D sprites (assets/sprites, made by tools/sprites) ----------
CW.SPR = null;
(function loadSprites() { if (!window.SPRITES) return; const S = window.SPRITES, n = { men: new Image(), guns: new Image() }; let left = 2;
  for (const k of ['men', 'guns']) { n[k].onload = () => { if (--left === 0) { CW.SPR = { ...S, imgs: n }; CW.draw && CW.draw(); } }; n[k].src = S[k].img; } })();
const sprite = (ctx, sheet, key, x, y, size) => { const S = CW.SPR[sheet], f = S.frames[key]; if (!f) return; ctx.drawImage(CW.SPR.imgs[sheet], f[0], f[1], S.cell, S.cell, x - size / 2, y - size * .78, size, size); };
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
CW.uniformFor = (u, i) => { if (u.side === 'US') return 'us'; const butter = Math.abs(hash(u.bde || u.name)) % 2 === 1;
  return i % 3 === 2 ? 'cs_slouch' : butter ? 'cs_butter' : 'cs_gray'; };
CW.drawSprites = function (ctx, u, x, y) {
  if (!CW.SPR || !['inf', 'spec', 'eng', 'art'].includes(u.type)) return false;
  const R = CW.R, a = u.face * Math.PI / 3, fx = Math.cos(a), fy = Math.sin(a), px = -fy, py = fx, line = !CW.isColumn(u);
  const figs = [], add = (ox, oy, pose, dir, sheet = 'men', i = 0, size = R * .9) => figs.push({ x: x + ox, y: y + oy, pose, dir, sheet, i, size });
  if (u.type === 'art') {
    const guns = u.size >= 3 ? 3 : 2, shot = u.fired ? 'fire' : 'unl';
    if (u.form === 'lim') add(0, 0, 'napoleon/lim/' + u.face, u.face, 'guns', 0, R * 1.2);
    else for (let g = 0; g < guns; g++) { const o = (g - (guns - 1) / 2) * R * .5; add(px * o, py * o * .8, `napoleon/${g === 0 ? shot : 'unl'}/${u.face}`, u.face, 'guns', 0, R * .95);
      add(px * o - fx * R * .28 + px * 10, py * o * .8 - fy * R * .2, 'crew', (u.face + 1) % 6, 'men', g * 2); add(px * o - fx * R * .3 - px * 9, py * o * .8 - fy * R * .22 + 3, 'crew', (u.face + 5) % 6, 'men', g * 2 + 1); }
  } else {
    const n = u.type === 'spec' ? 3 : u.type === 'eng' ? 3 : [4, 4, 5, 6][u.size] || 5, routed = u.routed, dir = routed ? (u.face + 3) % 6 : u.face;
    for (let i = 0; i < n; i++) {
      let ox, oy; const bearer = u.type === 'inf' && i === 0;
      if (u.type === 'spec') { ox = px * (i - 1.5) * R * .32 + fx * ((i % 2) * 8 - 4); oy = py * (i - 1.5) * R * .26 + fy * ((i % 2) * 6 - 3); }
      else if (line) { const front = Math.ceil(n / 2), rank = i < front ? 0 : 1, k = rank ? i - front : i, m = rank ? n - front : front, sp = R * .3, off = (k - (m - 1) / 2) * sp + (rank ? sp / 2 : 0);
        ox = px * off - fx * rank * R * .24; oy = py * off * .92 - fy * rank * R * .2; }
      else { const row = Math.floor(i / 2), col = i % 2, depth = Math.ceil(n / 2); ox = fx * ((depth - 1) / 2 - row) * R * .22 + px * (col - .5) * R * .2; oy = fy * ((depth - 1) / 2 - row) * R * .17 + py * (col - .5) * R * .16; }
      if (bearer && line) { ox = px * R * .02 - fx * R * .1; oy = -fy * R * .08; }
      const ph = (i + (u.id || 0)) % 2 ? '1' : '2';
      let pose = routed ? 'charge' + ph : u.assaulted ? 'charge1' : line ? (u.fired || u.type === 'spec' ? (i % 3 === 0 ? 'fire' : 'aim') : 'stand') : 'march' + ph;
      if (bearer) pose = line && !routed ? 'bearer1' : 'bearer' + ph;
      if (u.type === 'eng' && !routed) pose = line ? 'crew' : 'march' + ph;
      add(ox, oy, pose, dir, 'men', i);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x, y + R * .12, R * .62, R * .22, 0, 0, 7); ctx.fill();
  figs.sort((p, q) => p.y - q.y).forEach(f => { if (f.sheet === 'guns') sprite(ctx, 'guns', f.pose, f.x, f.y, f.size); else sprite(ctx, 'men', `${CW.uniformFor(u, f.i)}/${f.pose}/${f.dir}`, f.x, f.y, f.size); });
  return true;
};
// ---------- painted figure kit (assets/art/kit.js, made by tools/build_kit.py) — preferred when loaded ----------
// CWG2 scale: one regiment = 6–8 bigger figures filling the hex. Union strong blue, Confederate grey/butternut; big side flags.
CW.KITIMG = null;
(function loadKit() { if (!window.KIT) return; const im = new Image(); im.onload = () => { CW.KITIMG = im; CW.draw && CW.draw(); }; im.src = window.KIT.img; })();
// one figure, feet at x,y, h px tall, turned to face left or right
const kfig = (ctx, side, name, x, y, h, left) => { const f = window.KIT.frames[side + '_' + name]; if (!f) return; const w = f[2] * h / f[3], flip = (f[4] === 'L') !== left;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y - 1, w * .32, h * .06, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.drawImage(CW.KITIMG, f[0], f[1], f[2], f[3], -w / 2, -h + h * .02, w, h); ctx.restore(); };
// regimental colours: Union = stars & stripes, Confederate = red battle flag with blue saltire
CW.bigFlag = (ctx, side, x, y, h, left, star) => { const d = left ? -1 : 1, top = y - h, fw = h * .52, fh = h * .34, t = Date.now() / 600, wv = Math.sin(t + x * .05) * h * .03;
  ctx.save(); ctx.strokeStyle = '#2a1d10'; ctx.lineWidth = Math.max(1.2, h * .035); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top - h * .05); ctx.stroke();
  const P = (u, v) => [x + d * u * fw, top + v * fh + Math.sin(u * 3 + t) * h * .035 * u + wv * u];
  const quad = (u0, v0, u1, v1, col) => { ctx.fillStyle = col; ctx.beginPath(); const s = 6; for (let i = 0; i <= s; i++) ctx.lineTo(...P(u0 + (u1 - u0) * i / s, v0)); for (let i = s; i >= 0; i--) ctx.lineTo(...P(u0 + (u1 - u0) * i / s, v1)); ctx.closePath(); ctx.fill(); };
  if (side === 'US') { for (let i = 0; i < 7; i++) quad(0, i / 7, 1, (i + 1) / 7, i % 2 ? '#f4efe4' : '#c4302b'); quad(0, 0, .42, 4 / 7, '#23408e'); }
  else { quad(0, 0, 1, 1, '#c4302b'); ctx.strokeStyle = '#f4efe4'; ctx.lineWidth = fh * .26; ctx.beginPath(); ctx.moveTo(...P(0, 0)); ctx.lineTo(...P(1, 1)); ctx.moveTo(...P(0, 1)); ctx.lineTo(...P(1, 0)); ctx.stroke();
    ctx.strokeStyle = '#23408e'; ctx.lineWidth = fh * .16; ctx.stroke(); }
  if (star) { ctx.fillStyle = '#f3e3a0'; ctx.font = `700 ${Math.round(fh * .7)}px system-ui`; ctx.textAlign = 'center'; const [sx, sy] = P(.5, .5); ctx.fillText('★', sx, sy + fh * .25); }
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...P(0, 0)); for (let i = 1; i <= 6; i++) ctx.lineTo(...P(i / 6, 0)); for (let i = 6; i >= 0; i--) ctx.lineTo(...P(i / 6, 1)); ctx.stroke(); ctx.restore(); };
const khash = n => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; return ((n >>> 0) % 1000) / 1000; };
CW.drawKit = function (ctx, u, x, y) {
  if (!CW.KITIMG) return false;
  const R = CW.R, sd = u.side, routed = u.routed, face = routed ? (u.face + 3) % 6 : u.face, a = face * Math.PI / 3, fx = Math.cos(a), fy = Math.sin(a), px = -fy, py = fx;
  const left = fx < -.1, away = fy < -.1, col = CW.isColumn(u), H = R * .74, base = y + R * .34, sq = .8, figs = [];
  const put = (ox, oy, name, h, i) => { const j = routed ? (khash(u.id * 31 + i) - .5) * R * .35 : 0; figs.push({ x: x + ox + j, y: base + oy * sq + (routed ? (khash(u.id * 17 + i) - .5) * R * .2 : 0), name, h: h * (.96 + khash(u.id * 7 + i) * .08) }); };
  let flagAt = null, bearer = null; const K = window.KIT.frames, has = n => !!K[sd + '_' + n];
  const moving = !u.fired && !u.assaulted && CW.maxMP && u.mp < CW.maxMP(u) * .7, charging = !!u.assaulted;
  if (u.type === 'inf' || u.type === 'eng' || u.type === 'spec') {
    const skirm = u.type === 'spec' || u.form === 'skirm', n = u.type === 'inf' ? ([6, 6, 7, 8][u.size] || 7) : 4;
    // poses: routed / marching = walking figures; charging = bayonets; fired = front rank kneels, rear rank stands firing
    const pose = (i, rank) => routed || away ? (i % 2 ? 'march2' : 'march') : charging && has('charge') ? 'charge'
      : skirm ? (u.fired ? (i % 2 ? 'kneel' : 'fire') : (i % 2 ? 'load' : 'kneel2'))
      : col ? (i % 2 ? 'march2' : 'march') : u.fired ? (rank ? 'fire' : (i % 2 ? 'kneel' : 'kneel2')) : moving ? (i % 2 ? 'march2' : 'march') : 'stand';
    const hOf = nm => /kneel|load/.test(nm) ? H * .74 : H;
    if (skirm) for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * R * .42, dep = (i % 2 ? -1 : 1) * R * .12, nm = pose(i, 0); put(px * off + fx * dep, py * off + fy * dep, nm, hOf(nm) * .95, i); }
    else if (!col) { const front = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const rank = i < front ? 0 : 1, k = rank ? i - front : i, m = rank ? n - front : front, sp = R * .4, off = (k - (m - 1) / 2) * sp + (rank ? sp / 2 : 0), nm = pose(i, rank);
        put(px * off - fx * rank * R * .32, py * off - fy * rank * R * .32, nm, hOf(nm), i); }
      if (u.type === 'inf') { flagAt = [x - fx * R * .15 + px * R * .05, base - fy * R * .15 * sq + py * R * .05 * sq]; bearer = 1;
        if (!routed && has('officer')) put(-px * R * .78 - fx * R * .12, -py * R * .78 - fy * R * .12, 'officer', H * 1.05, 91); } }
    else { const depth = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const row = Math.floor(i / 2), c = i % 2, along = ((depth - 1) / 2 - row) * R * .32, side_ = (c - .5) * R * .3;
        put(fx * along + px * side_, fy * along + py * side_, pose(i, 0), H, i); }
      if (u.type === 'inf') { flagAt = [x + fx * R * .05, base + fy * R * .05 * sq]; bearer = 1;
        if (!routed && has('drum')) put(fx * R * ((depth - 1) / 2 * .32 + .05) + px * R * .38, fy * R * ((depth - 1) / 2 * .32 + .05) + py * R * .38, 'drum', H * .92, 92); } }
  } else if (u.type === 'cav' || u.type === 'scout') {
    if (u.form === 'dism') { for (let i = 0; i < 4; i++) { const off = (i - 1.5) * R * .36, nm = away ? 'march' : u.fired ? (i % 2 ? 'kneel' : 'fire') : (i % 2 ? 'kneel2' : 'fire');
        put(px * off, py * off, nm, (/kneel/.test(nm) ? H * .74 : H) * .95, i); }
      if (has('horse') && !routed) put(-fx * R * .42 + px * R * .25, -fy * R * .42 + py * R * .25, 'horse', H * 1.05, 93); }
    else { const m = u.type === 'scout' ? 1 : Math.min(3, (u.size || 1) + 1), fast = charging || routed || moving;
      const rp = i => away ? 'rback' : charging ? 'gallop' : fast ? (i % 2 ? 'gallop' : 'trot') : (i % 2 ? 'trot' : 'walk');
      for (let i = 0; i < m; i++) { const off = (i - (m - 1) / 2) * R * .5, dep = (i % 2) * R * .18; put(px * off - fx * dep, py * off - fy * dep, has(rp(i)) ? rp(i) : 'rider', H * 1.2, i); }
      if (u.type === 'cav') { flagAt = [x - fx * R * .3, base - fy * R * .3 * sq - 2]; if (has('guidon') && !away) bearer = 2; } }
  } else if (u.type === 'art') {
    if (u.form === 'lim') put(0, 0, away && has('limback') ? 'limback' : 'limber', away ? R * .95 : R * .85, 0);
    else { const g = u.size >= 3 ? 2 : 1, gp = u.fired && has('gunfire') ? 'gunfire' : 'gun'; for (let i = 0; i < g; i++) { const off = (i - (g - 1) / 2) * R * .55; put(px * off - (i ? fx * R * .15 : 0), py * off, i && gp === 'gunfire' ? 'gun' : gp, R * (g > 1 ? .9 : 1.05), i); } }
  } else if (u.type === 'hq') { put(0, 0, 'rider', H * 1.4, 0); flagAt = [x + (left ? R * .3 : -R * .3), base - 3]; }
  else return false;
  // colour bearer: a painted figure carrying the pole; the flag cloth is drawn in code on top of his pike
  if (bearer === 1 && has('bearer') && !routed) put(flagAt[0] - x, (flagAt[1] - base) / sq + 1, 'bearer', H * 1.08, 90);
  if (bearer === 2) put(flagAt[0] - x, (flagAt[1] - base) / sq + 1, 'guidon', H * 1.2, 90);
  figs.sort((p, q) => p.y - q.y);
  const fh = R * (u.type === 'hq' ? 1.05 : .95), lift = bearer === 2 ? H * .75 : bearer ? H * .35 : 0;
  const drawFlag = () => flagAt && CW.bigFlag(ctx, sd, flagAt[0], flagAt[1] - lift, fh, left, u.type === 'hq');
  // the flag stands among the men: draw it after the back rank, before the front rank
  const mid = flagAt ? figs.findIndex(f => f.y > flagAt[1] + 1.5) : -1; figs.forEach((f, i) => { if (i === mid) drawFlag(); kfig(ctx, sd, f.name, f.x, f.y, f.h, left); });
  if (flagAt && mid < 0) drawFlag();
  return true;
};
