# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: WORLD_PLAN T1 — Recipe and paint-off spike
Branch / commit: world-t1-recipe-spike (see git log)
Result: DONE

## What changed (≤5 lines)
- Wrote docs/WORLD_RECIPE.md (inputs, outputs, Millbrook-only paths still to remove, flag rules).
- Added flag CW.WORLD at the top of src/render3d.js (true on this branch): blanks the painted props layer, drops painted-coordinate trees, skips the hard-coded mill. Ground = hex letters only.
- Stored the plan as docs/WORLD_PLAN.md; appended 6 lines to STATUS.md.

## Files touched
docs/WORLD_RECIPE.md (new), docs/WORLD_PLAN.md (new), src/render3d.js (3 small edits), STATUS.md (+6 lines), ops/REPORT.md, docs/shots/world_t1_paint_on.jpg and world_t1_paint_off.jpg (new)

## How to revert
Set CW.WORLD = false at the top of src/render3d.js. To compare without editing: open play.html?world=0 from a browser address bar (a plain double-click uses the value in the file).

## Evidence (screenshot path / measurements)
docs/shots/world_t1_paint_off.jpg vs world_t1_paint_on.jpg: headless Chromium, file://, same view (Union start, opening view). With the flag on, town, walls, trees and roads are gone; meadow, wheat patches, farmyard dirt and woods floor still read as ground. Console clean (only the pre-existing getImageData note). Run on software GL, so the Mac is the pixel-exact check.

## Open questions for John / Grok
1. Visible in the paint-off shot: no roads, walls, town or trees (expected for T1; T2/T4/T5 bring them back as objects).
2. The plan assigns T1 to Opus; this session ran on Sonnet 5.5. Review the recipe doc with that in mind.
3. Water relies on CW.WATER from the painted pass (documented in the recipe, section 2b).

## Suggested next brief (one line)
T2 — Tree meshes (Sonnet), after John accepts T1.
