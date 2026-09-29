'use strict';
// Terrain + unit rules (see docs/TERRAIN_DESIGN.md). All numbers are tunable starting values.
CW.TERRAIN = {
  g: { n: 'Grass', col: 2, line: 3, cover: 0, obs: 0, open: 1 },
  c: { n: 'Crop field', col: 2, line: 3, cover: 0, obs: 0, open: 1 },
  o: { n: 'Orchard', col: 3, line: 4, cover: 1, obs: 1, light: 1 },
  f: { n: 'Forest', col: 4, line: 6, cover: 3, obs: 2, woods: 1 },
  t: { n: 'Town', col: 1.5, line: 5, cover: 2, obs: 1, noDig: 1 },
  h: { n: 'Farm', col: 2, line: 3, cover: 1, obs: 1, light: 1 },
  k: { n: 'Rocky knoll', col: 5, line: 6, cover: 4, obs: 0, morale: 5 },
  s: { n: 'Swamp', col: 6, line: 8, cover: -2, obs: 0, noArt: 1, noDig: 1 },
  w: { n: 'River', col: 99, line: 99, cover: -3, obs: 0, noDig: 1 },
  b: { n: 'Bridge', col: 1, line: 3, cover: -3, obs: 0, noDig: 1, noForm: 1 },
  d: { n: 'River ford', col: 5, line: 6, cover: -4, obs: 0, noDig: 1, noForm: 1 },
  x: { n: 'Fort', col: 3, line: 3, cover: 6, obs: 0, morale: 5 },
};
CW.EDGES = {
  wall:   { n: 'Stone wall', mp: 2, cover: 3, artRoadOnly: 1 },
  fence:  { n: 'Rail fence', mp: 1, cover: 1 },
  stream: { n: 'Stream', mp: 2, cover: 1 },
};
CW.WEATHER = {
  clear: { n: 'Clear', sight: 0 },
  rain:  { n: 'Rain', sight: -1 },
  mud:   { n: 'Mud', sight: 0, mud: 1 },
  fog:   { n: 'Dawn fog', sight: 0, cap: 2 },
};
// unit types: mp by formation, sight, which formation moves as column
CW.TYPES = {
  inf:   { n: 'Infantry',    forms: ['march', 'combat'],    mp: { march: 12, combat: 8 }, sight: 6 },
  cav:   { n: 'Cavalry',     forms: ['mounted', 'dism'],    mp: { mounted: 20, dism: 10 }, sight: 8 },
  art:   { n: 'Artillery',   forms: ['lim', 'unl'],         mp: { lim: 10, unl: 10 }, fixed: ['unl'], fcost: 5, sight: 6 },
  hq:    { n: 'Corps HQ',    forms: ['mounted', 'est'],     mp: { mounted: 16, est: 16 }, fixed: ['est'], sight: 8 },
  eng:   { n: 'Engineers',   forms: ['march', 'work'],      mp: { march: 10, work: 10 }, fixed: ['work'], sight: 6 },
  spec:  { n: 'Specialists', forms: ['one'],                mp: { one: 14 }, sight: 7, zocAll: 1 },
  ldr:   { n: 'Brigade commander', forms: ['mounted'], mp: { mounted: 20 }, sight: 7 },
  scout: { n: 'Scouts',      forms: ['one'],                mp: { one: 22 }, sight: 10 },
};
CW.FORMN = { ldr: 'Mounted', combat: 'Combat formation', march: 'Marching column', unl: 'Unlimbered', lim: 'Limbered', mounted: 'Mounted', dism: 'Dismounted', est: 'Established', one: 'Skirmish order', work: 'Working' };
CW.isColumn = u => ['march', 'lim', 'mounted'].includes(u.form) || u.type === 'scout' || u.type === 'ldr';
CW.isMounted = u => u.form === 'mounted' || u.type === 'scout' || u.type === 'ldr';
CW.maxMP = u => CW.TYPES[u.type].mp[u.form] ?? 0;
CW.canMove = u => !(CW.TYPES[u.type].fixed || []).includes(u.form);
CW.formCost = u => CW.TYPES[u.type].fcost || 3;
CW.exertsZOC = u => u.type === 'spec' || (u.type === 'inf' && u.form === 'combat') || (u.type === 'art' && u.form === 'unl') || u.type === 'cav';
// hexes a unit exerts ZOC into (front arc only, except skirmishers)
CW.zocHexes = (M, u) => M.nbrs(u.c, u.r).filter(([, , d]) => CW.TYPES[u.type].zocAll || CW.rotDist(d, u.face) <= 1);
CW.arcOf = (u, fromHex) => { const d = CW.dirToward([u.c, u.r], fromHex), k = CW.rotDist(d, u.face); return k <= 1 ? 'front' : k === 2 ? 'flank' : 'rear'; };

// cost for unit u to step from a to b in direction d; Infinity if impossible
CW.stepCost = function (M, u, a, b, d, weather) {
  const tb = M.ter(...b), T = CW.TERRAIN[tb], col = CW.isColumn(u), W = CW.WEATHER[weather] || {};
  const art = u.type === 'art', onRoad = col && M.roadLinked(a, b), eng = u.type === 'eng';
  if (tb === 'w' && !eng) return Infinity;
  if (art && T.noArt) return Infinity;
  let cost;
  if (onRoad) { const rd = M.roadAt.get(CW.key(...a)); cost = rd.major ? 1 : 1.5; if (W.mud) cost *= rd.major ? 1.5 : 2; }
  else {
    cost = col ? T.col : T.line; if (tb === 'w') cost = 8;
    if (T.woods && CW.isMounted(u)) cost *= 1.5; if (T.woods && art) cost = 6;
    if (W.mud) cost += art ? 2.5 : 1;
  }
  const e = M.edge(...a, d);
  if (e && !onRoad) for (const t of e) { const E = CW.EDGES[t]; if (art && E.artRoadOnly) return Infinity; cost += E.mp; }
  const dh = M.h(...b) - M.h(...a);
  if (dh > 0) { if (art && dh >= 2 && !onRoad) return Infinity; cost += dh * (art ? 2 : 1); }
  return cost;
};
CW.coverAt = (M, c, r) => CW.TERRAIN[M.ter(c, r)].cover + (M.sunkenSet.has(CW.key(c, r)) ? 3 : 0);
CW.obsAt = (M, c, r) => CW.TERRAIN[M.ter(c, r)].obs;
CW.lightAt = (M, c, r) => !!CW.TERRAIN[M.ter(c, r)].light; // orchards/farms: one hex only screens, two block
