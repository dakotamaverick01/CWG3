# CWG3 Terrain Design (our upgrade over CWG2)

Goal: terrain decides battles, as it did in 1861–65. Every effect is visible in the hover odds breakdown.
Decided with John 2026-09-25. Numbers are starting values → `balance` tuning later.

## 1. Elevation (levels ≈ 35 ft)
- **Sight & dead ground (built Phase 2):** true line of sight over a height profile. Units see from eye height ground+0.3 (mounted +0.45). Trees add +2 levels of obstruction, orchards/towns +1. A ridge between observer and target hides the reverse slope → dead ground emerges naturally. Observers above the target get +1 sight range per level (max +2).
- **Artillery from heights (Phase 4):** +1 hex range per level above target (max +2). Can fire over friendly units if gun is ≥1 level above the intervening hex. Direct fire needs LOS, so reverse-slope troops are safe from it (howitzers/mortars excepted).
- **Uphill assault (Phase 2 move / Phase 4 combat):** +1 MP per level climbed (+2 artillery; artillery can't climb a 2-level step off-road). In combat: attacker loses extra org per level climbed; defender +10%/level fire (CWG2's rule, kept); attacker's charge needs higher morale uphill; charging downhill +15% shock.

## 2. Hex-edge terrain (built Phase 2)
Linear features sit on hex edges; their protection applies only to attacks/fire crossing that edge.
| Edge | Move cost | Defender when attacked across it | Notes |
|---|---|---|---|
| Stone wall | +2 (artillery: road only) | cover +3, morale +5 | Marye's Heights / Sunken Road type positions |
| Rail fence | +1 (0 on road) | cover +1 | Attackers crossing lose org (disorder) |
| Stream | +2 (0 where a road crosses) | cover +1; attacker −10% FP | Attacker crossing is disordered |
| Crest (auto from height) | — | defender on the higher side gets the uphill bonus | Derived, not authored |
Flanking a wall line removes its benefit — the walls only face one way.

## 3. Facing (built Phase 2)
- Each unit faces a hexside. Arcs: **front** = facing ±1 (3 sides), **flank** = facing ±2, **rear** = opposite.
- Moving sets facing to the direction of the last step. Line/combat formation pays 1 MP per hexside turned (also when changing direction mid-move); column/limbered/mounted turn free. Q/E rotate.
- ZOC: combat-formation units exert ZOC into their front arc only; specialists and skirmishers all around. → you can slip past a flank.
- Combat (Phase 4): flank attack +40% attacker FP and defender fires at half; rear attack +60% and big morale shock (stacks with CWG2 rear-attack rule). A flank resting on a river, swamp, impassable edge or friendly unit can't be hit — anchoring a line matters.

## 4. Woods
- Move: forest 4 MP (mounted cavalry ×1.5, artillery 6).
- LOS blocker (+2 levels) → artillery can't fire into or through woods beyond 1 hex; guns inside woods fire at range ≤2, power −50%.
- Mounted cavalry fighting in woods: −50% FP.
- **Close-range bloodbath (Phase 4):** fights where either side is in forest: both sides' casualties ×1.5, and results trend toward mutual damage rather than a clean win (defender retreat chance reduced).

## 5. Fields of fire (Phase 4)
When an attacker ends its approach in or crosses clear terrain (grass, crop field, road) within the defender's weapon range, the defender gets +15% FP (+30% for artillery firing canister at ≤2 hexes). Covered approaches (woods, dead ground, sunken road) deny it.

## 6. Cover & terrain table (hex)
| Terrain | MP (column / line) | Cover | Sight obstacle | Other |
|---|---|---|---|---|
| Grass | 2 / 3 | 0 | 0 | field of fire |
| Crop field | 2 / 3 | 0 | 0 | field of fire; usually fenced |
| Orchard | 3 / 4 | +1 | +1 | |
| Forest | 4 / 6 | +3 | +2 | see §4 |
| Town | 1.5 / 5 | +2 | +1 | best rest; disorders both sides in combat |
| Farm | 2 / 3 | +1 | +1 | |
| Rocky knoll | 5 / 6 | +4 | 0 | morale boost |
| Swamp | 6 / 8 | −2 | 0 | art. impassable; health/org loss |
| River | impassable | −3 | 0 | bridge = road; ford 5 MP |
| Fort | 3 / 3 | +6 | 0 | morale boost |
| Sunken road | road | +3 | 0 | hidden from non-adjacent observers at same/lower height |
| Roads | major 1, minor 1.5 (column only, must connect) | 0 | 0 | |

## 7. Weather (built Phase 2: toggle for testing)
- **Clear**.
- **Rain:** sight −1; next turns become **Mud**.
- **Mud:** road costs ×2 (major ×1.5), off-road +1; artillery ×1.5 more. Lasts until dry turns pass.
- **Fog (dawn):** sight capped at 2 hexes.

## 8. Transparency
Hover an attack → expected result + breakdown ("Uphill −15% · Stone wall +30% · Flank +40%"). Built with combat in Phase 4; terrain panel already shows edges, height, cover now.
