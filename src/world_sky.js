'use strict';
// First-look phase 2 (17 Oct): sky dome, distant ridge lines and valley mist. All generated in code (no outside assets).
// - Sky: a huge inside-out sphere. Blue overhead, fading at the horizon into the scene's haze colour (the same colour distant land fades
//   into, so land and sky meet without a seam), a warm glow on the sun's side and a low morning band.
// - Ridges: three rings of distant hills around the valley, each farther ring paler and bluer (aerial perspective: the air between you and
//   far things washes them toward the sky). Only visible from the low "general's-eye" camera ([ key) and in the opening shot.
// - Mist: translucent sheets a few metres above the ground that only gather where the land is wet or low (creek bottoms, hollows), drifting
//   slowly while Living landscape is on. Strength = U.uMist (the opening shot raises it, then lets it lift). Low: none, Medium: 1, High: 2.
// Colours here are DISPLAY colours (toneMapped: false): three.js mixes its fog in after tone mapping, so to meet the fogged land exactly
// the horizon must be the fog colour as written, untouched.
CW.WorldSky = (function () {
  const NOISE = `float skH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float skN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(skH(i), skH(i + vec2(1, 0)), f.x), mix(skH(i + vec2(0, 1)), skH(i + vec2(1, 1)), f.x), f.y); }
    float skF(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * skN(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }`;

  const SKY_VS = `varying vec3 vW; void main() { vec4 w = vec4(position + cameraPosition, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;   // the dome travels with the camera, so it always encloses the ridges
  const SKY_FS = `uniform vec3 uFog, uSun; uniform float uT, uLive, uCloud; varying vec3 vW; ${NOISE}
    void main() { vec3 d = normalize(vW - cameraPosition); float h = max(d.y, 0.0);
      vec3 zen = vec3(0.36, 0.52, 0.70), col = mix(uFog, zen, pow(smoothstep(0.0, 0.38, h), 0.6));
      col = mix(col, vec3(0.96, 0.84, 0.66), exp(-h * 22.0) * 0.30);                                   // low warm morning band
      float s = max(dot(d, normalize(uSun)), 0.0); col += vec3(1.0, 0.82, 0.55) * (pow(s, 5.0) * 0.20 + pow(s, 60.0) * 0.30);   // glow on the sun's side
      if (uCloud > 0.0 && d.y > 0.0) {                                                                   // phase 3: high fair-weather clouds drifting from the west
        vec2 q = d.xz / (d.y + 0.06) * 0.9 + (uLive > 0.5 ? vec2(uT * 0.006, uT * 0.0025) : vec2(0.0));
        float c = smoothstep(0.50, 0.74, skF(q) * 0.75 + skF(q * 3.1 + 7.0) * 0.25) * smoothstep(0.0, 0.035, d.y) * uCloud;   /* far clouds flatten into bands near the horizon instead of fading out */
        vec3 cc = mix(vec3(0.97, 0.95, 0.90), vec3(1.0, 0.92, 0.80), s) * (0.92 + 0.10 * skN(q * 6.0)); col = mix(col, cc, c * 0.85); }
      if (d.y < 0.0) col = uFog;
      gl_FragColor = vec4(col, 1.0); }`;

  const RIDGE_VS = `attribute float aV, aA; varying float vV, vA; varying vec3 vW; void main() { vV = aV; vA = aA; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const RIDGE_FS = `uniform vec3 uFog, uSun, uTone; uniform float uFade; varying float vV, vA; varying vec3 vW; ${NOISE}
    void main() { float n = skN(vec2(vA * 900.0, vV * 26.0)) * 0.6 + skN(vec2(vA * 2600.0, vV * 70.0)) * 0.4;   // forested slopes: a little texture
      vec3 col = uTone * (0.88 + 0.24 * n);
      vec3 d = normalize(vW - cameraPosition); float s = max(dot(normalize(d.xz), normalize(uSun.xz)), 0.0);
      col = mix(col, uFog, clamp(uFade + (1.0 - smoothstep(40.0, 520.0, vW.y)) * 0.75 + s * s * 0.15, 0.0, 1.0));   /* haze by real height: the land hides the ridges' lower part */   // farther = paler; valley haze at the foot; glare toward the sun
      gl_FragColor = vec4(col, 1.0); }`;

  const MIST_VS = `varying vec2 vP; varying float vDist; uniform vec2 uMap; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz + uMap * 0.5;
    vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const MIST_FS = `uniform sampler2D uRelief, uHgt; uniform float uLowH; uniform vec2 uHgtSz, uFogR; uniform vec3 uFog; uniform float uT, uLive, uMist, uLayer; varying vec2 vP; varying float vDist; ${NOISE}
    void main() { vec4 rl = texture2D(uRelief, vP / uHgtSz); float hol = smoothstep(0.18, 0.55, -(rl.r * 2.0 - 1.0)), wet = smoothstep(0.05, 0.6, rl.g);   /* mostly wetness: the hollows map still follows hex steps */
      float low = 1.0 - smoothstep(uLowH - 30.0, uLowH + 45.0, texture2D(uHgt, vP / uHgtSz).r);   /* valley floor: fills only when the mist is strong (morning) */
      float m = clamp(max(wet * 1.1 + hol * 0.3, low * smoothstep(0.35, 0.9, uMist)), 0.0, 1.0); if (m < 0.01 || uMist < 0.01) discard;
      vec2 w = uLive > 0.5 ? vec2(uT * 0.010, uT * 0.0035) * (1.0 + uLayer * 0.6) : vec2(0.0);
      float n = skF(vP / 300.0 + w + uLayer * 11.0) * 0.7 + skF(vP / 90.0 - w * 1.7) * 0.3;
      float banks = smoothstep(0.50 - 0.06 * uMist, 0.76, n);   /* distinct drifting banks with clear gaps (a low threshold made one flat veil) */
      float a = m * (banks * (uLayer > 0.5 ? 0.45 : 0.72) + 0.08) * uMist * (1.0 - smoothstep(uFogR.x, uFogR.y, vDist));
      if (a < 0.004) discard;
      gl_FragColor = vec4(mix(vec3(0.88, 0.90, 0.90), vec3(1.0, 0.95, 0.86), banks), a); }`;   /* bank tops catch the sun, thin parts stay cool */

  let st = null;
  // env: { scene, U, MW, MH, hAt, det }
  function build(env) {
    dispose(); const { scene, U, MW, MH, hAt } = env, sun = new THREE.Vector3(...CW.SUN.dir), parts = [];
    U.uMist = U.uMist || { value: 0.3 }; U.uCloud = U.uCloud || { value: 0 };
    const fogU = { value: scene.fog.color };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(14000, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide,
      depthWrite: false, toneMapped: false, fog: false, uniforms: { uFog: fogU, uSun: { value: sun }, uT: U.uT, uLive: U.uLive, uCloud: U.uCloud } }));
    sky.renderOrder = 5; sky.frustumCulled = false; scene.add(sky); parts.push(sky);   // drawn after the land, so covered pixels are skipped
    // three ridge rings: radius, base height, height swing, tone, how much haze already covers them
    const rnd = CW.rng(4242), ph = Array.from({ length: 12 }, () => rnd() * 6.283);
    const prof = (a, L) => { let v = 0; for (let k = 0; k < 4; k++) v += Math.sin(a * (2 + k * 3 + L) + ph[k * 3 + L]) / (1 + k * .9); return .5 + .5 * v / 2.3; };
    [[5400, 130, 260, [0.22, 0.30, 0.26], 0.30], [7000, 220, 440, [0.25, 0.33, 0.36], 0.52], [8800, 340, 780, [0.33, 0.40, 0.48], 0.70]].forEach(([R, base, amp, tone, fade], L) => {
      const N = 360, pos = [], av = [], aa = [], idx = [];
      for (let i = 0; i <= N; i++) { const a = i / N * 6.283, top = base + amp * (prof(a, L) * .8 + .2 * prof(a * 7.3, L)) ** 1.6, x = Math.cos(a) * R, z = Math.sin(a) * R;
        pos.push(x, -350, z, x, top, z); av.push(0, 1); aa.push(i / N, i / N); if (i) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aV', new THREE.Float32BufferAttribute(av, 1));
      g.setAttribute('aA', new THREE.Float32BufferAttribute(aa, 1)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: RIDGE_VS, fragmentShader: RIDGE_FS, side: THREE.DoubleSide, toneMapped: false, fog: false,
        uniforms: { uFog: fogU, uSun: { value: sun }, uTone: { value: new THREE.Vector3(...tone) }, uFade: { value: fade } } }));
      m.renderOrder = 4 - L * .1; m.frustumCulled = false; scene.add(m); parts.push(m); });
    st = { scene, parts, mist: [], env }; detail(env.det); return st;
  }
  // mist sheets follow the ground at +lift map px (2.4 px = 1 m); rebuilt when Detail changes
  function detail(lv) { if (!st) return; const { scene, U, MW, MH, hAt } = st.env;
    st.mist.forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); st.mist = [];
    const n = lv >= 2 ? 2 : lv >= 1 ? 1 : 0;
    for (let L = 0; L < n; L++) { const cols = Math.ceil(MW / 26), rows = Math.ceil(MH / 26), g = new THREE.PlaneGeometry(MW, MH, cols, rows); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position, lift = L ? 15 : 6; for (let i = 0; i < p.count; i++) p.setY(i, hAt(p.getX(i) + MW / 2, p.getZ(i) + MH / 2) + lift);
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: MIST_VS, fragmentShader: MIST_FS, transparent: true, depthWrite: false, toneMapped: false, fog: false,
        uniforms: { uRelief: U.uRelief, uHgt: U.uHgt, uLowH: U.uLowH || { value: 0 }, uHgtSz: U.uHgtSz, uMap: U.uMap, uFog: { value: st.scene.fog.color }, uFogR: { value: new THREE.Vector2(st.scene.fog.near, st.scene.fog.far) },
          uT: U.uT, uLive: U.uLive, uMist: U.uMist, uLayer: { value: L } } }));
      m.renderOrder = 1.5 + L * .01; m.frustumCulled = false; scene.add(m); st.mist.push(m); } }
  function dispose() { if (!st) return; [...st.parts, ...st.mist].forEach(m => { st.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }); st = null; }
  return { build, detail, dispose, state: () => st };
})();
