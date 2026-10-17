# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: 17 Oct (night), John in chat (Opus): "painted diorama" visual reboot modelled on Ultimate General: Gettysburg. John's answers: painted + fading 3D close-up; hex grid hidden unless needed; much bigger hills; farm-shaped fields. Cap ~20% weekly.
Branch / commit: main
Result: DONE (first pass)

## What changed (≤5 lines)
- One generated colour map decides ground colour at every zoom; grass and crop stalks copy their colour from it and fade in (no more look switching).
- Farm-shaped fields in crop strips, fences along them; pasture patchwork; tree lines along fences and roads.
- Hex grid hidden (soft local grid at the mouse; G shows all); out-of-reach shading without seams.
- Hills 1.5x; land continues past the board edge into darker countryside; contrast + vignette.

## Files touched
src/world_paint.js (new), src/render3d.js, src/world_grass.js, src/world_edges.js, src/world_trees.js, src/render_art.js, src/game.js, play.html, CLAUDE.md, STATUS.md, ASSET_CREDITS.md, docs/shots/diorama_1017.jpg.

## How to revert
Branch `backup-main-2026-10-17b` = main before this pass.

## Evidence
docs/shots/diorama_1017.jpg (zoom 0.6 / 1.0 / 1.5 / 2.6, forest, east). Wheat reads gold at every zoom; measured colour of 3D stalks vs painted ground matched.

## Open questions for John / Grok
1. Unit art now clashes most with the world (UG uses many tiny figures). Next big item?
2. Field strips (wheat/oats/stubble): keep the variety or make wheat fields solid gold?
3. Labels ("Harper Creek") could be restyled as engraved map lettering like UG.
