# CWG3 world overhaul — task list

John uploads this file. Claude stores it at `docs/WORLD_PLAN.md` and does not rewrite it except to mark a task done. Grok is chief of staff. Claude does not pick the next task.

## Rules

- V1 is still one battle, Millbrook, vs the computer. No new battles until T8.
- Units, combat, AI, and the camera are out of scope until this list is done.
- The painted map is frozen. It stays the minimap and the flat fallback (key 3). Do not improve it.
- The map file is the only input: hex terrain, height, edges. The same code must work for a second map.
- Double-click `play.html` must work. New art is embedded (base64). No URL-only textures.
- Assets: CC0 only. Log each one in `ASSET_CREDITS.md`. Kit: Poly Haven ground already chosen; Kenney Nature Kit for props (https://kenney.nl/assets/nature-kit).
- One task per session. Stop when the done test passes. Do not start the next task.
- Branch off `main`. Do not merge. John reviews, then merges.
- Append 6 lines to `STATUS.md`. Write the result in `ops/REPORT.md`.
- If two fixes fail, stop and write the failure in `ops/REPORT.md`.

## Models

- Opus: T1 only.
- Sonnet: T2, T4, T5, T6, T7.
- Haiku: T3, T8, and any STATUS/credits edit.

## Tasks

### T1 — Recipe and paint-off spike
Model: Opus. One session.
Write `docs/WORLD_RECIPE.md`: inputs (terrain letter, height, edges) and outputs (ground, water, vegetation, structures). No Millbrook-only paths.
Spike in `src/render3d.js`: a flag `CW.WORLD = true` hides the painted props layer and draws ground from hex letters only, using the CC0 meadow already on main. Trees may be missing in this shot.
Done: screenshot of Millbrook with the paint layer hidden, ground still readable. Revert is `CW.WORLD = false`.

### T2 — Tree meshes
Model: Sonnet. After John accepts T1.
Replace camera-facing tree billboards with three Kenney Nature Kit meshes (broadleaf, pine, bush). Place them from forest and orchard hexes, not from painted coordinates. Instance them. Random yaw, small scale variation. Thin a hex where a unit stands. Slow sway only while Living landscape is on.
Done: woods have volume from two angles. Open field has no trees. Double-click works.

### T3 — Ground set
Model: Haiku. After John accepts T2.
One CC0 color texture per terrain letter: grass (already in), woods floor, dirt, rock, swamp, wheat, corn. Download only files named in `ops/BRIEF.md` if John supplies them; otherwise use the meadow files plus Kenney ground colors as flat fallbacks. Point `GROUND_LAYERS` at them. Do not change lighting.
Done: each terrain letter is visibly different. Wheat and corn still read as crops.

### T4 — Edges
Model: Sonnet. After John accepts T3.
Roads, walls, fences, and streams come from hex-edge data, as instanced pieces. Remove those four from the painted props layer when `CW.WORLD` is on. Leave buildings painted.
Done: a wall follows a hex edge when the camera tilts. A road does not break at hex borders.

### T5 — Structures
Model: Sonnet. After John accepts T4.
Town, farm, bridge, mill, earthworks from hex type plus a small table in `docs/WORLD_RECIPE.md`. Kenney kit only. No hand-placed Millbrook objects.
Done: Millbrook town and the mill appear from data. Moving the mill hex in the map file moves the mill.

### T6 — Water
Model: Sonnet. After John accepts T5.
Any river or creek hex gets the ribbon and the bank. Delete the Millbrook-only path if one remains. Flow stays slow.
Done: a creek drawn only in the map file shows water. Living off = still water, not missing water.

### T7 — Motion pass
Model: Sonnet. After John accepts T6.
One Living toggle: tree sway, wheat, creek, cloud shadows. Slow. No new effects. Default on.
Done: nothing strobes. Turning the option off freezes motion and does not change the layout.

### T8 — Proof map
Model: Haiku. After John accepts T7.
Add a second tiny map, data only, using the same recipe. No new art code.
Done: it loads from the title menu and looks like the same world as Millbrook. Then stop. Units are a later plan.

## This week

John's work usage comes first. Run T1 only if a 5-hour window is free. Do not start T2 in the same window.

---
Progress (Claude marks tasks only):
- T1 — done test passed 2026-10-09, branch `world-t1-recipe-spike`; awaiting John's review. Not merged.
