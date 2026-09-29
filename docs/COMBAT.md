# CWG3 Combat (Phase 4, part 1 — built 2026-09-25)

## Actions (select your unit, then click a visible enemy)
- **Volley** (default): fire at range — rifles 2 hexes (best at 1), carbines 2 (1 mounted), target rifles 3, cannon by type (+1 range per level of height, max +2). Every battalion may volley **once per turn, even after moving** — full strength with all movement unused, down to 60% after a full march; firing uses 4 MP (artillery: full turn, must be unlimbered, can't move and fire). Needs line of sight beyond 1 hex; guns can't fire through friendly troops on equal/higher ground. Target returns fire if it can reach you (not vs sharpshooters).
- **Assault** (A to switch mode, or Shift+click adjacent enemy): needs 2 MP left (plus deploying from column); uses the rest of the turn. Advance into the hex. Defender fires first unless surprised (flank/rear, or caught in column). Defender then may give way; if the hex empties the attacker occupies it.
- **Charge** (A again): assault + hand-to-hand (weapon H-H rating). Needs higher nerve; far more decisive and bloody.
- **Rally** (Y): routed unit, costs 3 Army Morale; better near its brigadier.

## Firepower
Effective men × weapon power × condition (order/health/morale) × leadership (out of command −20%) × formation (column −60%, mounted fire −40%) × height (±10% per level, ±40% at 2) × special (guns/cavalry in woods −50%, oversupplied +5%, fields of fire +15% / canister +30% vs troops in the open, crowded hex +30% vs artillery).
Casualties = firepower × 6 × cover (−7.5% per cover point; hex + edge feature facing the shooter + entrenched +2) × woods close fight ×1.5 × ±20% luck.
Flank ×1.4 (return fire ×0.5), rear ×1.6 (return ×0.3).

## Breaking
- Volleys: unit falls back/routs if morale drops below ~30 (higher vs flank/rear).
- Assaults: chance defender gives way = logistic on (morale − pressure). Pressure: assault 52 / charge 56, +15 flank / +25 rear, +12 per doubling of numbers, −4 per cover point, −2 per leader point above 5, −8 unlimbered guns.
  Tuning check (equal 400-man battalions, open ground): frontal assault ~5%, frontal charge ~23%, flank charge ~83%, charge on a stone wall ~12%.
- Routs flee toward their supply source each turn (may rally on their own near their brigadier); no free hex = surrender. Retreats leave 2 supply for the winner.
- Leaders in the fired-on hex can be wounded/killed (sharpshooters ×3); brigade morale drops and an acting commander (lower rating) takes over.

## Victory points
Objectives held (Millbrook 20, Carrow Knoll 10, Stone Bridge 10, Sunken Lane 10, Dunmore Farm 5) + enemy casualties ÷ 40 + (Army Morale − 50). Difference ≥30 major victory, ≥10 minor, else draw. Battle ends at time limit or when a side has no fighting units.

## Not yet (next)
Computer opponent (AI v1), after-battle screen polish, howitzer/mortar indirect fire, engineers' bridges/abatis, sound.

## Line of sight fix (2026-09-26)
Only true crests (higher than both observer and target) and obstacles (woods, orchards, towns) block sight. Previously any intermediate hex at the observer's height blocked the view down a slope — that was why units on a rise couldn't see or fire at the foot of it.
