'use strict';
// WORLD pass T2: trees as real 3D meshes (Kenney Nature Kit, CC0; baked by tools/bake_models.py into assets/art/models.js).
// Placement is a pure function of the map file (hex letters f = forest, o = orchard): no painted coordinates, no Millbrook hexes.
// Each hex gets its own seeded random numbers, so editing one hex in the map file changes only that hex's trees.
// Rendering: 3 kinds x (1 instanced mesh + 1 instanced soft ground shadow). Where a unit stands the hex thins out (same rule as before:
// half the trees vanish, the rest are ~60% height). A slow sway runs only while Living landscape is on (uLive); off = frozen, same layout.
CW.WorldTrees = (function () {
  const FOREST_N = 9, ORCHARD_GRID = [-1, 0, 1];
  const KINDS = ['broadleaf', 'pine', 'bush'];

  // pure placement: returns [{kind, x, y, h, yaw, rnd, hex}] in map pixels (h = tree height in px)
  function place(M) {
    const R = CW.R, out = [];
    for (const [c, r] of M.all) {
      const t = M.ter(c, r); if (t !== 'f' && t !== 'o') continue;
      const rand = CW.rng(c * 7919 + r * 104729 + 17), [cx, cy] = CW.center(c, r), hex = r * M.cols + c;
      if (t === 'o') {   // orchard: neat 3x3 rows of small broadleaf, lightly jittered
        for (const j of ORCHARD_GRID) for (const i of ORCHARD_GRID)
          out.push({ kind: 'broadleaf', x: cx + i * R * .48 + (j & 1) * 7 + (rand() - .5) * 3, y: cy + j * R * .45 + (rand() - .5) * 3, h: 24 + rand() * 5, yaw: rand() * 6.283, rnd: rand(), hex });
        continue;
      }
      const pts = []; let tries = 0;   // forest: jittered scatter inside the hex with a minimum spacing
      while (pts.length < FOREST_N && tries++ < 80) {
        const a = rand() * 6.283, d = Math.sqrt(rand()) * R * .8, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .92;
        if (pts.every(p => (p[0] - x) ** 2 + (p[1] - y) ** 2 > 13 * 13)) pts.push([x, y]);
      }
      for (const [x, y] of pts) {
        const k = rand(), kind = k < .42 ? 'broadleaf' : k < .8 ? 'pine' : 'bush';
        out.push({ kind, x, y, h: kind === 'broadleaf' ? 36 + rand() * 14 : kind === 'pine' ? 50 + rand() * 18 : 9 + rand() * 5, yaw: rand() * 6.283, rnd: rand(), hex });
      }
    }
    return out;
  }

  const VS = `attribute vec3 aBase, color; attribute vec4 aPar; uniform sampler2D uOcc; uniform vec2 uOccN; uniform float uT, uLive;
    varying vec3 vCol; varying float vDist;
    void main() {
      float k = 1.0; float hx = aPar.w;
      float occ = texture2D(uOcc, (vec2(mod(hx, uOccN.x), floor(hx / uOccN.x)) + 0.5) / uOccN).r; if (occ > 0.5) k = aPar.z < 0.5 ? 0.0 : 0.62;
      if (k <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      float cy = cos(aPar.x), sy = sin(aPar.x), h = position.y, H = aPar.y * k;
      vec3 p = vec3(position.x * cy + position.z * sy, position.y, -position.x * sy + position.z * cy) * H;
      float ph = aBase.x * 0.031 + aBase.z * 0.027 + aPar.z * 6.283;
      p.xz += uLive * H * 0.03 * h * h * vec2(sin(uT * 0.9 + ph), 0.6 * sin(uT * 0.7 + ph * 1.3));   // slow sway, off = frozen
      vec3 n = vec3(normal.x * cy + normal.z * sy, normal.y, -normal.x * sy + normal.z * cy);
      float lam = max(dot(normalize(n), normalize(vec3(-0.5, 0.75, 0.25))), 0.0);   // sun low in the west
      vCol = color * (0.50 + 0.62 * lam) * mix(0.72, 1.08, h) * (0.9 + 0.2 * aPar.z) * vec3(1.04, 0.99, 0.86);
      vec4 mv = viewMatrix * vec4(aBase + p, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const FS = `uniform vec3 uFog; uniform vec2 uFogR; varying vec3 vCol; varying float vDist;
    void main() { gl_FragColor = vec4(mix(vCol, uFog, smoothstep(uFogR.x, uFogR.y, vDist)), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const SVS = `attribute vec3 aBase; attribute vec4 aPar; uniform sampler2D uOcc; uniform vec2 uOccN; uniform float uRad; varying vec2 vQ;
    void main() {
      float k = 1.0; float hx = aPar.w;
      float occ = texture2D(uOcc, (vec2(mod(hx, uOccN.x), floor(hx / uOccN.x)) + 0.5) / uOccN).r; if (occ > 0.5) k = aPar.z < 0.5 ? 0.0 : 0.62;
      if (k <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec2 c = position.xy; vQ = c * 2.0; float r = uRad * aPar.y * k;
      vec3 wp = aBase + vec3(c.x * r * 2.4 + r * 0.7, 0.9, c.y * r * 1.2 + r * 0.1);   // long-ish shadow to the east
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`;
  const SFS = `varying vec2 vQ; void main() { float d = length(vQ); gl_FragColor = vec4(0.10, 0.08, 0.14, (1.0 - smoothstep(0.3, 1.0, d)) * 0.30); }`;

  const dec = (s, T) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };

  // env: { scene, M, W3 (map px -> world), occ (DataTexture of unit-occupied hexes), U (shared uniforms uT, uLive) }
  function build(env) {
    const { scene, M, W3, occ, U } = env, KM = CW.TREEMESH; if (!KM) throw new Error('models.js missing');
    dispose(); const list = place(M), parts = [];
    const shared = { uOcc: { value: occ }, uOccN: { value: new THREE.Vector2(M.cols, M.rows) }, uT: U.uT, uLive: U.uLive,
      uFog: { value: scene.fog.color }, uFogR: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } };
    for (const kind of KINDS) {
      const items = list.filter(t => t.kind === kind), n = items.length; if (!n) continue; const m = KM[kind];
      const base = new Float32Array(n * 3), par = new Float32Array(n * 4);
      items.forEach((t, i) => { const b = W3(t.x, t.y); base.set([b.x, b.y - .8, b.z], i * 3); par.set([t.yaw, t.h, t.rnd, t.hex], i * 4); });
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(dec(m.p, Float32Array), 3)); g.setAttribute('normal', new THREE.BufferAttribute(dec(m.nm, Float32Array), 3));
      g.setAttribute('color', new THREE.BufferAttribute(dec(m.c, Uint8Array), 3, true)); g.setIndex(new THREE.BufferAttribute(dec(m.i, Uint16Array), 1));
      g.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3)); g.setAttribute('aPar', new THREE.InstancedBufferAttribute(par, 4)); g.instanceCount = n;
      const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: shared, side: THREE.DoubleSide })); mesh.frustumCulled = false; mesh.renderOrder = 0;
      const sg = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1); sg.index = q.index; sg.setAttribute('position', q.attributes.position);
      sg.setAttribute('aBase', g.attributes.aBase); sg.setAttribute('aPar', g.attributes.aPar); sg.instanceCount = n;
      const sh = new THREE.Mesh(sg, new THREE.ShaderMaterial({ vertexShader: SVS, fragmentShader: SFS, uniforms: { uOcc: shared.uOcc, uOccN: shared.uOccN, uRad: { value: m.w * .5 * 1.1 } },
        transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide })); sh.frustumCulled = false; sh.renderOrder = 1;
      scene.add(mesh); scene.add(sh); parts.push(mesh, sh);
    }
    state = { scene, parts }; return list.length;
  }
  let state = null;
  function dispose() { if (!state) return; state.parts.forEach(m => { state.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); state = null; }
  return { place, build, dispose };
})();
