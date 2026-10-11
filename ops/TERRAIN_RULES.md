# Terrain rules (decided by John, 11 Oct 2026). Read before any terrain piece.

## Shape
- Hills are REAL: they rise clearly above the valley floor and can be seen from the side at the normal game angle.
- Keep the hex grid, hex letters and game rules exactly as they are. Terrain changes how the land LOOKS.

## Knolls and ridges (height rule)
- A `k` (knoll) hex is raised; a ridge is a line of raised hexes. Heights come from the map data only (no random hills), so the same map always looks the same.
- Height falls off smoothly toward neighbouring non-knoll hexes (no cliffs, no steps).

## Line of sight (ONE consistent rule, visuals only in this pass)
- The "horizon test": a hill blocks the view from A to B only if its top is higher than the straight line from A to B at that spot.
- Visuals only in this pass: the game's line-of-sight and combat rules are NOT changed. If John wants hills to block sight in play, that is a separate game-rule change and needs his OK first.
- The camera must never hide units behind a hill for the player's own view. Units on a hill stay drawn on top.

## Do not touch
Units, combat, AI, camera, game rules, the painted map, `?world=0`, roads/bridges/fords, buildings.
