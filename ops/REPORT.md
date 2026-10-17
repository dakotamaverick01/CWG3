# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: 17 Oct, John in chat (Opus): finish living-fields piece 4, run terrain A/B/C, then a free creative look pass (world look only). Cap ~20% weekly usage.
Branch / commit: main
Result: DONE

## What changed (≤5 lines)
- Piece 4: Options > Battlefield detail (Auto/Low/Medium/High); slow-frame guard lowers detail before it ever turns Living off; far trees drop leaf cards by distance.
- Terrain A/B: taller relief, knoll crowns, rolling ground, carved river/brook beds, slope shading + dry crests / lush hollows / soil streaks.
- Terrain C: trees thin on steep slopes, sit into the slope, shadows lie on the hill; grass colour follows the relief; wildflower meadows.
- New src/world_life.js: grazing cattle and sheep near farms/towns, vultures circling (Living only).
- Fixes: skirt under the river beds; river hexes no longer show as bald hexagons.

## Files touched
src/render3d.js, src/world_grass.js, src/world_trees.js, src/world_life.js (new), src/game.js, src/menu.js, play.html, tools/shot.py (hides the help pop-up), STATUS.md, ASSET_CREDITS.md, ops/BRIEF.md, docs/shots/look_1017_compare.jpg.

## How to revert
Branch `backup-main-2026-10-17` = main before this pass (`git revert` the commit, or reset to that branch with John's OK).

## Evidence
docs/shots/look_1017_compare.jpg (before/after: ridge, creek, knoll, forest, farm). Speed in STATUS.md (relative, software GL).

## Open questions for John / Grok
1. Relief: hills read now but stay gentle (map heights are 0-4 and the camera never goes below 40 degrees). Want them taller (EX 36 -> 44) or a lower camera minimum?
2. The sun is low in the west (late-afternoon shadows). Keep, or raise it toward midday?
3. Animals and vultures: keep, more, or fewer?
