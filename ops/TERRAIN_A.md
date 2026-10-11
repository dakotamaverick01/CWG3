# BRIEF: Terrain A — height look (est. ~2% usage)
Status: READY. Written 11 Oct 2026 (chat plan, John's answers). Run in a fresh Claude Code session. Read CLAUDE.md, then ops/TERRAIN_RULES.md, then this file. Do piece A only.

## Goal
Make the valley's ground read as land with slopes: shading and contours so real height is visible. No new models yet.

## Read first (only these)
STATUS.md "START HERE", ops/TERRAIN_RULES.md, docs/TERRAIN_DESIGN.md, and by grep only: `hAt`, `W3`, `terrain` in src/render3d.js (never Read it whole).

## Do
1. Ground shading: slope-based light and shadow on the ground mesh (darker on shaded slopes, lighter on sunny faces, sun = normalize(vec3(-0.5, 0.75, 0.25))).
2. Subtle contour/erosion texture on slopes via the existing ground shader; keep it seeded by map position.
3. Keep `hAt(x,y)` as the single source of height; don't add a second height function.

## Done when
A contact sheet at zoom 1.4 and 3.4 shows slopes readable; Living off = identical frames; bench not worse than 1.2x before.

## Do not touch
Rule list in ops/TERRAIN_RULES.md "Do not touch".

## Checkpoint
Commit + push to main. Send John one picture and 3 lines: what changed, what it cost, what's next.
