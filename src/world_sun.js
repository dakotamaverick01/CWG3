'use strict';
// First-look phase 1 (17 Oct): ONE sun for the whole 3D world, plus the colour grade.
// Before this, the ground was lit by a 16-degree sun while trees, grass, buildings and animals each used their own 53-degree sun,
// so objects looked pasted on and their shadows were short. Every shader now reads CW.SUN (direction TOWARD the sun, y up,
// +z = south = towards the camera). Shadow length on flat ground = height x CW.SUN.cot.
// Load order: right after three.min.js and before every src/world_*.js file (their shader text is built when they load).
CW.SUN = (function () {
  // ~21 degrees up (morning light), from the west and a little behind the scene: shadows run east and slightly towards the viewer, so you see them
  const d = [-0.88, 0.34, -0.22], L = Math.hypot(...d), v = d.map(x => x / L), f = n => n.toFixed(4);
  return { dir: v, cot: Math.hypot(v[0], v[2]) / v[1], glsl: `vec3(${f(v[0])}, ${f(v[1])}, ${f(v[2])})`,
    flat0: 0.2809,
    // first-look phase 3: ONE cloud pattern for ground, grass, crops, trees and sky. Fair-weather clouds ~1 km across drift with the
    // world wind (east-south-east, ~5 m/s). cwCloud = 0 in sun, 1 under a cloud. Only applied while Living landscape is on.
    cloudGLSL: `float clH(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
      float clN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(clH(i), clH(i + vec2(1, 0)), f.x), mix(clH(i + vec2(0, 1)), clH(i + vec2(1, 1)), f.x), f.y); }
      float cwCloud(vec2 xz, float t) { vec2 p = xz / 1100.0 + vec2(0.866, 0.5) * t * 0.0116; float v = 0.0, a = 0.55;
        for (int k = 0; k < 3; k++) { v += a * clN(p); p = p * 2.07 + 5.3; a *= 0.5; } return smoothstep(0.50, 0.57, v); }   /* fairly crisp edges: soft ones blurred into the meadow's own patches */
      vec3 cwCloudTint(float c) { return mix(vec3(1.03, 1.01, 0.97), vec3(0.66, 0.70, 0.81), c); }` };   // the old ground sun's height (y); render3d.js scales the sun's strength so flat ground keeps its calibrated brightness
})();

// Colour grade, inside three.js's own tone-mapping step, so every material (ground, trees, grass, water, buildings) gets it for a few
// arithmetic operations: shade leans cool blue, sunlit ground warm gold, a touch more colour. Free, so it is on at every Detail level.
// Compare without it: play.html?grade=0
CW.GRADE = !/[?&]grade=0\b/.test(location.search);
if (window.THREE && CW.GRADE && THREE.ShaderChunk && THREE.ShaderChunk.tonemapping_fragment.indexOf('cwGrade') < 0) {
  THREE.ShaderChunk.tonemapping_fragment += `
#if defined( TONE_MAPPING )
  { /* cwGrade: split tone after the filmic curve (still linear light here) */
    vec3 cwc = gl_FragColor.rgb; float cwl = dot(cwc, vec3(0.2126, 0.7152, 0.0722));
    cwc *= mix(vec3(0.93, 0.98, 1.07), vec3(1.025, 1.0, 0.965), smoothstep(0.03, 0.42, cwl));   /* measured 17 Oct: stronger settings crushed the blue and yellowed the meadows */
    gl_FragColor.rgb = max(cwc, 0.0); }
#endif`;
}
