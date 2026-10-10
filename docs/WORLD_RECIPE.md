# WORLD RECIPE — how the map file becomes the 3D world

Status: T1 draft (2026-10-09). Part of `docs/WORLD_PLAN.md`. Later tasks (T2–T8) fill in the "Built by" column.

**The rule:** the map file is the only input. Nothing in the world code may mention Millbrook, a hex number, or a painted pixel position. A second map (T8) must work with no new art code.

## 1. Inputs (all from the map file, e.g. `src/maps/demo.js`)

| Field | Shape | Meaning |
|---|---|---|
| `terrain` | rows of letters, `terrain[r][c]` | one terrain letter per hex (table below) |
| `height` | rows of digits, `height[r][c]` | height level per hex (0 = river bed, higher = hill). The mesh already follows it |
| `edges` | `[c, r, dir, ["wall"\|"fence"\|"stream"]]` | features that run along a hex edge, not inside a hex. `dir` 0–5; `M.edge(c,r,d)` normalises both sides of an edge to one key |
| `roads` | `[{major, p:[[c,r],…]}]` | road paths through hex centres. `M.roadAt` / `M.roadLinked` |
| `sunken` | `[[c,r],…]` | sunken-lane hexes (extra cover) |
| `cols`, `rows` | numbers | map size |

Not world inputs (game rules only): `supply`, `objectives`, `labels`.

### Terrain letters (from `CW.TERRAIN` in `src/rules.js`)

| Letter | Terrain | Letter | Terrain |
|---|---|---|---|
| `g` | grass / open | `s` | swamp |
| `c` | crop field (wheat or corn, picked by `CW.cropKind`) | `w` | river |
| `o` | orchard | `b` | bridge |
| `f` | forest | `d` | river ford |
| `t` | town | `x` | fort |
| `h` | farm | `k` | rocky knoll |

## 2. Outputs

Every output is a pure function of the inputs above. "Today" is what the code does now; "Built by" is the task that makes it fully data-driven.

### 2a. Ground (the textured mesh)
- **From:** terrain letter per hex (and `height` for the mesh shape).
- **How:** each letter gives weights to up to 8 ground channels (`GROUND_CH` in `src/render3d.js`). Weights are blurred, noised and blended so hex borders look ragged, not gridded.
- **Channels today:** 0 meadow (two CC0 grass photos, noise-swapped) · 1 wheat · 2 corn · 3 woods floor · 4 farmyard/town dirt · 5 rock · 6 swamp mud · 7 river bed.
- **Letter → channel today:** `g,o`→0 · `c`→1 or 2 · `f`→3 · `h,t,x`→4 · `k`→5 · `s`→6 · `w,b,d`→7 + meadow.
- **Today:** already data-driven. **Built by:** T3 (one visibly different texture per letter).

### 2b. Water
- **From:** hex letters `w`, `b`, `d` (river, bridge, ford) and `stream` hex edges (brooks). Nothing else.
- **How:** `src/world_water.js` (`CW.WorldWater.fromMap(M)`): each connected group of wet hexes is walked into a centre line (carried off the map if it ends on the border); each chain of stream edges becomes a meandering line, spring first, mouth last, and the mouth is run on into the nearest river.
- **Output:** one water ribbon per line in `render3d.js` (`buildRibbon`), all drawn with the same water shader: river wide and deep, brooks narrower, shallower, fading at the spring. Mud bank + gravel for brooks in `world_edges.js`. Living off = the same ribbon, frozen (still water, not missing water).
- **Today (T6 done):** with `CW.WORLD` on the painted pass is no longer read for water (`CW.WATER` is only used when the 3D world is off). **Built by:** T6.

### 2c. Vegetation
- **From:** `f` (forest), `o` (orchard), `c` (crops); `g` has none.
- **Output:** instanced tree/bush meshes from forest and orchard hexes; thinned where a unit stands; slow sway only with Living on. Crop fields stay ground texture + the existing wheat/corn flow.
- **Today:** instanced Kenney meshes from forest/orchard hexes (T2); sway runs under the single Living switch (T7). **Built by:** T2 (meshes), T7 (sway).

### 2d. Edge pieces
- **From:** `edges` (wall, fence, stream) and `roads`.
- **Output:** instanced wall/fence segments along hex edges; roads continuous across hex borders; streams join 2b.
- **Today (T4 done):** with `CW.WORLD` on, `src/world_edges.js` builds them from the map data. Roads: one smooth ribbon per `M.roads` path, draped on the terrain heights (continuous, so no break at hex borders). Brooks: bank + water ribbon along `CW.WATER.streams` (the hex-edge chains; still produced by the painted pass, T6 removes that dependency). Fences: Kenney rail fence, 2 pieces per hex edge, pitched with the slope. Walls: 4 Kenney stones + 3 capstones per hex edge. The painted pass skips these four (`objs.skipEdges`) but still makes every random call, so other props do not move. Buildings, crops, bridge, ford, labels stay painted. **Built by:** T4.

### 2e. Structures
- **From:** hex letters `t`, `h`, `b`, `d`, `x`, `k` plus the map file's optional `structures:[[c,r,'mill']]` list (table in section 6).
- **Output:** instanced models from `assets/art/models.js` (`src/world_structures.js`). Buildings are our own period models (`tools/gen_models.py`, see `docs/ASSET_PIPELINE.md`), drawn at 2.4 px per metre; rocks and ford stones are Kenney kit pieces.
- **Today:** with `CW.WORLD` on the painted buildings, bridge, ford and fort outline are skipped. Moving the `'mill'` entry in the map file moves the mill. **Built by:** T5, upgraded by the asset pipeline (9 Oct).

## 3. Known Millbrook-only paths (must be gone by the end of the plan)

| Where | What | Removed by |
|---|---|---|
| `render3d.js` `MILL` | mill at hex [6,10] | T5 (done: the hex now lives in the map file's `structures` list) |
| `render3d.js` `S.trees` from painted pass | tree positions from painted coordinates | T2 |
| `CW.WATER` from `render_art.js` | river/stream polylines recorded while painting | T6 (done: only read when `CW.WORLD` is off) |
| props layer: buildings, bridge, ford, fort, well, haystacks | painted per map by `CW.paintArtFeatures`; roads/brooks/walls/fences 3D (T4), buildings/bridge/ford/fort 3D (T5, painted copies skipped while `CW.WORLD` is on). Crops and labels still painted | T5 done |

## 4. The `CW.WORLD` flag (T1 spike)

- Defined at the top of `src/render3d.js`. `CW.WORLD = true` on this branch.
- **On:** the painted props layer is blanked (the ground weights and the 3D water/forest masks are untouched), the painted-coordinate trees are dropped, the mill is skipped. Ground is drawn from hex letters only.
- **Off:** exactly the old look. Revert = set `CW.WORLD = false`, or open `play.html?world=0` to compare without editing. (A `?query` only works if the file is opened with it, e.g. from a browser address bar; a plain double-click uses the default in the file.)
- **Not touched:** units, combat, AI, camera, the painted map used for the minimap and flat fallback (key 3), and the markings decal drawn by `game.js` (movement rings, LOS, labels).

## 5. Rules every later task keeps

1. Input is the map file only; no coordinates in code.
2. `play.html` works by double-click (`file://`): new art is base64-embedded.
3. Assets are CC0 only and logged in `ASSET_CREDITS.md`.
4. Living off freezes motion and never changes the layout.

## 6. Structure placement table (asset pipeline, 9 Oct)

| Trigger | Models | Rule |
|---|---|---|
| hex `t` town | church, store, farmhouse, brick_house, log_cabin, well | Each connected town: the hex nearest its middle gets the church (towns of 3+ hexes), the next one the store; other lots get houses (seeded). Up to 3 lots per hex: two each side of the road through the hex, fronts facing it, set back by half the building's depth; without a road, a row facing the nearest road (else the town's middle). A lot is skipped if any part of the footprint is within 10 px of any road or overlaps another building. |
| hex `h` farm | farmhouse, barn, 2 haystacks, well, shed | farmhouse faces the road (or nearest road hex), barn behind it, the rest around; seeded |
| hex `b` bridge | stone_bridge (34 m, three arches) | along the road through the hex; else across the river; else east-west |
| hex `d` ford | stepRocks (Kenney river rocks) | same direction rule as the bridge |
| hex `x` fort | 7 earthwork sections in a ring facing outward (stretched to close the ring), 3 wedge tents inside | seeded per hex |
| hex `k` knoll | 3 Kenney rocks | seeded per hex |
| map field `structures:[[c,r,'mill']]` | grist_mill (wheel side toward the water), log pile | hex comes only from the map file |

Brooks: see 2b (water ribbon from `world_water.js`) and 2d (mud bank + gravel).

## 7. Motion: one switch (T7)
Options > "Living landscape" is the only switch (default on; the slow-frame guard can turn it off for a session). It drives one shared uniform (`uLive`) that controls cloud shadows, wind in the wheat, river and brook flow (including the wake field), tree sway, and the slow haze colour cycle. Off = every one of them frozen at frame 0 with the layout unchanged (test: two renders 3 s apart are pixel-identical). Structures, roads, walls and fences never move. No effect is faster than the old ones: clouds drift about 9 map px/s, sway is under 1 rad/s, water flipbook 6 fps with cross-fade.
