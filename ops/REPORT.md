# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: WORLD_PLAN T4 — Edges
Branch / commit: main
Result: DONE

## What changed (≤5 lines)
- Roads, brooks, walls, fences are built from the map data as 3D pieces (new src/world_edges.js, assets/art/edge_meshes.js); the painted versions are skipped when CW.WORLD is on.
- Roads/brooks = continuous ribbons draped on the terrain; fences = Kenney rail fence pitched to the slope; walls = Kenney stones along each hex edge.
- Painted layer restored for buildings, crops, bridge, ford, labels (T1 had hidden all of it).

## Files touched
src/world_edges.js (new), assets/art/edge_meshes.js (new, 15 KB), tools/build_tree_meshes.py (now bakes both files), src/render_art.js (skipEdges, ~8 lines), src/render3d.js (3 small edits), play.html, docs/WORLD_RECIPE.md, ASSET_CREDITS.md, STATUS.md, docs/WORLD_PLAN.md, docs/shots/world_t4_*.jpg

## How to revert
CW.WORLD = false at the top of src/render3d.js (everything painted again).

## Evidence
docs/shots/world_t4_walls40.jpg and world_t4_walls62.jpg (wall follows the hex edges), world_t4_road.jpg (road continuous through Millbrook, painted buildings and label intact), world_t4_brook_fences.jpg. Headless Chromium on file://, no console errors or warnings. Software GL: check feel and speed on the Mac.

## Open questions for John / Grok
1. Look: road is a dusty brown ribbon, brook a slate ribbon with mud banks, walls grey stones with mossy tops, fences brown rails. Want any of them lighter/darker or the wall higher?
2. Not verified: the painted-style gate in vertical walls (10% before) is gone; walls are plain.
3. The mill is still hidden until T5. Brooks still depend on CW.WATER from the painted pass (T6).

## Suggested next brief (one line)
T5 — Structures (Sonnet), when John says go.
