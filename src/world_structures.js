'use strict';
// WORLD pass T5: structures built from the map file (no painted coordinates, no Millbrook hexes). Table: docs/WORLD_RECIPE.md section 2e.
//   hex letter t -> camp-town (tents, fire, log piles, sign)   h -> farm (barn tent, ploughed rows, logs, stump)
//   hex letter b -> wooden bridge along the road   d -> stepping stones across the ford   x -> fort (log rampart + tents)   k -> boulders
//   map field  structures:[[c, r, 'mill'], ...] -> the mill (stand-in: stone platform + canvas-roofed hut + log pile, on the water side of the hex)
// Meshes are Kenney Nature Kit (CC0) baked by tools/build_tree_meshes.py into assets/art/struct_meshes.js. The kit has NO houses, so these are stand-ins.
CW.WorldStructures = (function () {
  let parts = [], scene = null;
  const WATER = new Set(['w', 'b', 'd']);

  // direction a bridge/ford runs: along the road that crosses the hex; otherwise across the river (perpendicular to the water neighbours); otherwise east-west
  function crossDir(M, c, r) {
    const here = CW.center(c, r);
    for (const rd of M.roads) { const i = rd.p.findIndex(p => p[0] === c && p[1] === r); if (i < 0) continue;
      const a = CW.center(...rd.p[Math.max(0, i - 1)]), b = CW.center(...rd.p[Math.min(rd.p.length - 1, i + 1)]), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L > 1) return [dx / L, dy / L]; }
    let wx = 0, wy = 0; for (const [a, b] of M.nbrs(c, r)) if (WATER.has(M.ter(a, b))) { const q = CW.center(a, b); wx += q[0] - here[0]; wy += q[1] - here[1]; }
    const L = Math.hypot(wx, wy); return L > 1 ? [-wy / L, wx / L] : [1, 0];
  }
  // unit vector from a hex centre toward its water neighbours (0,0 if none)
  function towardWater(M, c, r) {
    const here = CW.center(c, r); let wx = 0, wy = 0;
    for (const [a, b] of M.nbrs(c, r)) if (WATER.has(M.ter(a, b))) { const q = CW.center(a, b); wx += q[0] - here[0]; wy += q[1] - here[1]; }
    const L = Math.hypot(wx, wy); return L > 1 ? [wx / L, wy / L] : [0, 0];
  }

  // pure placement: [{kind, x, y (map px), lift, yaw, pitch, rnd, sx, sy, sz}]. Sizes in px; 'height' meshes use one scale for all three axes.
  function place(M) {
    const R = CW.R, out = [];
    const put = (kind, x, y, h, yaw, rnd, lift) => out.push({ kind, x, y, lift: lift || 0, yaw, pitch: 0, rnd, sx: h, sy: h, sz: h });
    for (const [c, r] of M.all) {
      const t = M.ter(c, r); if (!'thxbdk'.includes(t)) continue;
      const rand = CW.rng(c * 7919 + r * 104729 + 55), [cx, cy] = CW.center(c, r), a0 = rand() * 6.283;
      if (t === 't') {
        for (let k = 0; k < 3; k++) { const a = a0 + k * 2.09 + (rand() - .5) * .4, d = R * (.46 + rand() * .12); put(k === 1 ? 'tentOpen' : 'tent', cx + Math.cos(a) * d, cy + Math.sin(a) * d * .9, 10 + rand() * 3, rand() * 6.283, rand()); }
        put('fire', cx + (rand() - .5) * 8, cy + (rand() - .5) * 8, 2.2, 0, rand());
        for (let k = 0; k < 2; k++) put('logs', cx + Math.cos(a0 + 1 + k * 3) * R * .32, cy + Math.sin(a0 + 1 + k * 3) * R * .3, 6.5, rand() * 6.283, rand());
        put('sign', cx + R * .12, cy + R * .62, 11, rand() * .6 - .3, rand());
      } else if (t === 'h') {
        put('tentSmall', cx - R * .3, cy - R * .1, 14, a0, rand());                       // barn / farmhouse stand-in
        for (let k = 0; k < 2; k++) put('rows', cx + R * (.18 + k * .36), cy + R * (.2 - k * .1), 1.25, 0, rand());
        put('logsBig', cx - R * .55, cy + R * .45, 8, rand() * 6.283, rand());
        put('stump', cx + R * .05, cy - R * .5, 5, rand() * 6.283, rand());
      } else if (t === 'x') {                                                                // earthwork: two courses of logs round the star + tents inside
        const N = 12; for (let k = 0; k < N; k++) { const a = k / N * 6.283 + .26, d = R * .6;
          for (let lay = 0; lay < 2; lay++) out.push({ kind: 'log', x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * .92, lift: lay * 4.2, yaw: -(a + 1.5708), pitch: 0, rnd: rand(), sx: 5.2, sy: 5.2, sz: 5.2 }); }
        put('tent', cx - R * .15, cy - R * .12, 11, a0, rand()); put('tentSmall', cx + R * .16, cy + R * .14, 9, a0 + 1, rand()); put('sign', cx, cy + R * .3, 10, 0, rand());
      } else if (t === 'k') {
        for (let k = 0; k < 3; k++) put(k === 1 ? 'rockC' : 'rockA', cx + (rand() - .5) * R * 1.1, cy + (rand() - .5) * R * .9, 8 + rand() * 6, rand() * 6.283, rand(), -1);
      } else if (t === 'b') {
        const [dx, dy] = crossDir(M, c, r); out.push({ kind: 'bridge', x: cx, y: cy, lift: 2, yaw: Math.atan2(-dy, dx), pitch: 0, rnd: rand(), sx: R * 1.9, sy: R * .85, sz: 22 });
      } else if (t === 'd') {
        const [dx, dy] = crossDir(M, c, r); out.push({ kind: 'stepRocks', x: cx, y: cy, lift: 1.2, yaw: Math.atan2(-dy, dx), pitch: 0, rnd: rand(), sx: R * 1.5, sy: R * 1.5, sz: R * .5 });
      }
    }
    for (const [c, r, kind] of (M.structures || [])) {       // named structures listed in the map file
      if (!M.in(c, r)) continue;
      const rand = CW.rng(c * 7919 + r * 104729 + 99), [cx, cy] = CW.center(c, r), [wx, wy] = towardWater(M, c, r), x = cx + wx * R * .4, y = cy + wy * R * .4, yaw = Math.atan2(-wy, wx);
      if (kind === 'mill') {
        put('platform', x, y, 1.9, yaw, rand(), -.5); put('tent', x, y, 17, yaw, rand(), 1.2);
        put('logsBig', x - wy * R * .45 - wx * R * .15, y + wx * R * .45 - wy * R * .15, 8, rand() * 6.283, rand()); put('rockC', x + wx * R * .3 + wy * R * .3, y + wy * R * .3 - wx * R * .3, 5, rand() * 6.283, rand(), -1);
      }
    }
    return out;
  }

  // env: { scene, M, W3 }
  function build(env) {
    const SM = CW.STRUCTMESH; if (!SM) throw new Error('struct_meshes.js missing');
    dispose(); scene = env.scene; const list = place(env.M); list.W3 = env.W3;
    const fog = { uFog: { value: scene.fog.color }, uFogR: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } };
    parts = CW.WorldEdges.instanced(scene, list, SM, Object.keys(SM), fog); return list.length;
  }
  function dispose() { parts.forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); parts = []; }
  return { place, build, dispose };
})();
