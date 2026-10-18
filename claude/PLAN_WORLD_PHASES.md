# Living world — phases (drafted 18 Oct 2026, Opus, for John)

Goal: an immersive, beautiful, *living* Millbrook. Focus (John, 18 Oct): **life and motion** + **ground and detail**.
Starts from main ed0ba11 (First Look done: one sun, sky, mist, cloud shadows, gusts, opening shot, hero farm).

## Rules for every phase
- One phase per session. Plan in 3 lines -> build -> play-zoom screenshots -> plain-English report -> STOP for John.
- If a smarter way shows up, stop and ask John (multiple choice).
- Everything tied to Detail: **Low = off or static** (stays fast), Medium = main effect, High = extra density/range.
- Everything that moves uses `uT` and `uLive` (Living off = frozen, same layout).
- CC0 or own assets only, logged in ASSET_CREDITS.md. Double-click (file://) must still work.
- Backup branch before each phase, push to main after. Stop and ask after 2 failed fixes.
- **Do not touch:** units, rules, combat/AI, battlefield memory (no trampled crops, scorch marks or broken fences from the battle).
- Play-zoom screenshots for every phase: wide play view `16,10,1.4,50`, close play view of the phase's subject, and Low vs High of the same view.

## Phase 1 — Living water
River and brook flow (moving ripples running downstream, sun glints, darker deep middle, lighter shallows), white water at the ford,
bridge piers and brook mouth, slow reflections of the bank trees, and the mill wheel turning.
Shots: creek mouth `8,6,2.6,45`, bridge/mill close-up, wide. Low: still water with painted ripples.

## Phase 2 — Ground up close
What the eye lands on at play zoom: wildflower drifts in pastures (Queen Anne's lace, chicory, black-eyed Susans: July in Pennsylvania/Virginia),
clover and bare patches, road ruts and grassy crowns down the middle of lanes, mud at the ford and farm gates, stones along walls,
hay stubble in cut fields. Instanced, fades in by zoom, colour taken from the colour map so it never clashes.
Shots: pasture, lane by the farm, ford. Low: none (colour map only).

## Phase 3 — Farm life
The farms look lived in: chickens pecking in the yard, horses in a paddock (tails, heads, a slow walk), pigs at the barn, laundry that
flaps with the gust wind, smoke from every chimney, a dog that trots, a hay wagon left by the barn.
Shots: hero farm, town edge. Low: animals stand still, no laundry motion.

## Phase 4 — Small life in the air and grass
Songbird flocks that lift out of the wheat and settle again, crows on fence lines, swallows skimming the river, butterflies over the
wildflowers, dragonflies on the brook; fireflies at dusk/night (ties into the existing night lighting).
Shots: wheat field, brook, a dusk turn. Low: off.

## Phase 5 — The world notices the armies (read-only)
Life reacts to soldiers without changing them: herds and farm animals drift away from hexes with units (reads the existing occupancy texture),
birds burst out of trees and wheat when a volley or cannon fires nearby (reads fx events only, no rules), farm families' washing taken in
and doors shut once fighting starts nearby. Nothing permanent is left on the ground.
Shots: before/after a volley near the farm. Low: off.

## Ideas parked for later (John to choose)
- Sound ambience (wind, birdsong, brook, distant drums), tied to zoom and time of day.
- Real CC0 photo-scanned ground textures (ambientCG / Poly Haven) blended into the colour map for close zoom.
- Battlefield memory (trampled crops, smoke stains), only if John lifts the do-not-touch.
