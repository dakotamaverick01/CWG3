# BRIEF: Terrain C — vegetation follows the slope (est. ~1% usage)
Status: DONE 17 Oct (see STATUS.md, 2026-10-17). Read CLAUDE.md, ops/TERRAIN_RULES.md, then this file. Do piece C only.

## Goal
Trees, grass and crops sit on the slope: no floating on hilltops, no sinking into hillsides.

## Read first
STATUS.md "START HERE", ops/TERRAIN_RULES.md, and grep: `hAt` in src/world_trees.js, src/world_grass.js (if it exists), src/world_structures.js.

## Do
1. Every placed tree, grass blade, crop and yard item takes its base height from `hAt`, not from the flat ground.
2. Tilt small things (trees, shrubs) slightly to the slope only if it looks wrong; otherwise keep them upright.
3. Trees on steep knolls thin out (reduce density above a slope threshold). Seeded, same map = same result.

## Done when
Forest on a hill reads as standing on the hill at zoom 3.4 and 42°; no floating or buried items; Living off = identical frames.

## Do not touch
Rules list in ops/TERRAIN_RULES.md.

## Checkpoint
Commit + push to main. One picture to John, 3 lines: changed / cost / next.
