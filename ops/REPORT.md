# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: 11 Oct "Living fields" (Opus) — piece 1 only (trees). Pieces 2-4 (grass, crops, detail levels) still to do, each in a fresh session.
Branch / commit: main
Result: DONE (piece 1)

## What changed (≤5 lines)
- New `tools/gen_trees.py` (own work): 10 species, 31 variants, leaf-card canopies + painted foliage atlas -> `assets/art/trees.js` (1.2 MB, file:// safe).
- `src/world_trees.js` rewritten: map-driven placement (forest/orchard/field/hedgerow/yard), instanced bark + leaf draws, wind on Living only, shadows cast east.
- `src/world_structures.js`: yard trees now come from world_trees.js (one-line filter). `play.html` loads trees.js. Gallery shows all trees.
- `tools/shot.py`: works on the Mac (Chrome), new `bench` and `freeze,name` views. Installed numpy/Pillow/Playwright for John's user Python.

## Files touched
tools/gen_trees.py (new), assets/art/trees.js (new), assets/models/src/gen/foliage_atlas.png (new), src/world_trees.js, src/world_structures.js, play.html, tools/model_gallery.html, tools/shot.py, ASSET_CREDITS.md, STATUS.md, docs/shots/fields_p1_trees.jpg.

## How to revert
`git revert <this commit>`; full rollback copy of main before the pass: branch `backup-main-2026-10-11-fields`.

## Evidence
docs/shots/fields_p1_trees.jpg (forest NE, forest SE, orchard, town, wide, gallery). Living off: 0 pixels change between t=1 s and t=3 s; Living on: 205k pixels move.
Speed (Mac, real GPU, ms/frame): forest view 1.38 -> 2.26 (1.64x), wide view 1.89 -> 2.83 (1.50x). Forest view is a little over the 1.5x target; piece 4 (detail levels, far-tree billboards) is where that gets trimmed.

## Open questions for John / Grok
1. Tree size: forests now ~16-27 m tall trees (real-world). Too tall next to units at your usual zoom?
2. Colour: deep high-summer green. Darker/lighter?
