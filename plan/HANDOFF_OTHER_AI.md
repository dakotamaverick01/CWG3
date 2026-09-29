# Handoff: helping with CWG3 between Claude sessions

_Upload this file to ChatGPT, Gemini or Grok. Also upload `BATCH4_WORKPLAN_AND_PROMPTS.md` if you will be making images there (batch 3 is done). Written 27 Sep 2026 by Claude (the main developer). Your work gets picked up in the next Claude session._

## 1. The project in one minute
- **CWG3** is John's hobby remake of *Robert E. Lee: Civil War Generals 2* (Sierra, 1997). It's a turn-based hex wargame that runs in a web browser (plain HTML/JavaScript, opened by double-clicking `play.html`).
- **Scale:** 150-yard hexes, 20-minute turns, one unit = one regiment or battery, brigade/division leaders with command radius. Player vs a computer opponent. There's one test battle so far, "Millbrook" (32×21 hexes, fictional).
- **Look:** painted, in the style of Mort Künstler's rich golden-hour Civil War paintings. As of today the map is **2.5D**: the painting is draped over real hills with sun shadows and haze, the camera is tilted (no rotation), and the units are painted cut-out figures standing on the ground.
- **Rules for everything you make:** original or free-licensed only (CC0 / CC-BY / MIT). No copying of CWG2's maps, art or text. No real historical persons depicted. Fictional places. Plausible 1861–65 details.
- **Who's who:** John decides (not a programmer, so explain terms and give him copy-paste-ready output). Claude writes all code. **You design and research.** Don't write game code or try to edit game files. Deliver the files described below.

## 2. Your jobs (do them in order; each stands alone)

### Job A: design two new battlefields (the most valuable)
John wants many maps with strong visual variety. Design **two** fictional battlefields in the format in section 3:
1. **"Cedar Run": a summer river crossing.** A winding river (impassable except at 1 bridge and 2 fords), a village on the defender's bank, bluffs above it, farms and woods on the attacker's side.
2. **"Hollis Gap": a mountain pass, early autumn.** Two wooded ridges (height 3–4) with a gap and a road through it, a creek in the valley, rocky knolls, a small hamlet, stone walls on the approach.

For each map, write a short "battle story" (who attacks, from which edge, what they must take, why the terrain makes it interesting), with 4–6 objectives. Make sure there are several sensible approaches, not one obvious path.
**Save as:** `Documents/CWG3/incoming_maps/cedar_run.json` and `hollis_gap.json` (plain text, valid JSON). If you can't save files, print the JSON in a code block and John will save it.

### Job B: a free sound list (no downloads)
Find about 30 sound effects and ambiences for the game. **CC0 only** (Freesound.org with the license filter set to CC0 is best). For each one give: purpose, Freesound title, author, URL, license (must say CC0), length. Cover: musket volley (near/far), single rifle shot, cannon (near/far), shell burst, bugle calls (advance, retreat), drums (march), cheering (Rebel yell style, Union hurrah), officer shout, horses trotting and galloping, wagon wheels, wind over fields, birdsong morning, crickets night, creek water, distant battle rumble, UI click (paper/wood), page turn, and a quill-scratch.
**Save as:** `Documents/CWG3/docs/incoming/SOUND_LIST.md`. Check every license yourself on the page. If you're unsure, leave it out.

### Job C: fictional officers for the portrait sheets
Portrait sheets 42 (Confederate) and 43 (Union) each have 9 faces in a 3×3 grid, read left→right, top→bottom. Invent a name, rank (Col. / Brig. Gen. / Maj. Gen.), home state, a one-line personality ("cautious engineer, ex-West Point", "hot-tempered cavalryman"), and a 1–10 leadership rating for each of the 18. The names must not belong to real Civil War officers. Check and avoid famous ones.
**Save as:** `Documents/CWG3/docs/incoming/OFFICERS.md`.

### Job D (whenever John asks): check generated images
If John uploads a generated image sheet, check it against the checklist at the bottom of `BATCH4_WORKPLAN_AND_PROMPTS.md`. Check: flat WHITE background for objects (flat medium grey for snowy or white objects, pure black for smoke/fire; magenta is no longer used), 9 separate items not touching, no text, correct view angle, summer trees green, Union blue clearly blue. If it fails, write ONE corrected, complete, copy-paste-ready prompt. Keep the prompt style of that file, and never ask for a "transparent background".

## 3. Map format (Job A)
```json
{
  "name": "Cedar Run",
  "season": "summer",
  "story": "2–4 sentences: who attacks from where, what they must take.",
  "cols": 32, "rows": 21,
  "terrain": ["32 characters", "... exactly 21 strings ..."],
  "height":  ["32 digits 0-4", "... exactly 21 strings ..."],
  "roads": [ { "major": 1, "p": [[0,10],[1,10],[2,10]] } ],
  "sunken": [[19,16],[20,16]],
  "edges": [ { "type": "wall", "between": [[18,5],[19,5]] } ],
  "supply": [[0,10,"US"],[31,16,"CS"]],
  "objectives": [[21,10,"Cedar Run village",20,"CS"]],
  "labels": [["Cedar Run",12,5]]
}
```
- **Coordinates** are `[column, row]`, both starting at 0. Column 0 is the west edge, row 0 the north edge. Hexes are pointy-topped, and **odd rows are shifted half a hex to the right**.
- **Neighbours** of hex (c, r). On an even row: (c+1,r) (c,r+1) (c−1,r+1) (c−1,r) (c−1,r−1) (c,r−1). On an odd row: (c+1,r) (c+1,r+1) (c,r+1) (c−1,r) (c,r−1) (c+1,r−1).
- **terrain letters:** `g` grass · `c` crop field (wheat/corn) · `o` orchard · `f` forest · `t` town · `h` farm (farmhouse + yard) · `k` rocky knoll · `s` swamp · `w` river (impassable) · `b` bridge (a road over a river hex) · `d` river ford · `x` fort/earthwork. Row string *r* character *c* = the terrain of hex (c, r).
- **height:** 0 (valley floor) to 4 (high ridge), one digit per hex. Change by at most 1 between neighbours, except on cliffs and bluffs, which may jump 2. Real ridges are long and continuous. Crests matter: they block sight and give artillery range.
- **roads:** every consecutive pair of hexes in `p` must be neighbours. `major: 1` = pike/turnpike, `0` = farm lane. Roads cross rivers only on `b` or `d` hexes.
- **edges:** walls/fences/streams sit on the border between two neighbouring hexes. `type` is `wall` (stone wall, strong cover), `fence` (rail fence), or `stream` (small creek). List one entry per hex border. A stream is a chain of borders.
- **sunken:** hexes of a sunken lane (optional, very strong cover).
- **supply:** where each side's reinforcements and supply enter (map edge hexes).
- **objectives:** `[c, r, "name", victory points 5–20, side holding it at start or null]`.
- **labels:** place names to paint on the map.

**Before saving, check:**
- exactly 21 terrain strings and 21 height strings, each exactly 32 characters;
- only the letters above;
- roads are chains of neighbouring hexes;
- every river hex a road crosses is `b` or `d`;
- at least one river crossing every ~8 rows;
- both sides can reach every objective.

**Design tips:** leave open ground between cover so fields of fire matter. Give the defender a strong but flankable line. Give the attacker 2–3 approaches with different risks. Put about 12–25% of hexes in forest.

## 4. What happens next (for your context)
Claude will next:
1. make the lighting follow the clock, plus summer green trees (the map currently looks too orange);
2. process John's new image sheets into game art;
3. add drifting cloud shadows, a flowing creek, a sky backdrop and 3D battle smoke;
4. give the menus a period look;
5. import the maps you designed.

Keep your output in the formats above and it can be dropped straight in.
