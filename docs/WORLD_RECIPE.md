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
- **From:** hex letters `t`, `h`, `b`, `d`, `x`, `k` plus the map file's optional `structures:[[c,r,'mill']]` list (table at the bottom of this file).
- **Output:** instanced Kenney Nature Kit pieces (`src/world_structures.js`, meshes in `assets/art/struct_meshes.js`). The kit has no houses, so towns, farms and the mill are stand-ins built from tents, logs, plank rows and a stone platform.
- **Today (T5 done):** with `CW.WORLD` on the painted buildings, bridge, ford and fort outline are skipped (the painted pass still makes every random call, so other props stay put). Moving the `'mill'` entry in the map file moves the mill; deleting it removes it. **Built by:** T5.

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

## 6. Structure placement table (T5)

| Trigger | Pieces (Kenney Nature Kit, CC0) | Rule |
|---|---|---|
| hex `t` town | 3 tents (middle one open), campfire ring, 2 log piles, signpost | seeded per hex; tents on a ring round the centre |
| hex `h` farm | small tent as barn, 2 ploughed double rows, big log pile, stump | seeded per hex |
| hex `b` bridge | wooden bridge, 1.9 hex long | runs along the road through the hex; else across the river (perpendicular to water neighbours); else east-west |
| hex `d` ford | river-rocks stepping stones | same direction rule as the bridge |
| hex `x` fort | ring of 12 x 2 courses of logs (earthwork), 2 tents, signpost | seeded per hex |
| hex `k` knoll | 3 large rocks | seeded per hex |
| map field `structures:[[c,r,'mill']]` | stone platform, canvas-roofed hut, big log pile, rock | stands on the side of the hex that faces its water neighbours; hex comes only from the map file |

Brooks (T4, reworked in T5): the end nearer the river is run on into the river bank so a brook never stops in open grass; the other end is a narrow faded spring. Width grows from spring to mouth and the banks carry scattered gravel (Kenney flat stone).

## 7. Motion: one switch (T7)
Options > "Living landscape" is the only switch (default on; the slow-frame guard can turn it off for a session). It drives one shared uniform (`uLive`) that controls cloud shadows, wind in the wheat, river and brook flow (including the wake field), tree sway, and the slow haze colour cycle. Off = every one of them frozen at frame 0 with the layout unchanged (test: two renders 3 s apart are pixel-identical). Structures, roads, walls and fences never move. No effect is faster than the old ones: clouds drift about 9 map px/s, sway is under 1 rad/s, water flipbook 6 fps with cross-fade.
