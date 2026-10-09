# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: WORLD_PLAN T5 — Structures (+ John's brook feedback)
Branch / commit: main
Result: DONE

## What changed (≤5 lines)
- Town, farm, bridge, ford, fort, knolls and the mill are 3D Kenney pieces placed from hex letters (new src/world_structures.js + assets/art/struct_meshes.js); recipe table in docs/WORLD_RECIPE.md section 6.
- The mill hex now lives in the map file (`structures:[[6,10,"mill"]]` in src/maps/demo.js); the hard-coded MILL hex is gone.
- Painted buildings/bridge/ford/fort are skipped while CW.WORLD is on (random calls still made).
- Brook reworked: runs on into the river bank, faded narrow spring, widens to the mouth, muted water, mud banks, gravel.

## Files touched
src/world_structures.js (new), assets/art/struct_meshes.js (new, 327 KB), src/world_edges.js (instanced() helper, brook), src/render3d.js, src/render_art.js, src/maps/demo.js, play.html, tools/build_tree_meshes.py, docs, ASSET_CREDITS.md

## How to revert
CW.WORLD = false at the top of src/render3d.js, or git revert the T5 commit.

## Evidence
docs/shots/world_t5_town.png, _farm.png, _bridge_mill.png, _brook_mouth.png. Done test: place() with mill at [6,10] gives (524,704), at [8,10] gives (646,722), with no entry gives none.

## Open questions for John / Grok
1. Kenney Nature Kit has NO houses. Towns/farms/mill are tents, logs and plank rows (stand-ins). For real buildings add another CC0 Kenney kit (e.g. Fantasy Town Kit / Medieval Town Base) — needs John's OK.
2. The mill is a hut on a stone platform, no water wheel.
3. Brooks still read CW.WATER from the painted pass (T6).

## Suggested next brief (one line)
T6 — Water (Sonnet), when John says go.
