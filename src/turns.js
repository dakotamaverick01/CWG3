'use strict';
// Turn clock, day phases, attrition, rest & resupply, dig in, reinforcements, end-turn flow.
// Day turns 20 min; dawn 06-07 and dusk 19-20 are 1 turn each; night 20:00-06:00 = 3 turns.
CW.phase = m => { const t = m % 1440; if (t >= 360 && t < 420) return 'Dawn'; if (t >= 1140 && t < 1200) return 'Dusk'; if (t >= 1200 || t < 360) return 'Night'; return 'Day'; };
CW.nextTime = m => { const t = m % 1440, day = m - t; if (t >= 360 && t < 1140) return m + (t >= 360 && t < 420 ? 420 - t : 20);
  if (t >= 1140 && t < 1200) return day + 1200; if (t >= 1200) { const n = t + 200; return n >= 1440 ? day + 1440 + Math.min(n - 1440, 360) : n; } return Math.min(day + 360, m + 200); };
CW.fmtTime = m => { const t = m % 1440; return `Day ${Math.floor(m / 1440) + 1}, ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
CW.TINT = { Dawn: 'rgba(255,170,90,.16)', Dusk: 'rgba(255,110,50,.22)', Night: 'rgba(8,16,48,.5)', Day: null };
CW.DIFF = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const clamp = v => Math.max(0, Math.min(99, Math.round(v)));
CW.spMax = u => u.spMax || (u.type === 'art' ? 14 : 10);
// movement attrition (none on Beginner)
CW.attrition = function (G, M, u, stepCost, hex) {
  const diff = G.opts.difficulty; if (diff === 'beginner') return;
  const ph = CW.phase(G.minutes), T = CW.TERRAIN[M.ter(...hex)];
  let f = .35 * stepCost * (CW.isColumn(u) ? 1 : 2) * (ph === 'Night' ? 3 : ph === 'Day' ? 1 : 1.8) * (T.col >= 4 ? 1.5 : 1);
  if (diff === 'advanced') f *= 1.25 - u.st * .06; // better leaders keep men together
  u.org = clamp(u.org - f); u.hlth = clamp(u.hlth - f * .5);
};
CW.nearHQ = (G, u) => G.units.some(h => h.type === 'hq' && h.side === u.side && !h.gone && CW.dist([h.c, h.r], [u.c, u.r]) <= 3);
CW.adjEnemies = (G, M, u) => M.nbrs(u.c, u.r).filter(([c, r]) => CW.unitsAt(G.units, c, r).some(e => e.side !== u.side)).length;
CW.restUnit = function (G, M, u) {
  const t = M.ter(u.c, u.r), ph = CW.phase(G.minutes);
  let f = 1; if (CW.nearHQ(G, u)) f *= 1.5; if ('tx'.includes(t)) f *= 1.5; if ('swd'.includes(t)) f *= .5;
  if (!CW.isColumn(u) && u.type !== 'cav') f *= .75; f *= ph === 'Night' ? 2 : ph === 'Day' ? 1 : 1.5;
  u.org = clamp(u.org + 7 * f); u.hlth = clamp(u.hlth + 4 * f); u.mor = clamp(u.mor + 2 * f);
  const [o, a] = u.men; u.men[2] = Math.round(a * (0.55 + 0.45 * (u.org + u.hlth) / 198)); u.rested = 1;
};
// resupply: levels relative to max rounds; cost = rounds × men/500
CW.SUPPLY_LEVELS = [['over', 'Oversupply', 1.4], ['full', 'Full', 1], ['half', 'Half', .5], ['quarter', 'Quarter', .25], ['none', 'None', 0]];
CW.supplyCost = (u, level) => { const L = CW.SUPPLY_LEVELS.find(l => l[0] === level); const target = Math.round(CW.spMax(u) * L[2]); const need = Math.max(0, target - u.sp); return { need, cost: Math.ceil(need * Math.max(1, u.men[2] / 500)) }; };
CW.maxLevel = (G, M, u) => { const a = CW.adjEnemies(G, M, u); return a >= 3 ? 'none' : a === 2 ? 'half' : 'over'; };
CW.resupply = function (G, M, u, level) {
  const order = CW.SUPPLY_LEVELS.map(l => l[0]), cap = CW.maxLevel(G, M, u); if (order.indexOf(level) < order.indexOf(cap)) level = cap;
  const { need, cost } = CW.supplyCost(u, level); if (!need || G.supply[u.side] < cost) return 0;
  G.supply[u.side] -= cost; u.sp += need; if (level === 'over') u.mor = clamp(u.mor + 3); return cost;
};
CW.canDig = (M, u) => { const t = CW.TERRAIN[M.ter(u.c, u.r)];
  if (t.noDig) return `Cannot dig in on a ${t.n.toLowerCase()}`; if (u.dug) return 'Already dug in here';
  const ok = (u.type === 'inf' && u.form === 'combat') || (u.type === 'cav' && u.form === 'dism') || (u.type === 'art' && u.form === 'unl') || u.type === 'hq';
  if (!ok) return u.type === 'inf' ? 'Infantry must be in combat formation' : u.type === 'cav' ? 'Cavalry must dismount first' : u.type === 'art' ? 'Artillery must unlimber first' : 'This unit cannot dig in';
  if (u.mp < CW.maxMP(u) / 2) return 'Not enough movement points left this turn'; return ''; };
// reinforcement brigades for the side now moving
CW.arrivals = function (G, M) {
  const out = []; G.reinf = G.reinf.filter(rf => { if (rf.side !== G.side || rf.at > G.minutes) return true;
    const made = CW.buildBrigade(M, G.units, rf.side, { ...structuredClone(rf.brigade), c: rf.c, r: rf.r });
    made.forEach(u => u.mp = CW.maxMP(u)); out.push(...made); return false; });
  return out;
};
