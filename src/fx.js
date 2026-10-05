'use strict';
// Battle effects drawn over the map: musket smoke, flashes, cannon shots, bursts, floating casualty numbers.
CW.fx = [];
CW.addFx = f => { f.t0 = performance.now(); CW.fx.push(f); if (!CW.fxRunning) { CW.fxRunning = true; requestAnimationFrame(CW.fxLoop); } };
CW.fxLoop = () => { const now = performance.now(); CW.fx = CW.fx.filter(f => now - f.t0 < f.dur + (f.delay || 0)); CW.draw(); if (CW.fx.length) requestAnimationFrame(CW.fxLoop); else CW.fxRunning = false; };
// session 20: sprite smoke/flash/bursts (Kenney Smoke Particles, CC0) when assets/art/smoke_fx.js is loaded; code-drawn fallback otherwise
const SFX = window.CW.SMOKEFX ? Object.assign(CW.SMOKEFX, { img: new Image() }) : null;
if (SFX) { SFX.img.onload = () => { SFX.ok = true; }; SFX.img.src = SFX.src; }
function spr(ctx, i, x, y, s) { const c = SFX.cell, sx = (i % SFX.cols) * c, sy = Math.floor(i / SFX.cols) * c; ctx.drawImage(SFX.img, sx, sy, c, c, x - s / 2, y - s / 2, s, s); }
function sprFx(ctx, f, t, R) { const rnd = CW.rng(f.seed || 1);
  if (f.type === 'smoke') {   // a bank of powder smoke: puffs bloom fast, then drift downwind, swell and thin out
    for (let i = 0; i < 6; i++) { const ox = (rnd() - .5) * R * 1.0, oy = (rnd() - .5) * R * .45, k = SFX.puff[Math.floor(rnd() * SFX.puff.length)], st = rnd() * .15, u = Math.max(0, Math.min(1, (t - st) / (1 - st)));
      const s = R * (.55 + .7 * Math.sqrt(u) + rnd() * .2); ctx.globalAlpha = .88 * Math.min(1, u * 8) * Math.pow(1 - u, 1.3);
      spr(ctx, k, f.x + ox + (f.dx || 0) * u * 14 + u * 6, f.y + oy - u * 14, s); } }
  else if (f.type === 'flash') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, 1 - t * 1.4);
    spr(ctx, SFX.flash[Math.floor(rnd() * SFX.flash.length)], f.x, f.y, R * (.45 + .25 * t)); }
  else if (f.type === 'burst') {   // shell / ground burst: earth thrown up, then a grey-brown cloud
    for (let i = 0; i < 3; i++) { const k = SFX.burst[Math.floor(rnd() * SFX.burst.length)]; ctx.globalAlpha = .9 * Math.min(1, t * 10) * Math.pow(1 - t, 1.1);
      spr(ctx, k, f.x + (rnd() - .5) * R * .5, f.y - t * 10 - rnd() * 6, R * (.35 + .6 * t + rnd() * .15)); }
    if (t < .25) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - t * 4; spr(ctx, SFX.flash[0], f.x, f.y, R * .5); } } }
CW.drawFx = function (ctx) {
  const now = performance.now(), R = CW.R;
  for (const f of CW.fx) { const t = (now - f.t0 - (f.delay || 0)) / f.dur; if (t < 0 || t > 1) continue; ctx.save();
    if (SFX && SFX.ok && (f.type === 'smoke' || f.type === 'flash' || f.type === 'burst')) { sprFx(ctx, f, t, R); ctx.restore(); continue; }   // session 20: Kenney sprites
    if (f.type === 'smoke') { const rnd = CW.rng(f.seed); for (let i = 0; i < 9; i++) { const ox = (rnd() - .5) * R * 1.1, oy = (rnd() - .5) * R * .6, r = 6 + t * 16 + rnd() * 6;
        ctx.fillStyle = `rgba(225,225,220,${.55 * (1 - t)})`; ctx.beginPath(); ctx.arc(f.x + ox + f.dx * t * 10, f.y + oy - t * 12, r, 0, 7); ctx.fill(); } }
    if (f.type === 'flash') { const rnd = CW.rng(f.seed + Math.floor(t * 6)); for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(255,${200 + rnd() * 50},90,${1 - t})`; ctx.beginPath(); ctx.arc(f.x + (rnd() - .5) * R, f.y + (rnd() - .5) * R * .4, 2.5, 0, 7); ctx.fill(); } }
    if (f.type === 'shot') { const x = f.x + (f.x2 - f.x) * t, y = f.y + (f.y2 - f.y) * t - Math.sin(t * Math.PI) * f.arc; ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
    if (f.type === 'burst') { ctx.fillStyle = `rgba(120,95,60,${.7 * (1 - t)})`; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(f.x + Math.cos(i * 1.3) * t * 16, f.y + Math.sin(i * 1.3) * t * 10 - t * 8, 5 + t * 10, 0, 7); ctx.fill(); }
      ctx.fillStyle = `rgba(255,190,80,${1 - t * 2})`; ctx.beginPath(); ctx.arc(f.x, f.y, 10 * (1 - t), 0, 7); ctx.fill(); }
    if (f.type === 'text') { ctx.font = '700 15px Georgia,serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = f.col || '#ff8a6a'; ctx.globalAlpha = 1 - Math.max(0, t - .6) / .4;
      ctx.strokeText(f.text, f.x, f.y - t * 26); ctx.fillText(f.text, f.x, f.y - t * 26); }
    if (f.type === 'arrow') { ctx.strokeStyle = `rgba(255,236,170,${1 - t})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; const mx = f.x + (f.x2 - f.x) * Math.min(1, t * 1.6), my = f.y + (f.y2 - f.y) * Math.min(1, t * 1.6);
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(mx, my); ctx.stroke(); }
    ctx.restore(); }
};
// play the effects for a resolved combat
CW.playCombat = function (G, a, t, res, fromHex) {
  const [ax, ay] = CW.center(...fromHex), [tx, ty] = CW.center(t.c, t.r), art = a.type === 'art', seed = Math.floor(Math.random() * 1e6);
  if (res.kind !== 'volley') CW.addFx({ type: 'arrow', x: ax, y: ay, x2: tx, y2: ty, dur: 700 });
  if (art) { for (let i = 0; i < 3; i++) { CW.addFx({ type: 'flash', x: ax, y: ay, seed: seed + i, dur: 250, delay: i * 180 }); CW.addFx({ type: 'shot', x: ax, y: ay, x2: tx, y2: ty, arc: CW.dist(fromHex, [t.c, t.r]) * 6, dur: 600, delay: i * 180 }); CW.addFx({ type: 'burst', x: tx + (i - 1) * 12, y: ty, dur: 900, delay: 600 + i * 180 }); } CW.addFx({ type: 'smoke', x: ax + (tx - ax) * .12, y: ay + (ty - ay) * .12, dx: Math.sign(tx - ax), seed: seed + 5, dur: 2600, delay: 60 }); }
  else { CW.addFx({ type: 'flash', x: ax + (tx - ax) * .2, y: ay + (ty - ay) * .2, seed, dur: 350 }); CW.addFx({ type: 'smoke', x: ax + (tx - ax) * .25, y: ay + (ty - ay) * .25, dx: Math.sign(tx - ax), seed, dur: 2400 }); }
  const ret = res.rep.some(x => x.label === 'return fire' || x.label === 'defensive fire');
  if (ret) { CW.addFx({ type: 'flash', x: tx + (ax - tx) * .2, y: ty + (ay - ty) * .2, seed: seed + 9, dur: 350, delay: 250 }); CW.addFx({ type: 'smoke', x: tx + (ax - tx) * .25, y: ty + (ay - ty) * .25, dx: Math.sign(ax - tx), seed: seed + 9, dur: 2400, delay: 250 }); }
  let dA = 0, dT = 0; res.rep.forEach(x => { if (x.cas) { if (x.who === a.id) dA += x.cas; else dT += x.cas; } });
  if (dT) CW.addFx({ type: 'text', text: `−${dT}`, x: tx, y: ty - 10, dur: 1800, delay: art ? 700 : 300 });
  if (dA) CW.addFx({ type: 'text', text: `−${dA}`, x: ax, y: ay - 10, dur: 1800, delay: 500 });
};
