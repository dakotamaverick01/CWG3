'use strict';
// CWG3 core: hex math + map model. Pointy-top hexes, odd rows shifted right ("odd-r").
// Directions: 0=E 1=SE 2=SW 3=W 4=NW 5=NE. Edge d lies between corners d and d+1 (corner angle 60d-30°).
const CW = window.CW = {};
// V1 = classic CWG2 play: every regiment moves on its own; the brigade/division standing-order UI is switched off (code kept for the AI and later versions)
CW.CLASSIC = true;
CW.R = 44; CW.SQ3 = Math.sqrt(3); CW.HW = CW.SQ3 * CW.R;
CW.rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const EV = [[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]], OD = [[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]];
CW.step = (c, r, d) => { const o = (r & 1 ? OD : EV)[d]; return [c + o[0], r + o[1]]; };
CW.key = (c, r) => c + ',' + r;
CW.unkey = k => k.split(',').map(Number);
CW.center = (c, r) => [CW.HW * (c + .5) + (r & 1 ? CW.HW / 2 : 0) + CW.R * .3, CW.R + r * 1.5 * CW.R + CW.R * .2];
CW.corner = (x, y, i, s = CW.R) => { const a = Math.PI / 180 * (60 * i - 30); return [x + s * Math.cos(a), y + s * Math.sin(a)]; };
CW.hexPath = (ctx, x, y, s = CW.R) => { ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(...CW.corner(x, y, i, s)); ctx.closePath(); };
CW.toCube = (c, r) => { const x = c - (r - (r & 1)) / 2; return [x, r, -x - r]; };
CW.fromCube = (x, z) => [x + (z - (z & 1)) / 2, z];
CW.dist = (a, b) => { const p = CW.toCube(...a), q = CW.toCube(...b); return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])); };
CW.cubeRound = (x, y, z) => { let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z); const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry; return [rx, ry, rz]; };
// hexes on the line a→b (inclusive), nudged to avoid ties
CW.line = (a, b) => { const p = CW.toCube(...a), q = CW.toCube(...b), n = CW.dist(a, b), out = [];
  for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; const c = CW.cubeRound(p[0] + (q[0] - p[0]) * t + 1e-6, p[1] + (q[1] - p[1]) * t + 2e-6, p[2] + (q[2] - p[2]) * t - 3e-6); out.push(CW.fromCube(c[0], c[1])); } return out; };
CW.dirTo = (a, b) => { for (let d = 0; d < 6; d++) { const s = CW.step(...a, d); if (s[0] === b[0] && s[1] === b[1]) return d; } return -1; };
CW.rotDist = (a, b) => { const d = Math.abs(a - b) % 6; return Math.min(d, 6 - d); };
// general direction from a to a far hex (0..5), by angle
CW.dirToward = (a, b) => { const p = CW.center(...a), q = CW.center(...b); let ang = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI; return ((Math.round(ang / 60) % 6) + 6) % 6; };

// ---------- map model ----------
CW.loadMap = function (m) {
  const M = { ...m, roadAt: new Map(), edgeAt: new Map(), sunkenSet: new Set((m.sunken || []).map(p => CW.key(...p))) };
  M.in = (c, r) => c >= 0 && r >= 0 && c < M.cols && r < M.rows;
  M.ter = (c, r) => M.terrain[r][c];
  M.h = (c, r) => +M.height[r][c];
  M.roads.forEach(rd => rd.p.forEach(([c, r], i) => { const k = CW.key(c, r), s = M.roadAt.get(k) || { major: 0, links: new Set() }; s.major |= rd.major;
    if (i > 0) s.links.add(CW.key(...rd.p[i - 1])); if (i < rd.p.length - 1) s.links.add(CW.key(...rd.p[i + 1])); M.roadAt.set(k, s); }));
  const ek = (c, r, d) => { const [a, b] = CW.step(c, r, d); return d < 3 ? `${c},${r},${d}` : `${a},${b},${d - 3}`; };
  M.edgeKey = ek;
  M.edges.forEach(([c, r, d, types]) => { const k = ek(c, r, d), s = M.edgeAt.get(k) || new Set(); types.forEach(t => s.add(t)); M.edgeAt.set(k, s); });
  M.edge = (c, r, d) => M.edgeAt.get(ek(c, r, d)) || null;
  M.roadLinked = (a, b) => { const s = M.roadAt.get(CW.key(...a)); return !!(s && s.links.has(CW.key(...b))); };
  M.all = []; for (let r = 0; r < M.rows; r++) for (let c = 0; c < M.cols; c++) M.all.push([c, r]);
  M.nbrs = (c, r) => { const o = []; for (let d = 0; d < 6; d++) { const s = CW.step(c, r, d); if (M.in(...s)) o.push([s[0], s[1], d]); } return o; };
  return M;
};
CW.pixelToHex = (M, x, y) => { let best = null, bd = 1e9; for (const [c, r] of M.all) { const [cx, cy] = CW.center(c, r), d = (cx - x) ** 2 + (cy - y) ** 2; if (d < bd) { bd = d; best = [c, r]; } } return bd < CW.R * CW.R * 1.05 ? best : null; };
