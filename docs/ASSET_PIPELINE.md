# 3D asset pipeline (how every 3D model gets into CWG3)

Started 9 Oct 2026 (Opus session). Replaces the one-off `tools/build_tree_meshes.py`.

## The short version

```
assets/models/src/<folder>/<model>.glb     source files (Kenney kit pieces, files John finds, our generated buildings)
assets/models/MANIFEST.json                one line per model: file, size rule, colours, credit
assets/models/palette.json                 the house colour palette (one edit recolours every building)
        |  python3 -I tools/bake_models.py   (1 second)
        v
assets/art/models.js                       every model as base64 (CW.MODELS), loaded by play.html, works by double-click
assets/models/CREDITS.md                   credits table, written automatically from the manifest
tools/model_gallery.html                   double-click to see every model side by side, at real size
```

Our own buildings are **written as code** in `tools/gen_models.py` (helpers in `tools/modelkit.py`):
`python3 -I tools/gen_models.py` writes standard `.glb` files into `assets/models/src/gen/`, then bake as above.
A building is ~20 lines of numbers (width, depth, eave and ridge height, window positions), so changing it is quick, it always
matches the palette, and it costs nothing. The `.glb` files also open in Blender if we ever want to hand-edit one.

The game places models from the map data in `src/world_structures.js` (towns, farms, bridge, fort, mill) and
`src/world_edges.js` / `src/world_trees.js` (fences, walls, trees). Our models are in metres and drawn at 2.4 px per metre.

## Surface patterns and shadows (no texture files)

Each palette colour has a **pattern number** (`_patterns` in `assets/models/palette.json`): 1 clapboard, 2 brick, 3 stone blocks,
4 shingles, 5 tin roof, 6 board-and-batten, 7 planks, 8 log grain, 9 earth/grass, 10 hay, 11 canvas, 12 dirt road (0 = plain).
The baker stores that number per vertex; the shader in `src/world_edges.js` (IFS) draws the pattern from the model's own
coordinates in metres, so there are no image files and it works by double-click. Lines are anti-aliased and fade out when
zoomed far out, so nothing shimmers. Buildings also get sky/ground fill light, big weathering patches, a per-building tint, and
a soft sun shadow on the ground (footprint swept away from the low western sun, `src/world_structures.js`).
To give a new colour a pattern, add it to `_patterns` and re-bake. To change a pattern's look, edit its line in `pattern()`.

## Rules for every model

| Rule | Why |
|---|---|
| Licence **CC0** (public domain) or our own work. CC-BY only with John's OK, and then the author goes in the manifest's `sources`. | Rule 6 in CLAUDE.md; no surprises if the game is ever shared. |
| Format **.glb** (best) or **.gltf** (+ its .bin). OBJ is fine (Claude converts it to .glb first). FBX / .blend only if there is no other choice (needs the Blender plugin to convert). | The baker reads glTF directly. |
| **Low poly**: under ~3,000 triangles for a building, ~1,000 for a prop. | Dozens of copies on screen; John's Mac must keep 30 fps. |
| **Flat colours** (one colour per material) or one small texture. Textures are ignored for now; colours come from the palette. | Keeps one consistent painted look. |
| Front of a building = +Z, base on the ground, real size in metres (the baker can also rescale). | So placement rules work for every model. |
| Style: "stylised low poly" like Kenney / Quaternius. **Not** photo-scans (huge, wrong style), **not** fantasy/medieval (half-timber, towers). | Must look like 1860s rural America and sit with the trees we have. |

## Shopping list (what John can look for)

**Already done in code (no need to find):** farmhouse (I-house), barn, white church with steeple, general store,
brick town house, log cabin, stone grist mill with water wheel, three-arch stone bridge, earthwork section, wedge tent,
haystack, well, open shed.

**Easy for me to generate next (also no need to find):** worm / snake rail fence, dry-stone wall, covered wooden bridge,
corn shocks and wheat sheaves, Sibley (bell) tent, farm wagon, springhouse, tavern, courthouse, railroad track + depot,
cemetery with headstones, abatis and gabions (field fortifications), signal tower.

**Worth finding (organic shapes are hard to write as code):**

| Want | Notes | Good places to look |
|---|---|---|
| More tree species: oaks, maples, sycamores, dead trees, fallen logs | low-poly, a few hundred triangles each | Quaternius (nature packs), Kenney (the Nature Kit has more we haven't used), Poly Pizza |
| Bushes, hedgerows, tall grass clumps, reeds / cattails | for field edges and creek banks | same as above |
| Horses, cattle, sheep | farm life, later cavalry | Quaternius (animal packs), Poly Pizza |
| Covered (Conestoga-style) wagon, cart, barrels, crates | camps and supply depots | Kenney (Survival Kit, Furniture Kit for crates/barrels), Quaternius, Poly Pizza |
| Cannon (Napoleon 12-pdr, Parrott rifle), limber, caisson | only if units go 3D later | Sketchfab (filter: Downloadable + CC0), Smithsonian Open Access 3D (CC0 museum scans, would need simplifying) |

**Where to look, with the filter to set:**
- **Kenney** — kenney.nl/assets, everything is CC0.
- **Quaternius** — quaternius.com, everything is CC0.
- **KayKit** — kaylousberg.itch.io, the free packs are CC0.
- **Poly Pizza** — poly.pizza, each model shows its licence; pick CC0 (CC-BY needs John's OK).
- **Sketchfab** — sketchfab.com, tick *Downloadable*, set licence to *CC0*. Avoid *Standard*, *Editorial* and *NonCommercial*.
- **OpenGameArt** — opengameart.org, 3D art, filter licence CC0.
- **Smithsonian Open Access** — 3d.si.edu, CC0 museum scans (very detailed; good for a reference or a simplified copy).

**Avoid:** "free for personal use", "non-commercial", "editorial", models ripped from other games, anything without a clear licence.

## How John adds a model he found

1. Download it (prefer the `.glb` or `.gltf` option).
2. Put the file in `~/Documents/CWG3/assets/models/inbox/` on the Mac, plus a text file with the same name holding the page link and the licence.
3. Tell Claude "new models in the inbox". Claude checks the licence and the size, moves them to `assets/models/src/found/`,
   adds a manifest line, bakes, and shows them in the gallery before putting them in the game.

## Other creative options (for later)

- **Blender plugin** (connected on John's Mac): good for one-off hero pieces or converting FBX/.blend files. Last resort, it is slow to iterate.
- **AI image-to-3D generators** (open-source models exist): output is usually heavy and messy and needs simplifying, and each tool's licence must be checked first. Possible for organic props, not buildings.
- **Texture atlas:** later, a small hand-painted texture (clapboard lines, brick courses, shingles) on our generated buildings could add detail without adding triangles.
