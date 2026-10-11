# BRIEF: Terrain B — knolls and ridges (est. ~2% usage)
Status: READY, run AFTER Terrain A. Read CLAUDE.md, ops/TERRAIN_RULES.md, then this file. Do piece B only.

## Goal
Knoll (`k`) hexes and ridges are real raised shapes you can see from the side, following the rule in ops/TERRAIN_RULES.md.

## Read first
STATUS.md "START HERE", ops/TERRAIN_RULES.md, docs/TERRAIN_DESIGN.md, and grep: `hAt`, `knoll`, `'k'` in src/render3d.js and src/maps/demo.js (never Read render3d.js whole).

## Do
1. Raise knoll and ridge hexes from map data only; smooth falloff to neighbours (no cliffs).
2. Ground mesh follows the height so units and buildings sit on it (use hAt; don't move units).
3. Visual horizon-test only (see rule). Don't change any line-of-sight or combat code.
4. Check that trees/buildings already on knolls still sit correctly; fix only placement heights.

## Done when
Knolls read as hills at zoom 1.4 and 42° tilt; units on hills still drawn on top; Living off = identical frames; no unit or building floats or sinks.

## Do not touch
Rules list in ops/TERRAIN_RULES.md.

## Checkpoint
Commit + push to main. One picture to John, 3 lines: changed / cost / next.
