# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: 18 Oct, John in chat (Opus): claude/PLAN_WORLD_PHASES.md (living world; drafted by Claude, approved by John), Phase 1 re-aimed with John's OK.
Branch / commit: main (f36c314 + this report)
Result: DONE (Phase 1 of 5). Stopped for John before Phase 2.

## What changed (≤5 lines)
- Found the river already flowed (Blender flipbook ribbon since 5 Oct), so Phase 1 fixed where things meet the water instead.
- Mill: now stands on the river bank clear of the bridge; its wheel is a separate model that turns (stops when Living is off or Detail is Low) over a new tailrace that flows back into the river.
- Ford: the stretched Kenney river-rocks tile (its own grass and water squares) is gone; a crooked line of stepping stones and loose cobbles instead, and the road fades down into the water.
- Water: white water over the ford stones, at the bridge piers, at brook mouths and under the mill wheel; quicker water where it drops; on High the banks and their trees darken the reflection near each shore.

## Detail levels
Low: no wheel spin, no fast-water layer, no bank reflections (white water kept: it reuses texture reads already made). Medium: spin + fast water. High: + bank reflections.
Timing: software-GL numbers swung ±30% run to run; John said not to worry about it. Check feel on the Mac.

## Files touched
src/world_water.js, src/world_structures.js, src/world_edges.js, src/render3d.js, tools/gen_models.py, assets/models/{MANIFEST.json,CREDITS.md,src/gen/grist_mill.glb,src/gen/mill_wheel.glb}, assets/art/models.js, ASSET_CREDITS.md

## How to revert
Branch `backup-main-2026-10-18-water` = main before this phase.

## Evidence
docs/shots/living_p1_water.jpg (ford before/after High/Low, mill before/after, wide play view).

## Open questions for John
1. The "mill after" shot has a haze and a white line over it that my earlier High shot did not; probably the opening-shot mist or an overlay caught mid-fade, not the water. Worth a look on the Mac.
2. White water strength: subtle now. Stronger or calmer?
