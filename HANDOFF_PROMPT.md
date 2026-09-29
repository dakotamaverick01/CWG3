You are my design partner on a hobby game project. We work in QUESTION-AND-ANSWER format: ask me ONE question at a time, usually multiple choice (A/B/C, with your recommendation first and why), wait for my answer, then build on it. Explain any technical term the first time you use it (I'm not a programmer). Keep answers short. When we've settled something, summarize the decision in 2–3 lines so I can paste it back into my project notes.

## The project: CWG3
A modern remake of Sierra's "Robert E. Lee: Civil War Generals 2" (1997), a hex-based, turn-based American Civil War battle game. It's a personal project, built with Claude (an AI coding assistant) as a plain HTML/JavaScript game. You open play.html in Chrome, with no installs and no game engine. Fictional officers and regiment names; no original Sierra art, text or code.

**V1 goal:** one polished battle, "Millbrook" (a fictional creek valley, a walled ridge, a sunken lane, a town), played against the computer, in a painted golden-hour Mort Künstler look. Test of success: "A 1998 CWG2 player loads Millbrook, clicks a brigade, it doesn't scatter, and they feel like a general."

## How it plays today
- **Scale:** 150-yard hexes, 20-minute turns; the battle runs from Day 1 08:00 to Day 2 noon. Map 32×21 hexes. Night, dawn and dusk turns, weather (rain, mud, fog).
- **Units:** battalions (regiments over 500 men split into two "wings"). About 20–25 per side, organized Corps HQ → divisions (general) → brigades (colonel) → battalions. Also artillery batteries, cavalry, sharpshooters, engineers and scouts.
- **Command radius:** units outside their leader's reach move at ¾ speed and fight worse.
- **Standing orders (the core mechanic, and it works):** select a colonel or general and click or drag a line on the map. The whole brigade or division marches there, keeping its shape, over as many turns as it takes, and halts when it spots the enemy.
- **Play flow I've settled into:** each turn, first give orders to the big formations, then fine-tune individual battalions that have points left or need exact placement.
- **Formations:** infantry column (12 movement points, 2 per hex on grass, fast) and line (8 points, 3 per hex, can fire). Also cavalry mounted or dismounted, artillery limbered or unlimbered, skirmishers. Turning in line costs points; walls, fences and streams cost extra.
- **Combat:** volleys (range, cover, height, flank or rear, fatigue, leadership), assaults and charges, return fire, retreat, rout, surrender, rally. There's an honest odds preview on hover, and brigade volleys (every battalion that can reach a target fires).
- **Terrain matters a lot:** true-height line of sight with dead ground, artillery gains range from heights, uphill assaults cost more, walls and fences sit on hex edges, woods are bloody and block guns, facing matters.
- **Victory points:** objectives (Millbrook 20, Carrow Knoll 10, Sunken Lane 10, Stone Bridge 10, Dunmore Farm 5) plus casualties and army morale.
- **Computer opponent (AI):** commands through the same standing-order system a player uses and sees only what its troops see. Each turn it decides to attack or defend, assigns brigades to hold, attack or reserve, stages attacks and goes in together, sites guns on high ground, and picks targets using the odds preview. It has three difficulty levels. The Confederates (defending the ridge) usually win AI-vs-AI; that's a balance question for later.
- **Display:** a gold hex ring means a battalion can still move; crimson, pulsing, means it can fire now; grey and faded means done. The top bar counts "N can fire / N can move" and jumps to the next one, and End Turn glows when nothing is left. The ground marking under each battalion shows its brigade colour and formation: an arrow for column, a bar for line, a dotted ring for skirmishers. At most one problem badge per unit: routed, out of command, low ammo, or dug in. Details like movement points appear only on selection or hover.
- **New this week (trial):** a "Brigade cmd" switch. Clicking a battalion selects its whole brigade, and Option-click picks one battalion. A selected formation gets a bright outline. Figures are bigger. An on-screen coach box gives first-time-player tips.

## The open design problem (what I want to work through with you)
I'm trying to find the balance between tactical command (regiments and battalions) and operational command (divisions and brigades moving onto the field). Sierra's CWG2 had you command brigades, then regiments. Going down to battalions mostly adds more pieces to track rather than more interesting decisions. I'm likely to stick more or less with what we have, but I want a command structure that's cohesive and flows well.

Ideas on the table (none decided):
1. Brigade as the playing piece: battalions become its footprint; you can detach a regiment for special jobs. This is currently a trial switch.
2. Split each turn into an Orders phase (divisions and brigades) and an Engagement phase (only brigades in contact fight).
3. Armies arrive in waves along roads, so the early game is about shaping the battle, with a "fast-forward to contact" so marches aren't dull.
4. A larger map later (needs technical work to draw it efficiently).
5. Movement points: about 1 in 4 battalions end a turn with leftover points (1–4) that can't buy any hex. The display is fixed to only count units that can really move. Rule options: (a) leave it, (b) a "final step" rule where at least half a hex's cost lets you take one last step, (c) rescale points, e.g. line 9 = 3 grass hexes.

Other known issues: formations are still hard to read from the figures alone (painted unit art is coming); the screen can feel busy; tooltips and instructions need a proper pass later.

## What I'd like from you
Start by asking me the single most important question to settle the command-level problem. Take it one question at a time until we have a clear, short design I can hand back to Claude to build. Challenge my ideas when they add complexity without adding decisions. Keep in mind what made CWG2 fun, and what modern games (Ultimate General: Gettysburg, Scourge of War, Grand Tactician) do well or badly here.

## Files I may upload
STATUS.md (session-by-session build log), WORK_PLAN.md (phases A–H), COMMAND_ORDERS.md (how orders work), AI_DESIGN.md (computer opponent), COMBAT.md, TERRAIN_DESIGN.md, SCALE_ORG.md, RULES_SPEC.md, and screenshots. If something I describe conflicts with those files, the files win; ask me if unsure.
