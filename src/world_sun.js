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
    flat0: 0.2809 };   // the old ground sun's height (y); render3d.js scales the sun's strength so flat ground keeps its calibrated brightness
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
