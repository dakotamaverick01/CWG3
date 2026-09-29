'use strict';
// Paints the battlefield once into an off-screen canvas ("Field Painting" look).
CW.PAL = { g: [112, 142, 70], c: [150, 150, 78], o: [104, 138, 66], f: [62, 92, 44], t: [150, 138, 110], h: [128, 136, 84], s: [92, 112, 78], k: [128, 122, 104], w: [112, 142, 70], b: [112, 142, 70], d: [112, 142, 70], x: [140, 126, 92] };
CW.boxBlur = function (src, w, h, rad, ch) {
  if (rad < 1) return src; let a = src, b = new Float32Array(src.length); const cl = (v, m) => v < 0 ? 0 : v > m ? m : v;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) for (let k = 0; k < ch; k++) { let s = 0; const row = y * w; for (let x = -rad; x <= rad; x++) s += a[(row + cl(x, w - 1)) * ch + k];
      for (let x = 0; x < w; x++) { b[(row + x) * ch + k] = s / (2 * rad + 1); s += a[(row + cl(x + rad + 1, w - 1)) * ch + k] - a[(row + cl(x - rad, w - 1)) * ch + k]; } }
    for (let x = 0; x < w; x++) for (let k = 0; k < ch; k++) { let s = 0; for (let y = -rad; y <= rad; y++) s += b[(cl(y, h - 1) * w + x) * ch + k];
      for (let y = 0; y < h; y++) { a[(y * w + x) * ch + k] = s / (2 * rad + 1); s += b[(cl(y + rad + 1, h - 1) * w + x) * ch + k] - b[(cl(y - rad, h - 1) * w + x) * ch + k]; } }
  }
  return a;
};
CW.smoothPath = function (ctx, pts) { ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
  ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); } };
CW.mapSize = M => [Math.ceil(CW.HW * (M.cols + 1) + CW.R * .6), Math.ceil(CW.R * 1.5 * (M.rows - 1) + 2 * CW.R + CW.R * .4)];
CW.renderMap = function (M, weather) {
  if (CW.ARTI && CW.renderMapArt) return CW.renderMapArt(M, weather);
  const R = CW.R, [MW, MH] = CW.mapSize(M), cv = document.createElement('canvas'); cv.width = MW; cv.height = MH; const ctx = cv.getContext('2d'), rand = CW.rng(7);
  const clampHex = (c, r) => [Math.max(0, Math.min(M.cols - 1, c)), Math.max(0, Math.min(M.rows - 1, r))];
  const hc = document.createElement('canvas'); hc.width = MW; hc.height = MH; const hx = hc.getContext('2d');
  ctx.fillStyle = `rgb(${CW.PAL.g})`; ctx.fillRect(0, 0, MW, MH); hx.fillStyle = '#000'; hx.fillRect(0, 0, MW, MH);
  for (let r = -1; r <= M.rows; r++) for (let c = -1; c <= M.cols; c++) { const [cc, rr] = clampHex(c, r), [x, y] = CW.center(c, r);
    ctx.fillStyle = `rgb(${CW.PAL[M.ter(cc, rr)]})`; CW.hexPath(ctx, x, y, R + 1); ctx.fill();
    const hv = M.h(cc, rr) * 50; hx.fillStyle = `rgb(${hv},${hv},${hv})`; CW.hexPath(hx, x, y, R + 1); hx.fill(); }
  const cd = ctx.getImageData(0, 0, MW, MH), hd = hx.getImageData(0, 0, MW, MH), N = MW * MH;
  let H = new Float32Array(N), C = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { H[i] = hd.data[i * 4] / 50; C[i * 3] = cd.data[i * 4]; C[i * 3 + 1] = cd.data[i * 4 + 1]; C[i * 3 + 2] = cd.data[i * 4 + 2]; }
  H = CW.boxBlur(H, MW, MH, Math.round(R * .7), 1); C = CW.boxBlur(C, MW, MH, Math.round(R * .22), 3);
  const g = 16, gw = Math.ceil(MW / g) + 2, G = new Float32Array(gw * (Math.ceil(MH / g) + 2)).map(() => rand() - .5), out = cd.data, wet = weather === 'mud' || weather === 'rain';
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x, xl = Math.max(0, x - 1), xr = Math.min(MW - 1, x + 1), yu = Math.max(0, y - 1), yd = Math.min(MH - 1, y + 1);
    const dx = (H[y * MW + xr] - H[y * MW + xl]) * R, dy = (H[yd * MW + x] - H[yu * MW + x]) * R; let sh = 1 + (dx + dy) * .2; sh = Math.max(.62, Math.min(1.1, sh));
    const gx = x / g, gy = y / g, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
    const n = (G[iy * gw + ix] * (1 - fx) + G[iy * gw + ix + 1] * fx) * (1 - fy) + (G[(iy + 1) * gw + ix] * (1 - fx) + G[(iy + 1) * gw + ix + 1] * fx) * fy, nz = n * 22 + (rand() - .5) * 11, h = H[i];
    const lift = [5 * h, 3 * h, -3 * h]; for (let k = 0; k < 3; k++) { let v = (C[i * 3 + k] + lift[k]) * sh + nz; if (wet) v = v * .88 - (k === 2 ? 0 : 6); out[i * 4 + k] = v < 0 ? 0 : v > 255 ? 255 : v; } }
  ctx.putImageData(cd, 0, 0);
  CW.paintFeatures(ctx, M, rand);
  return cv;
};
CW.paintFeatures = function (ctx, M, rand) {
  const R = CW.R, each = (t, fn) => M.all.forEach(([c, r]) => { if (M.ter(c, r) === t) fn(...CW.center(c, r), c, r); });
  // crop fields: furrow rows
  each('c', (x, y) => { ctx.save(); CW.hexPath(ctx, x, y, R); ctx.clip(); ctx.strokeStyle = 'rgba(90,80,30,.28)'; ctx.lineWidth = 2; for (let i = -R; i < R; i += 6) { ctx.beginPath(); ctx.moveTo(x - R, y + i); ctx.lineTo(x + R, y + i + 8); ctx.stroke(); } ctx.restore(); });
  // swamp
  each('s', (x, y) => { for (let i = 0; i < 10; i++) { const px = x + (rand() - .5) * R * 1.4, py = y + (rand() - .5) * R * 1.2; ctx.strokeStyle = 'rgba(40,60,30,.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(px + 6, py); ctx.stroke(); for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(px + j * 3, py); ctx.lineTo(px + j * 4.5, py - 6 - rand() * 4); ctx.stroke(); }
    if (i % 3 === 0) { ctx.fillStyle = 'rgba(80,110,120,.45)'; ctx.beginPath(); ctx.ellipse(px, py + 4, 9, 3, 0, 0, 7); ctx.fill(); } } });
  // river (smooth line through river hexes, extended off-map)
  const riv = M.all.filter(([c, r]) => 'wbd'.includes(M.ter(c, r))).map(h => CW.center(...h)).sort((a, b) => a[1] - b[1]);
  if (riv.length) { riv.unshift([riv[0][0], riv[0][1] - R * 1.4]); riv.push([riv[riv.length - 1][0], riv[riv.length - 1][1] + R * 1.4]);
    const rw = R * .42; CW.smoothPath(ctx, riv); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(60,50,30,.55)'; ctx.lineWidth = rw + 8; ctx.stroke();
    ctx.strokeStyle = '#3f6b84'; ctx.lineWidth = rw; ctx.stroke(); ctx.strokeStyle = 'rgba(150,195,215,.45)'; ctx.lineWidth = rw * .35; ctx.stroke(); }
  // woods & orchards
  const tree = (px, py, s) => { ctx.fillStyle = 'rgba(20,30,15,.35)'; ctx.beginPath(); ctx.arc(px + 3, py + 3, s, 0, 7); ctx.fill(); const gr = ctx.createRadialGradient(px - s * .4, py - s * .4, 1, px, py, s);
    gr.addColorStop(0, `rgb(${96 + rand() * 30},${128 + rand() * 25},58)`); gr.addColorStop(1, 'rgb(38,62,30)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, s, 0, 7); ctx.fill(); };
  each('f', (x, y) => { for (let i = 0; i < 26; i++) tree(x + (rand() - .5) * R * 1.6, y + (rand() - .5) * R * 1.5, 5 + rand() * 5); });
  each('o', (x, y) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) tree(x + i * R * .45 + (j & 1) * 6, y + j * R * .42, 4.5); });
  // roads
  const roadCol = M.weather === 'mud' ? ['#7a6440', '#8a7048'] : ['#b99d6c', '#a88d5f'];
  for (const rd of M.roads) { const pts = rd.p.map(p => CW.center(...p)); CW.smoothPath(ctx, pts);
    ctx.strokeStyle = 'rgba(70,52,30,.6)'; ctx.lineWidth = rd.major ? 9 : 6.5; ctx.stroke(); ctx.strokeStyle = rd.major ? roadCol[0] : roadCol[1]; ctx.lineWidth = rd.major ? 6 : 4; ctx.stroke(); }
  // sunken road: dark banks
  M.sunken.forEach(([c, r]) => { const [x, y] = CW.center(c, r); ctx.strokeStyle = 'rgba(40,30,15,.7)'; ctx.lineWidth = 2; for (const s of [-7, 7]) { ctx.beginPath(); ctx.moveTo(x - CW.HW / 2, y + s); ctx.lineTo(x + CW.HW / 2, y + s); ctx.stroke(); } });
  // hex features
  M.all.forEach(([c, r]) => { const t = M.ter(c, r), [x, y] = CW.center(c, r);
    if (t === 'b') { ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#8b6b43'; ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.5; ctx.fillRect(-R * .55, -7, R * 1.1, 14); ctx.strokeRect(-R * .55, -7, R * 1.1, 14);
      for (let i = -R * .5; i < R * .55; i += 5) { ctx.beginPath(); ctx.moveTo(i, -7); ctx.lineTo(i, 7); ctx.stroke(); } ctx.restore(); }
    if (t === 'd') { ctx.fillStyle = 'rgba(220,210,170,.9)'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(x + i * 6, y + (i % 2) * 2, 2, 0, 7); ctx.fill(); } }
    if (t === 'k') for (let i = 0; i < 8; i++) { const px = x + (rand() - .5) * R * 1.2, py = y + (rand() - .5) * R, s = 4 + rand() * 6; ctx.beginPath(); ctx.moveTo(px - s, py + s * .5); ctx.lineTo(px - s * .3, py - s * .7); ctx.lineTo(px + s * .6, py - s * .4); ctx.lineTo(px + s, py + s * .5); ctx.closePath();
      ctx.fillStyle = `rgb(${140 + rand() * 30},${135 + rand() * 25},120)`; ctx.fill(); ctx.strokeStyle = 'rgba(40,36,30,.7)'; ctx.lineWidth = 1; ctx.stroke(); }
    if (t === 't' || t === 'h') { const n = t === 't' ? 6 : 2; for (let i = 0; i < n; i++) { const px = x + (rand() - .5) * R * (t === 't' ? 1.1 : .6), py = y + (rand() - .5) * R * .8, w = 9 + rand() * 7, h = 7 + rand() * 4;
      ctx.fillStyle = t === 'h' && i ? '#8a3b2a' : '#d7cdb4'; ctx.fillRect(px - w / 2, py - h / 2, w, h); ctx.fillStyle = '#7a3d2a'; ctx.fillRect(px - w / 2 - 1, py - h / 2 - 3, w + 2, h * .55); ctx.strokeStyle = 'rgba(30,20,10,.6)'; ctx.strokeRect(px - w / 2, py - h / 2, w, h); } }
    if (t === 'x') { ctx.save(); ctx.translate(x, y); ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, rr = i % 2 ? R * .42 : R * .7; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
      ctx.fillStyle = 'rgba(120,100,70,.55)'; ctx.fill(); ctx.strokeStyle = '#4a3a22'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); } });
  // edges: walls, fences, streams
  M.edgeAt.forEach((types, k) => { const [c, r, d] = k.split(',').map(Number), [x, y] = CW.center(c, r), p = CW.corner(x, y, d), q = CW.corner(x, y, d + 1);
    for (const t of types) {
      if (t === 'stream') { ctx.strokeStyle = '#4c7a90'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(...p); const mx = (p[0] + q[0]) / 2 + (rand() - .5) * 6, my = (p[1] + q[1]) / 2 + (rand() - .5) * 6; ctx.quadraticCurveTo(mx, my, ...q); ctx.stroke(); }
      if (t === 'fence') { ctx.strokeStyle = 'rgba(92,64,36,.9)'; ctx.lineWidth = 1.3; const n = 6; ctx.beginPath(); for (let i = 0; i <= n; i++) { const f = i / n, px = p[0] + (q[0] - p[0]) * f, py = p[1] + (q[1] - p[1]) * f + (i % 2 ? -2 : 2); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
      if (t === 'wall') { const n = 8; for (let i = 0; i <= n; i++) { const f = i / n; ctx.fillStyle = `rgb(${150 + rand() * 25},${146 + rand() * 20},${134})`; ctx.beginPath(); ctx.arc(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, 2.8, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(30,30,30,.55)'; ctx.lineWidth = .8; ctx.stroke(); } }
    } });
  // supply wagons
  M.supply.forEach(([c, r, s]) => { const [x, y] = CW.center(c, r); CW.drawWagon(ctx, x, y + R * .45, s); });
  // labels
  ctx.textAlign = 'center'; ctx.font = "italic 13px 'Libre Baskerville',Georgia,serif"; ctx.lineWidth = 3;
  M.labels.forEach(([t, c, r, dy]) => { const [x, y] = CW.center(c, r); ctx.strokeStyle = 'rgba(240,230,200,.7)'; ctx.fillStyle = '#2b2116'; ctx.strokeText(t, x, y + dy * R); ctx.fillText(t, x, y + dy * R); });
};
CW.drawWagon = function (ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(.9, .9); ctx.fillStyle = '#efe6cf'; ctx.strokeStyle = '#2b2116'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(-11, -13, 0, -13); ctx.quadraticCurveTo(11, -13, 11, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-12, 0, 24, 4);
  for (const wx of [-7, 7]) { ctx.beginPath(); ctx.arc(wx, 6, 4, 0, 7); ctx.fillStyle = '#3a2a18'; ctx.fill(); } ctx.fillStyle = s === 'US' ? '#2d4f8f' : '#8f2d2d'; ctx.fillRect(-3, -9, 6, 5); ctx.restore(); };
