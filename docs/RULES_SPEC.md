# CWG3 Rules Spec (digest of CWG2 mechanics — our own wording)

Source: original manual (project doc `reference/cwg2_game_manual.md`). This digest replaces re-reading it. Numbers marked **[tune]** are not given in the manual; we choose them and store in `data/balance.json`.

## 1. Time & map
- Turn = Confederate + Union player turn. Day turns = 30 min. Dawn (06–07) and dusk (19–20) = 1 turn each. Night (20–06) = 3 turns. Side that moves first set per scenario.
- Hex ≈ 200 yards. Height levels (≈30–40 ft each), unlimited levels; adjacent hexes differ by at most 2.
- No combat at night. Dawn/dusk attacks allowed but cost extra health/org. Movement at night/dawn/dusk costs heavy health/org (not on Beginner).
- Battle ends at scheduled date/time, or early if one side has no units and no reinforcements.

## 2. Unit types
| Type | Formations | Sight | Notes |
|---|---|---|---|
| Infantry | March / Combat | 4 | Sizes S/M/L (3/5/7 figures). Can charge (combat formation). Dig in only in combat formation. |
| Cavalry | Mounted / Dismounted | 6 | Only type that attacks in both formations. Mounted charge = more damage dealt, more taken (unless surprise/rear/routed target). Rest & defend better dismounted. |
| Scouts | 1 | longest [tune: 7] | Many MP, cannot attack, poor defense. |
| Specialists (sharpshooters) | 1 | 5 | Snipe from adjacent hex; target cannot return fire; never advance; best at hitting leaders; cannot charge; must pick one unit in a stack. |
| Engineers | March / Working | [tune 4] | Cannot attack. Only unit that can cross rivers anywhere. Working formation: Dig In builds/removes abatis, ruins forts, builds/destroys pontoon bridge on river (bridge consumes the unit). Cannot move in working formation. |
| Corps HQ | Mounted / Established | 6 | Cannot attack; always retreats if attacked; can dig in. Rally point for routed units. |
| Artillery | Limbered / Unlimbered | 4 | Move limbered, fire unlimbered. Range up to 15 by cannon. 9 men per cannon; cannon disabled at half crew lost. Can't change formation and attack same turn (attack uses all MP). Crews won't retreat easily. |
| Horse Artillery | Limbered / Unlimbered | 4 | More MP; formation change & attack cost half → can move, unlimber, fire same turn. |
| Heavy Artillery | 1 (fixed) | 4 | Forts only, immobile, never retreats/routs, very long range, cannot stack. |
| Siege Mortars | Limbered / Unlimbered | 4 | Always indirect fire; useless at close range; can hit friendlies; cannot retreat/rout (captured instead). |
| Frigate (Union) | 1 | — | All-water hexes only. Huge guns. |
| Gunboat | 1 | — | Coastal (mostly water) hexes. Moves and fires same turn. Howitzer-armed = indirect. |
| Mortar Gunboat | 1 | — | Coastal; mortars (always indirect); only shells land units. |
- Naval units can only be attacked by ranged units.

## 3. Unit ratings (0–99 unless noted)
- **Men:** original → alive → effective. Effective (healthy+organized) men are the only ones who fire. Tricolor bar: dead / alive-but-ineffective / effective.
- **Organization (ORG):** falls with movement (esp. combat formation, rough terrain, night), formation changes, combat (more for rear attacks/charges; less if dug in). Regained only by rest (dig in helps less). Below threshold → unit refuses moves; can only rest or voluntary retreat.
- **Health (HLTH):** falls with combat, movement (not Beginner), formation changes, night activity. Regained by rest (more near Corps HQ, in towns/forts; worst in swamp/river/stream).
- **Morale (MOR):** driven by health, org, experience, leader influence, quality, weapon quality, elevation & cover, casualties, excessive/night movement. Win → up; leader killed / enemy routed/surrendered gives bigger swings. Morale shocks ripple through command chain (division full, corps partial). Every action checks morale; failure = refusal.
- **Quality:** fixed per battle; changes between campaign battles (replacements dilute; South worse over time).
- **Experience:** fixed per battle; grows between battles with combat; heavy losses dilute.
- **Movement Points (MP):** refreshed each turn; spent on move, attack, dig in, formation change, rest.
- **Supply (SP):** rounds of ammo (one round = 30 min of firing for that weapon). 1 round per attack or defense; charge = 2 rounds each side. At 0 cannot attack or defend.
- **Firepower (FP):** composite of effective men, weapon, health, morale, org, leader influence, terrain, (range for artillery; formation for cavalry).

## 4. Army-level resources
- **Army Supply points:** starting pool + captures. Retreating enemy leaves 2 rounds (captured as 2 pts when you take the hex). Rout/surrender → capture all their supply. Destroyed units → captured weapons (converted at battle end). Spent on resupply (full/half/quarter/none/oversupply) and between battles on weapons.
- **Army Morale points:** rise/fall with casualties and captured positions; each point = 1 victory point. Can be spent to (a) boost a unit just short of charge morale, (b) Rally a routed unit (may need several tries). Spending doesn't cost VP.

## 5. Leaders & command
- Chain: Army (player) → Corps (HQ unit on map) → Division (attached to a brigade, gold star) → Brigade → Regiment. Brigade-level battles vs regimental-level (everything shifts down one level; player acts as corps commander).
- Leader stats (0–99): **Influence** (FP & morale), **Organization** (unit org; on Adv. reduces move/combat attrition), **Loyalty** (holds under pressure, charges, anti-surrender), **Health**. Overall 1–10 "swords" = average of three modified by health.
- Corps HQ within 3 hexes modifies subordinate leaders: mounted → org only; established → org + influence + loyalty. 3–8 hexes = half effect. Rest near HQ is better; rally chance better near HQ.
- Division commander: replaces brigade leader's stats on the unit he joins; boosts morale & FP; strong rally; affects leaders within 3 hexes (stacks with corps). Reassign at start of turn to unit of his division within 10 hexes.
- Leader wounds: health >60 fine; 40–60 → choose replace or keep (keep = unit can only defend rest of battle); <40 carried off, replaced. Killed = gone for campaign. Wounded may recover between battles (not guaranteed).
- Dismiss one leader per unit between battles; replacement from ranks with no ratings yet.

## 6. Orders
- **Move:** click destination within MP range. Moving into enemy = attack. Undo reverses last move/formation change unless it attacked or revealed an enemy.
- **Change Formation (F):** costs some MP; not on bridges/swamps/river crossings (except engineers). Auto-change before attack if needed.
- **Dig In:** infantry in combat formation, dismounted cavalry, unlimbered artillery, HQ. Not on rivers, streams, cities/towns, swamps, bridges. Takes the whole turn; small health/org gain; optional resupply. Shovel icon; stays entrenched until moved. Uses hex's Prepared Cover (0–6).
- **Rest & Resupply (R):** requires full MP; unit rests rest of turn. End of turn: all units that used no MP auto-rest and get one chosen resupply level. 2 adjacent enemies → max half supply; 3 → none. Oversupply gives morale boost.
- **Charge:** infantry (combat formation) or cavalry. Needs ≥2 rounds, high morale+loyalty+org and combat advantage; volley → volley at point blank → hand-to-hand (weapon H-H rating). Rear charge = most devastating.
- **Rally:** routed unit, spends Army Morale.
- **Voluntary Retreat:** offered when a unit is too disorganized to obey; auto-moves toward its HQ, then nearest supply source.
- **Voluntary Exit:** leave map at a supply source (VP bonus/penalty per source).
- **Skip unit, Next/Prev unit, Center on unit, auto-select next unit.**

## 7. Movement & terrain
- Road bonus only in movement formation and only if road connects both hexes. +1 MP per height level climbed (max +2).
- Combat formation moves cost more MP and more org/health.
- Zone of Control: exerted by specialists, unlimbered artillery, combat-formation infantry, and cavalry. Cannot enter two consecutive ZOC hexes in a turn (unless starting in ZOC). → checkerboard lines work.
- Stacking: max 2 units, only if one is artillery (not heavy artillery). Can pass through one friendly unit; cannot pass through a stacked hex.
- Terrain (MP / cover / notes) — exact costs **[tune]**:
  - Major road: cheapest; less attrition than minor. Minor road. Both exposed.
  - Sunken road: efficient + good cover + morale boost.
  - Railroad: road-like, better cover. Unfinished railroad: slightly more MP, more cover.
  - Town: road-like in movement formation, disruptive otherwise; best rest; disruptive to both sides in combat; no dig in.
  - Grass: best off-road.
  - Forest: high MP, good cover; fights here cost both sides heavy health/org.
  - River: impassable except bridge (road-like; temporary morale drop), pontoon bridge (more MP), ford (some visible, some hidden—discovered by movement range; some rivers fordable everywhere at high cost). Engineers cross anywhere. No formation change/dig in on crossings.
  - Stream: slightly more MP than underlying terrain; reduces cover; no dig in.
  - Rocky knoll: hard to enter, best natural cover, morale boost.
  - Stone wall: good cover, morale boost, forms lines.
  - Swamp: slow, hurts health/org, worst rest, no dig in/formation change.
  - Fort: most cover, morale boost; ruined by engineers or when abandoned → ruined fort (good cover, easier to take).
  - Abatis: extremely costly to cross, can cause casualties.
- Natural cover −5…+6; prepared cover 0…6.
- Height: higher side +10% FP and lower −10% per 1 level; 2 levels = ±40%. High ground raises willingness to attack; attacking uphill discouraged.

## 8. Visibility
- Options: Full Visibility; Line of Sight (terrain blocks spotting); Line of Fire (terrain blocks direct artillery fire). Spotting ranges per unit type above.
- Hidden fords; indirect fire may target hexes with unseen enemies (damage report only).

## 9. Combat
Engagement flow (infantry/cavalry attack):
1. Attacker spends MP to approach, auto-forms for combat.
2. Needs a safe adjacent retreat hex; without one, a failed attack = rout.
3. Morale & supply check → advances to ~100 yds.
4. Defender morale/supply check → may retreat/rout/surrender at reduced fire; else fires first.
5. Attacker absorbs volley (org/health/morale/FP update); may break.
6. Attacker fires (if still fit).
7. Defender absorbs; holds (attacker withdraws = defender wins) or breaks (retreat/rout/surrender; attacker occupies hex).
- **Artillery:** ranged up to 15; non-artillery target can't return fire; artillery vs artillery may duel if target has range. Stack of artillery+other = "fish in a barrel" bonus; choose target both or guns only. Ammo auto-chosen by range: canister ≤1, grape vs units entering hex, case 4–6, solid shot ≥7 [interpolate 2–3 **tune**]. Damage = cannon power at range × number of cannons (effective men ÷ 9).
- **Indirect fire:** mortars (always) and howitzers (when no LOF). Ignores terrain cover; inaccurate—may scatter to adjacent hexes incl. friendlies; mortars more accurate if target visible.
- **Coordinated attacks:** each attack this turn lowers defender FP for rest of turn. "Times Defended" counts attacks by units ≥50% defender size.
- **Rear attack:** second attack from the directly opposite side same turn → attacker fires first with bonus, defender reduced.
- **Surprise:** infantry/artillery attacked in movement formation → attacker fires first, defender penalty.
- **Multiple defenders in hex:** damage split proportionally; both return fire.
- **Rout:** morale collapse → flees to its Corps HQ (rally chance) then supply source and off map (VP loss). Spontaneous recovery possible; Rally button spends Army Morale.
- **After Combat Report:** FP losses, casualties, Army Morale change, supply change, leaders hit — per unit.

## 10. Weapons
- Shoulder arms: Weapon Power (WP) & Hand-to-Hand (H-H) 0–99, cost & ammo cost.
  - Smoothbore (SB): lowest WP, decent H-H. Rifle (RF): middling both. Carbine: good WP, poor H-H. Repeater: excellent both, expensive ammo. Target rifle (specialists only): top WP, poor H-H. Shotgun (cavalry only): low WP, deadly H-H.
- Cannons: Range (R) & Power (P at 2 hexes). Rifled: longer range, canister & solid shot only. Smoothbore: all ammo, shorter range, better close. Howitzer: smoothbore-like + indirect. Mortar: long range, indirect.
- Better weapons raise morale.

## 11. Victory
- Levels: Major/Minor Confederate, Draw, Minor/Major Union.
- VP from: victory hexes (grow in value when contested; heavily contested hexes can become new victory hexes; static if fighting is elsewhere), Army Morale (1:1), casualties/wounded, surrendered/routed men, health & org of army, officers killed, supplies captured, exit bonuses at supply sources. Historical defender may start with VP. Early wipe-out → captured-weapons bonus.

## 12. Campaign layer
- Chain of battles; victory level picks next battle (historical or alternate "what-if"). Up to ~40 battles.
- Carry-over: casualties, experience (+ with combat; diluted by replacements), quality (diluted by replacements; South worse), leader deaths/wounds.
- Between battles: Victory Screen → Field Hospital Recovery Report → Weapon Purchase screen (browse Corps/Division/Unit; by unit type; buy/downgrade weapons paying difference; ammo cost shown; dismiss one leader). Weapons bought at brigade level (regiments re-absorbed).
- Funds = remaining Army Supply + captured weapon value.

## 13. Command Tent / reports
Objectives report (+ generals' advice), Casualty report (incl. VP), Reinforcement report (time/place/type/men, near-term only), Field Hospital, Tactical view / Strategic (zoomed-out) view. Map overlays: movement range, LOF radius (15), LOS path, Times Defended, ready units, fleeing units, low supply units, corps commanders, supply sources, terrain height, prepared cover, terrain morale boost, victory points.

## 14. Options
Difficulty: Beginner (movement costs only MP), Intermediate (uniform attrition), Advanced (attrition modified by leader org, quality, experience). Toggles: Full Visibility, LOS, LOF, After Combat Report (friendly/enemy), auto-select next unit, speed controls, grid, overview map, zoom.

## 15. Eastern Theater (Lee) campaign structure (for Phase 5/6)
Bull Run → Valley (Jackson) → Peninsula → Lee's First Invasion (Maryland) → Fredericksburg / Chancellorsville → Lee's Second Invasion (Pennsylvania) → Wilderness/Overland. Exact battle list & branching to be built from public-domain history, not the original data files.

## Our QoL additions (planned)
Hover combat-odds preview, full multi-step undo within a turn (where legal), end-turn warnings (units with unused MP / low supply), keyboard shortcuts shown in tooltips, colour-blind-safe side colours, scalable UI, autosave.
