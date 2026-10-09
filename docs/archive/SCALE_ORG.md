# CWG3 Scale & Organization (decided 2026-09-25) — overrides CWG2 scale

## Scale
- Hex = 150 yards. Day turn = 20 minutes. Dawn (06–07) and dusk (19–20) = 1 turn each. Night = 3 turns.
- Maneuver unit = **battalion** (~250–500 men). One battalion line fills a hex.
- Stacking: 1 infantry/cavalry battalion + 1 artillery battery per hex. Leaders stack freely.
- Sight (hexes): infantry 6, cavalry 8, artillery 6, HQ 8, engineers 6, sharpshooters 7, scouts 10, leaders 7.
- Weapon ranges (Phase 4): rifle-musket volley range 2 hexes (best at 1); smoothbore musket 1; carbines 1–2; Napoleon 12-pdr ~10 hexes; 3-in rifle ~16; Parrott ~16.

## Organization (historical)
Army → Corps (HQ unit) → Division → **Brigade (leader on map)** → Regiment → Battalion.
- Infantry regiment: normally **1 battalion**. Large regiments (500+ present) split into **right & left wings** (2). Regular Army 1861 regiments and heavy-artillery regiments serving as infantry: **3 battalions**.
- Cavalry regiment: **3 battalions/squadrons**.
- Brigade: typically 4–6 regiments (up to 8 late war). Some brigades have an attached battery.
- Artillery: battery of 4–6 guns = one unit (sections later if needed).
- Scenario data lists regiments with present strength and `bns`; the game expands them into battalions.

## Command (updated 2026-09-26)
Chain: Corps HQ (radius 8) → **Division general** (on map, radius 6, +1 if rating ≥7) → **Brigade colonel** (on map, radius 3, +1 if rating ≥7) → battalions. Corps troops (batteries, engineers, scouts, independent cavalry) answer to Corps HQ.
- A battalion outside its colonel's radius is **out of command**: ¾ movement, −20% firepower, worse rallying.
- A colonel outside his division general's radius is **cut off**: his command radius shrinks to 2.
- **Showing it:** every battalion carries its brigade's color and tag (e.g. `2/1` = 2nd Brigade, 1st Division; `C` = corps troops); colonels show ★ tag, generals ★★. Selecting a unit draws command lines (solid = in command, red dashed = out); **C** shows the whole army's lines. The info panel shows a clickable Corps › Division › Brigade › unit banner with green/red dots. The roster is a fold-out tree Corps troops / Division / Brigade / battalions.
- **Orders:** click a colonel (or B) → whole brigade; click a division general → whole division. Group moves keep shape; clicking an enemy with a group selected makes every battalion that can reach it attack in turn.
