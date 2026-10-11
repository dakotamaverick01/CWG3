# BRIEF (current directive for Claude) — overwritten for each task
Status: ACTIVE — written 11 Oct 2026 (Opus session) with John's answers. Run it in a FRESH session, one piece at a time.

## Goal
"Living fields": replace the blobby Kenney trees and the flat painted grass/crops with painterly-realistic 3D trees, grass and crops,
high-summer palette (July 1863), fast enough for John's base Apple Silicon Mac. This is a best-quality pass: John wants it to look
better than anything else he has tried. Explain what you do in plain words (John is a non-programmer; Q&A style).

## John's answers (11 Oct)
- Look: **painterly-realistic** (leaf-card canopies, soft realistic grass and wheat). Buildings stay as they are.
- Season: **high summer** (deep green trees, golden ripe wheat, tall green corn).
- Mac: **Apple Silicon M1/M2/M3 base** -> default detail Medium, auto-raise if fast, auto-lower if slow.
- Usage: John is at ~75% of his weekly cap and must keep ~10% for work. **This whole brief: target 6-7%, hard cap 10%.**
  Post a checkpoint (SendUserMessage + 1 contact-sheet image) after EACH piece and say roughly what it cost; John may stop anytime.

## Read first (only these)
STATUS.md "START HERE", this brief, docs/ASSET_PIPELINE.md, src/world_trees.js (current trees, 7 KB), and by grep only:
src/render3d.js (HUGE, very long lines: never Read it whole; grep for `U = {`, `uOcc`, `S.occ`, `buildForest`, `uWheat`, `WorldTrees.build`,
`onSlow`, `hAt`), src/world_edges.js (`instanced`, `IVS`, `IFS` = the shared lit/patterned shader), src/world_structures.js (`SVS` shadow quads, `PVS` smoke).

## How things work today (so you don't rediscover it)
- `play.html` is opened by double-click (file://). Every asset is base64 inside a .js file (`assets/art/models.js` = CW.MODELS). Images may be
  data: URLs (safe); plain image URLs break the ground canvas (taint).
- Map data -> world: hex letters (`g` grass, `c` crops (wheat or corn via `CW.cropKind`), `o` orchard, `f` forest, `t` town, `h` farm, `k` knoll,
  `s` swamp, `w/b/d` water), `M.all`, `M.ter(c,r)`, `M.nbrs`, `CW.center(c,r)` (map px), `CW.R` = 44 px hex radius, `W3(x,y)` -> world (y up,
  z = map y), `hAt(x,y)` terrain height. Our buildings use 2.4 px per metre.
- Shared uniforms `U` in render3d.js: `uT` (seconds), `uLive` (Living switch, 0/1). Everything that moves must use them; Living off = frozen, same layout.
- `S.occ` = DataTexture of hexes with units (trees already thin out there; grass/crops should flatten there).
- Sun: direction to sun `normalize(vec3(-0.5, 0.75, 0.25))` everywhere; shadows fall east/north. Fog uniforms `uFog`, `uFogR`.
- Pipeline: own models are Python code (`tools/modelkit.py`, `tools/gen_models.py`) -> .glb in `assets/models/src/gen/` -> `assets/models/MANIFEST.json`
  -> `python3 -I tools/bake_models.py` -> `assets/art/models.js`. Palette + shader pattern ids in `assets/models/palette.json`.
- Screenshots: `python3 -I tools/shot.py OUTDIR c,r,zoom,tilt,name ...` (and `--gallery`). Good views: forest NE `27,4,3.4,42`, forest SE `27,16,3.4,42`,
  wheat/corn fields `13,5,3.4,42` and `13,14,3.4,42`, orchard `13,13,3.6,45`, town `21,9,3.6,40`, creek mouth `8,6,2.6,45`, wide `16,10,1.4,50`.
  Make ONE contact sheet per piece (PIL) and Read only that. Software GL: only relative timings count; `CW.R3.bench(n)` gives ms/frame;
  `CW.R3.snap(t, live)` renders one frame at time t (prove motion/freeze).

Before picture of today's forest: `docs/shots/before_fields_forest.jpg` (Kenney blob trees). Beat it.

## Do (4 pieces; commit + push to main after each; backup first: `git push origin main:refs/heads/backup-main-2026-10-11-fields`)

### Piece 1 — Trees (est. ~2.5%)
1. `tools/gen_trees.py` (own work): recursive/space-colonisation skeletons per species, bark = tapered low-poly tubes (6 sides trunk, 4 sides twigs),
   canopy = leaf CARDS (quads, UVs into a foliage atlas) placed on branch tips inside a species crown envelope. Per species 3-4 seeded variants.
   Species + shape: white oak (broad, spreading), red maple (oval), sycamore (tall, irregular, pale mottled bark), tulip poplar (tall, straight),
   eastern red cedar (dense cone, blue-green), Virginia pine (tall, sparse high crown), orchard apple (low, round, pruned), dead/blasted tree (no leaves),
   sapling + shrub (understory). Budget per tree ~250-400 tris (cards 2 tris each); bake per-vertex wind weight (0 at trunk base -> 1 at twig tips),
   leaf AO (darker toward crown centre) and "spherical" leaf normals (pointing out from the crown centre: soft, cloud-like lighting).
2. Foliage atlas: paint it in Python (numpy/PIL) as RGBA: broadleaf cluster, oak-leaf cluster, needle tuft, cedar spray, apple cluster with fruit,
   each 256 px, soft alpha edges, hue jitter, lighter rims. Save PNG in `assets/models/src/gen/`, embed as data URL in the bake output.
3. Bake: either extend `tools/bake_models.py` (keep TEXCOORD_0 as `uv`, wind weight as `wt`) or write `tools/bake_trees.py` -> `assets/art/trees.js`
   (CW.TREES). Keep file:// safe.
4. Rewrite `src/world_trees.js`: per species variant one instanced draw for bark (opaque) + one for leaves (alpha-test with dithered edge, or
   alphaToCoverage if antialias is on). Leaf shader: wrap lighting + back-light translucency (sun behind leaves glows yellow-green), per-instance hue
   and size variation, crown AO, fog, distance desaturation. Wind (uLive only): slow trunk sway by wind weight + small fast leaf flutter; gusts move
   across the map in the same direction as the wheat. Keep: placement is a pure function of the map (seeded per hex), unit-occupied hexes thin out
   (existing uOcc rule), soft ground shadow per tree (canopy-sized, cast east).
5. Placement (data-driven): forest hex = 8-12 canopy trees (species weights: oak .35, maple .2, poplar .15, sycamore .1, pine .1, cedar .1;
   sycamores prefer hexes next to water), 5-8 understory saplings/shrubs, extra shrubs on forest edges facing open ground; orchard = apple rows;
   hedgerow trees on ~12% of fence edges and a few lone field trees on `g` hexes (seeded); town/farm yard trees use the new species
   (world_structures.js currently uses kit 'broadleaf').
6. Gallery shows the new trees. Done when: a forest reads as a real wood at zoom 3.4 and at wide zoom, no two neighbouring trees look alike,
   Living off freezes them, bench(30) not worse than ~1.5x today's.

### Piece 2 — Grass (est. ~1.5-2%)
1. `src/world_grass.js`: GPU-instanced grass. One blade = tapered strip (2-3 segments, 3-5 tris), drawn as tiles of ~2-4k blades instanced over
   a grid of tiles around the camera centre only (radius ~6 hexes, density and length fade out with distance and zoom; far away the ground
   texture carries it). Blade position/height from a height DataTexture (built once from hAt) and a density mask DataTexture built from hex letters:
   g = full, o = 70%, h/t = 30% (trampled yards), f = 25% (forest floor, shorter), s = tall wet grass, c/k/roads/water = none; feathered at hex
   borders with noise. Colour: dark base -> sunlit tips, dry/lush patches by noise, 1-2% wildflower heads (white, yellow, purple).
2. Wind: travelling gusts (same direction/speed family as wheat and trees), uLive only. Under unit-occupied hexes (S.occ) blades lie flatter.
3. Reeds and cattails along `CW.WorldWater.fromMap(M)` stream lines and river banks (instanced, generated in Python or as cards).
4. Done when: open fields read as grass at zoom 3+ in a 45° tilt, no visible tile repetition, M1-class cost acceptable (bench before/after).

### Piece 3 — Crops (est. ~1.5%)
1. Wheat: rows of vertical crossed cards with a painted stalk-and-ear atlas (golden, high summer), plus a low "top" layer so it reads from above;
   rows follow one seeded direction per field (connected group of `c` wheat hexes); travelling wind waves (same gust function as grass; the
   existing ground flipbook `CW.WHEATFLOW` can stay underneath or be retired if redundant). A few sheaves/shocks at field edges.
2. Corn: rows of crossed cards with a painted corn atlas (stalks, long leaves, tassels), taller and darker green than wheat; corn shocks at edges.
3. Both flatten under unit-occupied hexes (S.occ), freeze with Living off. Hex rules untouched.
4. Done when: wheat and corn fields read as 3D crops at zoom 3.4 / 42° and still look right at wide zoom.

### Piece 4 — Speed, detail levels, polish (est. ~1%)
1. Detail setting Low / Medium / High (Options menu, saved in opts; default Medium for John's Mac): grass radius/density, trees per hex,
   far-tree impostors (render each tree variant to an 8-view atlas at load; beyond a distance draw billboards), crop density.
2. Auto: the existing slow-frame guard (render3d.js `S.onSlow`, resolution step-down) first steps detail down, only then turns Living off.
3. Docs: docs/WORLD_RECIPE.md (vegetation section), docs/ASSET_PIPELINE.md (trees/foliage atlas), ASSET_CREDITS.md (own trees + painted atlases),
   STATUS.md START HERE (one line), ops/REPORT.md. Final contact sheet: forest, field edge with fence, wheat, corn, orchard, town, wide view.

## Do not touch
Units, combat, AI, camera, game rules, the painted map (minimap, key 3, `?world=0`), buildings/roads/walls/fences from passes 1-2 (except yard trees).

## Done when
Each piece's "Done when" above, verified with one contact sheet per piece; pushed to main; checkpoint message sent to John after each piece.

## Budget rules (important)
- Fresh session, Opus. No subagents. Don't re-read files you already have; grep render3d.js, never Read it whole.
- One screenshot round per piece (tools/shot.py + one contact sheet). Fix-and-reshoot at most once per piece.
- Stop and ask John after 2 failed fixes, or if a piece is clearly running over its estimate.

## Report
Overwrite `ops/REPORT.md` at the end (template inside); add one progress line per piece to STATUS.md.
