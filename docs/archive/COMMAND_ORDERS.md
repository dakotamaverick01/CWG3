# CWG3 — Command & Orders Design (v1 built 2026-09-27)

## Problem with today's build
Clicking a hex shifts the whole brigade shape by that vector; each battalion then moves as close as its MP allows. The end state can't be seen before committing, the line breaks when MP differ, each click is a fresh nudge (nothing is remembered), and facing/frontage/formation are guessed.

## Principle
Order the **formation**, not the hexes. An order = where the line stands + facing + formation template + stance on contact. Every battalion gets an exact, visible slot before you confirm. Commanders (division / brigade) are the main way to play; battalion control stays legal but is the exception.

## Decided (John, 27 Sep)
1. **Hybrid standing orders.** Dragging a line creates a standing order the brigade carries out over turns, in formation, until it is done or changed. Ghosts: solid = end of this turn, faint = final position.
2. **Click + drag gesture.** With a commander selected, press where the centre should go and drag sideways. The drag length sets frontage (long = all abreast, short = supports or two lines) and the direction sets facing (perpendicular to the drag). A plain click keeps the current frontage and faces the direction of travel.
3. **Cohesion: slowest pace, shape locked.** The whole brigade moves at its slowest battalion's MP, so the line never breaks. Terrain snags slow everyone.
4. **Division order = brigade slots.** Dragging a division line splits it into brigade sectors (front-left, front-right, support), and each brigade gets its own standing order. Click a brigade tag to swap Front and Support roles.

## Maps onto the handoff locks
MARCH = Column template along roads toward a head hex. FORM LINE = drag-a-line in place (colonel 1 hex behind the centre). ADVANCE LINE = a standing order that keeps the shape and walks the slots.

## Round 2 — John: "defaults are fine" (these are now built)
- When do orders move? **Confirming moves leg 1 immediately; later turns an "Advance orders" button (or auto at turn start, set in Options) moves every brigade one leg.** Alternatives: all at End Turn; one click per leg.
- Is the regiment a level? **Light: the two wings of a regiment share one slot and detach together.** Alternatives: full regimental orders; battalions only.
- Detach / rejoin? **A Detach button (or Alt+drag) closes up the line and shows a dashed tether; Rejoin walks the unit back to the nearest open slot. Routed units auto-detach and auto-rejoin when rallied.**
- Combat under standing orders? **Stance per order: Advance & engage / Halt on contact / Hold. The brigade halts when an enemy is revealed, then one click on the enemy = brigade volley (Shift = charge).**
- Couriers: should brigades outside the division commander's radius get orders a turn late? (Undecided.)
- Templates offered: Line, Supports (2 up 1 back), Column, Echelon L/R, Reserve.

## Build notes (for Claude)
- Order object on each brigade: {anchor, facing, frontage, template, stance, legs}. Slot solver = assign battalions to template slots minimising total travel; path each slot with the existing reach(); leg length = min MP across the brigade.
- The preview ghosts reuse the dashed-hex drawing in game.js draw(); replace groupTargets()/groupMove().
- AI v1 should issue the same order objects, so the AI and the player share one movement system.

## Built in v1 (src/orders.js)
- **Controls:** select a colonel or general (map flag or roster header). Then:
  - **Drag** on the map to set the new front. The drag length sets frontage and the troops face away from where they stand now.
  - **Click** = go there with the last frontage, facing the direction of travel. **Shift** = march column.
  - **Right-drag** pans.
  - **Q/W** turn the ordered facing (e.g. fall back but keep facing the enemy).
  - **P / Orders ▶** carries out every standing order.
  - **J** switches stance between Halt on contact and Press on. **I** = Hold (cancel the order). **Z** detaches or rejoins a regiment (both wings).
  - Option: carry out orders automatically at turn start.
- **Preview:** hovering shows faint slots for a plain click. While dragging, dashed ghosts show the final places, solid ghosts show end of this turn, and a label shows the width and the estimated number of turns.
- **Movement rules:**
  - Slots are fixed per order, so battalions never swap targets.
  - Regiments are kept side by side, and slots avoid hexes other units hold or have been promised.
  - Line infantry sets the pace (lockstep: everyone covers 1/N of their route). Skirmishers, guns and horse move at their own speed.
  - Battalions approach in march column and deploy into line on arrival.
  - The route planner steers round friendly units. A battalion that can't get closer counts as in place.
  - The colonel rides just behind his moving brigade and takes his post on arrival. Division generals follow their brigades.
- **Division orders:** the line splits into brigade sectors; with 3+ brigades the rear ones go in support 3 hexes behind.
- **Saving and undo:** orders are stored on the colonel, so save/load/undo keep them.
- **Not yet:** couriers; swapping front/support roles by clicking a brigade tag; Supports / Echelon templates beyond line and column; AI using the same orders (Phase F).

## v1.1 — simplified controls (John: "let's try the simplification", 27 Sep)
Two gestures total:
1. **Select a commander, then drag or click.**
   - The drag sets where the line stands and which way it faces. Drag top→bottom = face east, bottom→top = face west; a bold arrow shows it. This replaces "away from the troops", so falling back while facing the enemy is just a drag in the other direction.
   - A click = go there, facing the way of travel.
   - Clicking the commander again = stop / hold.
2. **Move a battalion by hand** = it detaches (dashed tether). The next brigade order brings it back.

Automatic now:
- Standing orders carry on at the start of every turn (no P button, no option).
- Always halt when the enemy is spotted; a new drag presses on.
- March column on the way, line on arrival.

Removed: P/Orders ▶, J stance, I hold, Q/W order rotation (Q/W still turn a single battalion), Shift column, Z detach, the auto-orders option.
Preview: white dashed slots = final places, brigade-coloured solid = end of this turn, bold arrow = facing.

## v2 — three-tier command (John, 27 Sep): "division level is the only level that really works"
Brigade orders were too fiddly for 6 units, and multi-turn orders were confusing below division level. So:
- **Division = the order level.** Drag a line → brigade sectors; a standing order that carries on each turn. Click the general again = stop. The roster shows each division's status: ▶ on the march / in position / halted.
- **Brigade = one piece, CWG2-style.** Click a brigade (colonel or roster header), then click a hex: the whole block **slides there this turn keeping its exact shape and facing**. No drag and no carry-over.
  - Shading marks hexes the brigade can't fully reach this turn.
  - Hovering shows dashed = where each battalion ends up, solid = where it stops if out of reach.
  - Q/W turn every battalion 60° in place.
  - Each battalion stays in line if it can make its spot in line this turn, otherwise it marches in column (deploying on arrival if MP allow).
  - If someone spots the enemy, the block still finishes its move together.
  - A brigade moved this way drops its part of any division order.
- **Battalion:** moving one by hand detaches it; the next brigade move or division order brings it back.
- **Corps: no orders, a radius bonus only.** A division general within the Corps HQ radius (8) gets +1 command radius and +10% rally chance for his troops. There is no penalty outside it; division generals are never "cut off".
- Tested: 206 of 227 in-range brigade moves across 4 brigades land exactly, 14 more complete after spotting the enemy, and 7 fall short in traffic jams. No console errors.

## v2.1 — brigade-by-brigade turn flow (John, 27 Sep): "some natural orderly system… it auto-selects the next commander"
The problem: with 4–8 brigades it was hard to see who still hadn't moved. Now the turn walks you through them, CWG2-style.
- **Turn start:** standing division orders move first. Then the first brigade still waiting for orders is selected for you (and the map pans to it if it's near the edge).
- **Order of play:** division by division, brigade by brigade, in roster order; then unattached units (batteries, corps troops).
- **After a brigade moves** (or turns, fires, rests, digs in), the next waiting brigade comes up by itself after a short pause. It stays put instead if it can still fire at a visible enemy ("click an enemy, or N").
- **K = Hold** this brigade here this turn (marks it done). **N = Next brigade** (skip it for now; it stays on the list).
- **Who counts as done:** every battalion has acted, or it is carrying out a division order, or you pressed Hold. This is worked out from what the units did, so save/load/undo need nothing extra.
- **Seeing who's left:** a gold pulsing ring on each waiting colonel's flag; in the roster, waiting brigades have a gold bar and "● orders", done ones are dimmed with ✓, and each division shows "2/3 brigades ordered" / "✓ all orders given".
- **End turn:** the summary lists brigades with no orders and offers "Go to next brigade".
- Uses the existing "auto-select next unit" option; turn it off in Options for free-form play.

## Camera (27 Sep)
- Starts at 1:1 (the scale the board is painted at) centred on the army, instead of fitting the whole map (~0.47).
- **Z** = whole-map overview and back. **+ / −** zoom. The view can no longer be dragged off the board.

## v2.2 — contact view + unit status (John, 27 Sep): "on contact it's not clear who needs to do what to whom"
Move-to-contact worked; the fight didn't, because every layer drew at once and "who can still act" was a 3-px dot.
- **Status chip under every one of your units (always on):** movement points left (gold = can still move, dark = none) + a red gun-sight if it can fire at a visible enemy right now. Units that can do nothing more are drawn faded.
- **Contact view (automatic):** when the selected brigade (or battalion) can fire at someone, command radius, command lines, zones of control, standing-order ghosts and range shading are hidden. Each enemy it can hit gets a red hex ring with a badge "⌖ 5" = 5 of your battalions can fire at it. Hovering it draws the lines of fire and the side panel shows who fires and the expected result of the whole brigade volley.
- **Fighting as a brigade:** click a red-ringed enemy = every battalion that can reach it fires (Shift = assault). Click a battalion (map or its chip in the panel) to fight one at a time.
- **Tab / Shift+Tab** step through the battalions of this brigade that can still move or fire; past the last one, on to the next brigade waiting for orders. After a battalion fires and has nothing left to do, the next one comes up.
- A brigade that can still fire is not "done" (keeps its gold ring) until it fires or you press K.
- Panel: battalions shown as chips (gold = can move, red = can fire, grey = done), click to select. Roster rows show ⌖ for units that can fire.
- Fix: combat report no longer shows "undefined" for a volley that caused no losses. Unlimbered guns with a full turn count as able to act (they can limber up).
