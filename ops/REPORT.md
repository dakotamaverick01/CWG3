# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: WORLD_PLAN T6 (Water) and T7 (Motion), John's 9 Oct request
Branch / commit: main
Result: DONE

## What changed (≤5 lines)
- T6: new src/world_water.js builds river and brook lines from the map file only; render3d draws brooks with the river's water shader (same colour/flow), mouth runs into the river. CW.WATER is read only when CW.WORLD is off.
- world_edges.js brook is now just mud bank + gravel under the water ribbon.
- T7: the single Options switch already drove clouds, wheat, water, tree sway; label updated; R3.snap() test helper added.

## Files touched
src/world_water.js (new), src/render3d.js (buildWater, buildRibbon, snap), src/world_edges.js, src/menu.js (label), play.html, docs/WORLD_RECIPE.md, docs/WORLD_PLAN.md, STATUS.md

## How to revert
CW.WORLD = false (top of src/render3d.js) or git revert the T6/T7 commit.

## Evidence
docs/shots/world_t6_brook_joins_river.png, world_t6_bridge_river.png. Tests: map with an extra stream edge gives 2 water lines instead of 1; river line equals the painted one (only the off-map end padding differs); snap() at t=100 vs 103 s: Living off diff 0.0, Living on mean diff 31.9 (cloud shadow drift).

## Open questions for John / Grok
1. Real frame rate with the extra water ribbons is unverified on John's Mac.
2. Wake field still uses only the longest river; side rivers get flow but no wake.
3. Buildings are still stand-in tents; broader 3D asset plan needed.

## Suggested next brief (one line)
Decide the building/3D-asset approach; T8 proof map afterwards.
