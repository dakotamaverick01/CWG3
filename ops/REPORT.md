# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: John 9 Oct (Opus): model the 3D pieces and set up a sustainable asset pipeline; open-source first, generate the rest, Blender last.
Branch / commit: main
Result: DONE (first set)

## What changed (≤5 lines)
- One pipeline: assets/models/{src,MANIFEST.json,palette.json,inbox} -> tools/bake_models.py -> assets/art/models.js; credits auto-written to assets/models/CREDITS.md.
- 13 period models written as code (tools/modelkit.py, tools/gen_models.py), saved as standard .glb (open in Blender too).
- world_structures.js places them from map data: towns facing roads (church + store), farms, grist mill, stone bridge, earthwork fort.
- tools/model_gallery.html: double-click to review every model. docs/ASSET_PIPELINE.md: rules, shopping list, how to add a found model.

## Files touched
tools/modelkit.py, tools/gen_models.py, tools/bake_models.py, tools/model_gallery.html (new); tools/build_tree_meshes.py + 3 old baked files (removed); assets/models/** (new); assets/art/models.js (new); src/world_structures.js (rewritten); src/world_trees.js, src/world_edges.js (comments/errors); play.html; docs.

## How to revert
git revert the commit, or CW.WORLD = false for the painted look.

## Evidence
docs/shots/assets_gallery.png, assets_town.png, assets_farm.png, assets_bridge_mill.png, assets_fort.png. Kenney meshes: same triangles as the old bakes (checked).

## Open questions for John / Grok
1. Look and scale (2.4 px per metre): too small/large next to units?
2. Store facade faces the main road, so from the default camera you see its back. OK?
3. Which next: more generated pieces (worm fence, covered bridge, wagons, cemetery) or John's found models first?

## Addendum (same evening): textures and shaders
- Shader-drawn surface patterns per palette colour (no image files): clapboard, brick, stone, shingles, tin, board-and-batten, planks, logs, earth, hay, canvas, dirt; anti-aliased, fade when zoomed out.
- Buildings: sky/ground fill light, weathering, per-building tint, soft sun shadows. Fences/walls/trees unchanged.
- Evidence: docs/shots/tex_gallery_close.jpg, tex_town_close.jpg, tex_town.jpg, tex_bridge_mill.jpg.

## Addendum 2 (pass 2: variety and life)
- 15 new own models + 7 Kenney stones; per-copy paint/shade/turn/size; yard life (pickets, trees, gardens, privies, woodpiles, wagons, barrels); chimney smoke (Living).
- Roads with uneven wandering ruts, lane grass, puddles, ragged edges; walls of 9 stone shapes with lichen; snake rail fences.
- Evidence: docs/shots/pass2_town.jpg, pass2_farm.jpg, pass2_snake_fence.jpg, pass2_wall_lane.jpg, pass2_lane.jpg, pass2_gallery.jpg.
- Not verified: frame rate on John's Mac (more instances + smoke); models.js is now ~0.9 MB.

## Suggested next brief (one line)
John reviews gallery + in-game; then generate the next batch or vet his finds.
