# REPORT (Claude's result for the last brief) — overwritten after each task
Brief: 17 Oct, John in chat (Opus): claude/PLAN_OPUS_FIRST_LOOK.md — make the first view and free exploration as beautiful as possible, in five phases, all tied to Detail.
John's answers: morning glow opening, ~8 s skippable glide, plain farm (stone house + bank barn).
Branch / commit: main (5 commits, one per phase)
Result: DONE

## What changed (≤5 lines)
- Phase 1 light: ONE sun (src/world_sun.js, ~21 deg west; was 16 deg ground vs 53 deg objects), long tree/building shadows, baked shade map (ambient occlusion + shadows that grass also reads), split-tone grade.
- Phase 2 distance: sky dome, 3 ridge rings fading into haze, countryside to the hills, tilt down to 10 deg ([ key) = general's-eye view with horizon, valley mist (src/world_sky.js).
- Phase 3 motion: one drifting cloud pattern shading ground, grass, crops and trees; gusts lighten grass and roll across wheat; smoke follows the wind; sky clouds.
- Phase 4 camera: 8 s opening shot for a new battle (low misty valley -> army, mist lifts, UI hidden, any input skips); P = photo mode; drag coasts to a stop.
- Phase 5 assets: hero fieldstone farmhouse + bank barn on the farm nearest the valley's middle, witness oak, dog, beehives, washline; limestone outcrops replace the floating kit boulders on knolls.

## Detail levels
Low: no mist, no sky clouds, shorter tree shadows; shade map + grade are baked/free. Measured same view, software GL: Low 1034 -> 1119 ms (+8%), High 1055 -> 1150 (+9%). General's-eye view ~2x a normal view (sees the whole valley).

## Files touched
src/world_sun.js (new), src/world_sky.js (new), src/render3d.js, src/world_trees.js, src/world_grass.js, src/world_structures.js, src/world_life.js, src/world_edges.js, src/game.js, play.html, tools/gen_models.py, assets/models/{palette,MANIFEST}.json, assets/models/src/gen/*.glb, assets/art/models.js, ASSET_CREDITS.md

## How to revert
Branch `backup-main-2026-10-17-firstlook` = main before this pass. Grade alone: play.html?grade=0.

## Evidence
docs/shots/firstlook_1017.jpg (opening shot, general's-eye view, hero farm, forest edge).

## Open questions for John / Grok
1. Cloud shadows and gusts are deliberately subtle (5 Oct rule). Stronger after seeing them move on the Mac?
2. Opening shot: keep for every new battle, or add an Options toggle?
3. Next: units into the 3D world (roadmap #1) now clash most with the scenery.
