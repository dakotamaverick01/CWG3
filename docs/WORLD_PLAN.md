# CWG3 world overhaul — remaining tasks

Replace `docs/WORLD_PLAN.md` with this file. Do not delete tasks. Append one progress line when a task's done test passes.

## Done (merged to main, 2026-10-09, ce45a2d)

- T1 recipe + paint-off spike (`CW.WORLD`).
- T2 Kenney tree meshes from forest and orchard hexes.
- Perf: ground-noise skip; step board resolution down before disabling Living.

Work on `main`. Before a task, push `backup-main-<date>`. Do not force-push. One task per session. Stop at the done test. John names the next task.

Units, combat, AI, and the camera stay out of scope. Painted map stays frozen (minimap and key 3). Double-click must work. CC0 only; log in `ASSET_CREDITS.md`.

## T3 — Ground set
Model: Haiku.
One CC0 color texture per terrain letter: grass (already in), woods floor, dirt, rock, swamp, wheat, corn. Use files already in the repo if they exist. Do not search. Do not change lighting.
Done: each letter looks different. Wheat and corn still read as crops. Living stays on.
Revert: put the previous `GROUND_LAYERS` names back.

## T4 — Edges
Model: Sonnet.
Roads, walls, fences, and streams from hex-edge data, instanced. When `CW.WORLD` is on, those four are not painted. Buildings stay painted.
Done: a wall follows a hex edge at a tilt. A road does not break at hex borders.
Revert: `CW.WORLD = false`.

## T5 — Structures
Model: Sonnet.
Town, farm, bridge, mill, earthworks from hex type plus a table in `docs/WORLD_RECIPE.md`. Kenney Nature Kit only. No hand-placed Millbrook objects.
Done: moving the mill hex in the map file moves the mill.

## T6 — Water
Model: Sonnet.
Any river or creek hex gets the ribbon and the bank. Remove any Millbrook-only water path. Flow stays slow.
Done: a creek drawn only in the map file shows water. Living off = still water, not missing water.

## T7 — Motion
Model: Sonnet.
One Living toggle: tree sway, wheat, creek, cloud shadows. Slow. No new effects. Default on.
Done: nothing strobes. Off freezes motion and does not change the layout.

## T8 — Proof map
Model: Haiku.
A second tiny map, data only, same recipe. No new art code.
Done: it loads from the title menu and looks like the same world. Then stop. Units are a later plan.

## This week

John's work usage comes first. Next session is T3 only.

- T3 — done test passed 2026-10-09 (woods floor rocky_2 instead of rocky_3; wheat and corn unchanged). On main.
- T4 — done test passed 2026-10-09 (wall follows a hex edge at 40 and 62 degrees; road is one continuous ribbon). On main.
- T5 — done test passed 2026-10-09 (mill follows the `structures` entry in the map file; removing it removes the mill). Brook now joins the river. On main.
