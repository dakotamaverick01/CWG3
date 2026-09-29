# CWG3 Unit Art Pipeline (decided 2026-09-26)

## Decisions
- **Pre-rendered sprites** from 3D models: 8 facings × poses (stand, march, aim/fire, charge, fall) × uniform, rendered with consistent lighting matched to the painted map.
- **Small realistic squads:** 5–9 figures per battalion arranged as line or column, plus a color guard.
- **First uniform batch (core set):** Union dark-blue sack coat, sky-blue trousers, kepi; Confederate gray; Confederate butternut; slouch-hat variants.
- **Getting files in:** John enables network access (Settings → Capabilities → "Allow network egress"); otherwise downloads go into `assets/incoming/`.

## Render method (runs in Claude's cloud workspace, no install on John's Mac)
three.js (MIT) in headless Chromium → loads glTF/GLB models → poses from animation clips → renders transparent PNG sprite sheets → packed into `assets/sprites/*.png` + JSON atlas. Blender (free) optional for heavier edits.

## Candidate assets (license must be CC0, CC-BY, or our own; every file logged in ASSET_CREDITS.md)
| Need | Candidate | License | Notes |
|---|---|---|---|
| Soldier animations | Quaternius Universal Animation Library (quaternius.itch.io) | CC0 | 120+ clips incl. gun/combat, locomotion, deaths; rig only, no body mesh |
| Soldier body | Quaternius / Kenney CC0 base humans, + our own modeled kepi, sack coat, musket, cartridge box, blanket roll | CC0 / ours | Uniform textures painted by us (Grok Imagine/Canva for texture concepts) |
| Reference soldier | Sketchfab "3D printable Union Soldier" (Andy Woodhead) | CC-BY | Textured, static pose; credit required; good for portraits/reference |
| Cannon | Sketchfab "Civil War Cannon" (Zack_Hawley) | CC-BY 4.0 | Textured, 858k tris (fine for pre-rendering); credit required |
| Extra artifacts | Smithsonian 3D Open Access (3d.si.edu) | CC0 | Browse for period artillery/equipment |
| Horses | Quaternius animal packs | CC0 (verify) | For cavalry, officers, limbers |
Avoid: TurboSquid/CGTrader "free" (restrictive licenses), AI 3D generators unless their license is confirmed, Mixamo raw-file redistribution (baked sprites OK; needs Adobe account).

## Built 2026-09-26 (first batch)
- Sketchfab/itch downloads require a signed-in account, so batch 1 uses **our own low-poly 3D models** (built in code in `tools/sprites/render.html`): soldier with kepi or slouch hat, sack coat/shell jacket, cartridge box, haversack, canteen, blanket roll, rifle-musket (bayonet when charging), color bearer; 12-pdr Napoleon (bronze barrel, spoked wheels, trail) + limber.
- Uniforms: `us` (dark blue coat, sky-blue trousers, kepi), `cs_gray`, `cs_slouch`, `cs_butter` (butternut). CS brigades are mixed gray/butternut with some slouch hats.
- Poses × 6 hex facings: stand (shoulder arms), march ×2, aim, fire (muzzle smoke), charge ×2, fall, crew, bearer ×2. Guns: unlimbered, firing, limbered.
- Output: `assets/sprites/men.png` (96-px cells), `guns.png` (160-px cells), `units.js` manifest. Re-render: `python3 tools/sprites/render.py` (≈4 s). Review sheet: `python3 tools/sprites/preview.py us 0,1,2`.
- In game: infantry 5/7/9 figures by battalion size in two ranks (line) or column of twos; color bearer; aim/fire poses after volleys, charge poses in assaults, routed units run away; batteries show 2–3 guns + crews. Cavalry, officers and HQ still use the old drawings (next batch: horses).
- Tools: three.js r169 (MIT) vendored in `tools/sprites/vendor/`.

## Intake tool (2026-09-27) — how AI-generated sheets become game art
1. Save each generated sheet into `assets/incoming/` (ground sheets = 2×2 texture variants; prop sheets = objects in a 3×3 grid on flat magenta).
2. Add the file to the `GROUND` or `PROPS` table at the top of `tools/intake.py` (names in reading order).
3. Run `python3 tools/intake.py --review` → `assets/art/art.js` (what the game loads) plus `review_ground.jpg` / `review_props.jpg` to eyeball.
Prompt rules that make intake work: flat pure magenta (#FF00FF) background, objects not touching, 3×3 grid, no text labels, same golden-hour light from the upper left, 3/4 view for upright objects, straight top-down for ground.

## Grok prompt recipes that work (batch 2, 27 Sep)
- Never ask Grok for "transparent background": it paints a fake checkerboard into a JPEG. Always ask for a "flat solid pure magenta (#FF00FF) background", "3x3 grid", "never touching each other or the edges", "no text, no labels, no ground".
- Upright objects: "high three-quarter bird's-eye view looking down about 55 degrees, golden-hour sun from the upper left, soft dark shadows falling down-right on the magenta". Ground/surfaces: "2x2, each filling its quarter edge to edge, thin white gutters, camera looks STRAIGHT DOWN like a satellite photo, even light, no vignette".
- Unit facings: ask for "away to the upper-right / right in pure side view / toward the viewer to the lower-right" per row. The game mirrors for the other three hex directions. Grok still draws the side view slightly diagonal.
- Matching sides: make the Confederate sheet first, then "the exact same sprite sheet as the previous one … but Union …". Always say "strong, clearly saturated Union blue … obvious even when shrunk very small", or it comes out slate-grey.
- Hex-edge pieces (walls): ask for runs "diagonal upper-left to lower-right at a shallow 30 degree slope" and "straight away from the viewer (vertical on the page)" to match pointy-top hex edges.
- QA before saving (Claude runs this in the Grok tab): background share, nothing touching the border, and a simulation of intake's blob-by-cell grouping (must give 9 filled cells).
